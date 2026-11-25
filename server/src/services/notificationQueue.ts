import mongoose from "mongoose";
import { Notification } from "../models/Notification.model";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { publishedFilter } from "./marketplace";
import { deliverDeviceAlert } from "./deviceAlerts";

async function expandListingBroadcast(job: InstanceType<typeof Notification>) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const lease = { _id: job._id, leaseUntil: job.leaseUntil };
      const published = await Property.exists({
        ...publishedFilter, _id: job.data.id, status: "verified", "badges.fullyVerified": true,
      }).session(session);
      const batchSize = 100;
      const recipients = published ? await User.find({
        role: "user", createdAt: { $lte: job.createdAt },
        _id: { $ne: job.recipient, ...(job.broadcastCursor ? { $gt: job.broadcastCursor } : {}) },
        isActive: { $ne: false }, isSuspended: { $ne: true }, deletionRequestedAt: { $exists: false },
        passwordHash: { $exists: true },
      }).sort({ _id: 1 }).limit(batchSize).select("_id").session(session).lean() : [];
      const progress = await Notification.updateOne(lease, {
        $set: recipients.length === batchSize
          ? { broadcastCursor: recipients[batchSize - 1]._id, nextAttemptAt: new Date(), attempts: 0 }
          : { deliveredAt: new Date() },
        $unset: { leaseUntil: 1 },
      }, { session });
      if (!progress.modifiedCount || !recipients.length) return;
      await Notification.insertMany(recipients.map(({ _id }) => ({
        recipient: _id, title: job.title, body: job.body, data: { ...job.data, listingAnnouncement: true },
      })), { session });
    });
  } finally {
    await session.endSession();
  }
}

export async function deliverNotifications() {
  const deadline = Date.now() + 5000;
  for (let i = 0; i < 128 && Date.now() < deadline; i++) {
    const now = new Date();
    const job = await Notification.findOneAndUpdate(
      {
        deliveredAt: null,
        failedAt: null,
        nextAttemptAt: { $lte: now },
        $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }],
      },
      {
        $set: { leaseUntil: new Date(Date.now() + 60000) },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { nextAttemptAt: 1 } },
    );
    if (!job) return;
    try {
      if (job.listingBroadcast) {
        await expandListingBroadcast(job);
        continue;
      }
      if (process.env.DEVICE_ALERTS_ENABLED === "true") await deliverDeviceAlert(job);
      await Notification.updateOne(
        { _id: job._id, leaseUntil: job.leaseUntil },
        { $set: { deliveredAt: new Date() }, $unset: { leaseUntil: 1 } },
      );
    } catch {
      if (job.attempts >= 3) {
        await Notification.updateOne({ _id: job._id, leaseUntil: job.leaseUntil }, { $set: { failedAt: new Date(), lastError: "Delivery failed after retries" }, $unset: { leaseUntil: 1 } });
        console.error("[Push] Notification retries exhausted", { notificationId: job._id });
        continue;
      }
      await Notification.updateOne(
        { _id: job._id, leaseUntil: job.leaseUntil },
        {
          $set: {
            nextAttemptAt: new Date(
              Date.now() + Math.min(120000, 5000 * 2 ** job.attempts) + Math.random() * 2000,
            ),
          },
          $unset: { leaseUntil: 1 },
        },
      );
    }
  }
}
