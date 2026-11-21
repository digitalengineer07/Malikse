import { Notification } from "../models/Notification.model";
import { notifyUser } from "./pushNotifications";
import { findNotificationMessage } from "./notificationMessage";

export async function deliverNotifications() {
  for (let i = 0; i < 20; i++) {
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
      const message = await findNotificationMessage(String(job.recipient), job.data, job.messageId);
      // Bound the push payload while keeping complete Unicode code points.
      const characters = message ? Array.from(message) : [];
      const body = characters.length > 240 ? characters.slice(0, 240).join("") + "…" : message ?? job.body!;
      await notifyUser(
        String(job.recipient),
        job.title!,
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
