import { Notification } from "../models/Notification.model";
import { PushDevice } from "../models/PushDevice.model";
import { PushReceipt } from "../models/PushReceipt.model";
import { User } from "../models/User.model";

type PushData = { kind: "inquiry" | "deal"; id: string };
type PushTicket = { status: "ok" | "error"; id?: string; details?: { error?: string }; message?: string };

export async function notifyUser(userId: string, title: string, body: string, data: PushData, job?: any) {
  if (!await User.exists({ _id: userId, deletionRequestedAt: { $exists: false } })) return;
  const devices = await PushDevice.find({ userId, ...(job ? { token: { $nin: [...job.acceptedTokens, ...job.permanentTokens] } } : {}) }).select("token").lean();
  if (!devices.length) return;
  for (let start = 0; start < devices.length; start += 100) {
    const batch = devices.slice(start, start + 100);
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch.map(device => ({
        to: device.token, title, body, data, sound: "default", channelId: "updates",
      }))),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
    const result = await response.json() as { data?: PushTicket[] };
    const pending: Array<{ ticketId: string; token: string; notificationId?: any }> = [];
    let rejected = false;
    if (!Array.isArray(result.data) || result.data.length !== batch.length) throw new Error("Invalid provider ticket response");
    for (const [index, ticket] of (result.data || []).entries()) {
      if (ticket.status === "ok" && ticket.id) {
        pending.push({ ticketId: ticket.id, token: batch[index].token, notificationId: job?._id });
        if (job) await Notification.updateOne({ _id: job._id }, { $addToSet: { acceptedTokens: batch[index].token } });
        continue;
      }
      if (ticket.status !== "error") { rejected = true; continue; }
      if (ticket.details?.error === "DeviceNotRegistered") {
        await PushDevice.deleteOne({ token: batch[index].token });
      } else {
        const permanent = ["MessageTooBig", "MismatchSenderId", "InvalidCredentials"].includes(ticket.details?.error || "");
        if (permanent && job) await Notification.updateOne({ _id: job._id }, { $addToSet: { permanentTokens: batch[index].token }, $set: { lastError: ticket.details?.error } });
        rejected = true;
      }
    }
    if (pending.length) await PushReceipt.insertMany(pending, { ordered: false });
    if (rejected) throw new Error("Provider rejected one or more devices");
  }
}

export async function checkPushReceipts() {
  const pending = await PushReceipt.find({ createdAt: { $lt: new Date(Date.now() - 15 * 60_000) } })
    .sort({ createdAt: 1 }).limit(100).lean();
  if (!pending.length) return;
  const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ids: pending.map(item => item.ticketId) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Expo receipt service returned ${response.status}`);
  const result = await response.json() as { data?: Record<string, PushTicket> };
  const completed: string[] = [];
  for (const item of pending) {
    const receipt = result.data?.[item.ticketId] || (item.createdAt.getTime() < Date.now() - 24 * 60 * 60_000
      ? { status: "error", details: { error: "ReceiptTimeout" } } : undefined);
    if (!receipt) continue;
    completed.push(item.ticketId);
    if (receipt.status === "error") {
      if (receipt.details?.error === "DeviceNotRegistered") {
        await PushDevice.deleteOne({ token: item.token });
      } else {
        if (item.notificationId) await Notification.updateOne({ _id: item.notificationId }, { $unset: { deliveredAt: 1 }, $pull: { acceptedTokens: item.token }, $set: { nextAttemptAt: new Date(), lastError: receipt.details?.error || "ReceiptRejected" } });
        console.error("[Push] Receipt delivery failed", { notificationId: item.notificationId, error: receipt.details?.error });
      }
    }
  }
  if (completed.length) await PushReceipt.deleteMany({ ticketId: { $in: completed } });
}

export function sendPush(userId: string, title: string, body: string, data: PushData) {
  void Notification.create({ recipient: userId, title, body, data }).catch(() => console.error("[Push] Could not queue notification"));
}
