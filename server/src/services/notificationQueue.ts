import { Notification } from "../models/Notification.model";
import { notifyUser } from "./pushNotifications";
export async function deliverNotifications() {
  for (let i = 0; i < 20; i++) {
    const now = new Date();
    const job = await Notification.findOneAndUpdate(
      {
        deliveredAt: null,
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
      await notifyUser(
        String(job.recipient),
        job.title!,
        job.body!,
        job.data as any,
      );
      await Notification.updateOne(
        { _id: job._id, leaseUntil: job.leaseUntil },
        { $set: { deliveredAt: new Date() }, $unset: { leaseUntil: 1 } },
      );
    } catch {
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
