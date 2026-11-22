import mongoose from "mongoose";
import { Notification } from "../models/Notification.model";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { publishedFilter } from "./marketplace";
import { notifyUser } from "./pushNotifications";
import { chatNotificationTitle, findNotificationMessage, genericChatTitle } from "./notificationMessage";

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
        recipient: _id, title: job.title, body: job.body, data: job.data,
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
      const message = await findNotificationMessage(String(job.recipient), job.data, job.messageId);
      const sender = job.title === genericChatTitle && message?.senderId
        ? await User.findOne({ _id: message.senderId, deletionRequestedAt: { $exists: false } })
          .select("name").maxTimeMS(2000).lean().catch(() => null)
        : null;
      const title = job.messageId && !message ? genericChatTitle
        : sender ? chatNotificationTitle(sender.name) : job.title!;
      // Bound the push payload while keeping complete Unicode code points.
      const characters = message ? Array.from(message.text) : [];
      const body = characters.length > 240 ? characters.slice(0, 240).join("") + "…" : message?.text ?? job.body!;
      await notifyUser(
        String(job.recipient),
        title,
        body,
        job.data as any,
        job,
      );
      const updated = await Notification.findById(job._id).select("permanentTokens");
      if (updated?.permanentTokens.length) throw new Error("Permanent device failure");
      await Notification.updateOne(
        { _id: job._id, leaseUntil: job.leaseUntil },
        { $set: { deliveredAt: new Date() }, $unset: { leaseUntil: 1 } },
      );
    } catch {
      if (job.attempts >= 5) {
        await Notification.updateOne({ _id: job._id, leaseUntil: job.leaseUntil }, { $set: { failedAt: new Date(), lastError: "Delivery failed after five attempts; check provider credentials and device outcomes" }, $unset: { leaseUntil: 1 } });
        console.error("[Push] ACTION REQUIRED: notification retries exhausted", { notificationId: job._id });
        continue;
      }
      await Notification.updateOne(
        { _id: job._id, leaseUntil: job.leaseUntil },
        {
          $set: {
            nextAttemptAt: new Date(
              Date.now() +
                Math.min(3600000, 1000 * 2 ** Math.min(job.attempts, 12)),
            ),
          },
          $unset: { leaseUntil: 1 },
        },
      );
    }
  }
}
