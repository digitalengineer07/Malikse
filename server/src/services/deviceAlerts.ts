import { isObjectIdOrHexString } from "mongoose";
import { Notification } from "../models/Notification.model";
import { PushDevice } from "../models/PushDevice.model";
import { PushReceipt } from "../models/PushReceipt.model";
import { User } from "../models/User.model";

type Ticket = { status: "ok" | "error"; id?: string; details?: { error?: string } };
const lifetime = 60 * 60;
const permanentErrors = new Set(["MessageTooBig", "InvalidCredentials", "MismatchSenderId"]);

async function expoRequest(path: "send" | "getReceipts", payload: unknown) {
  const token = process.env.EXPO_PUSH_ACCESS_TOKEN?.trim();
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Expo push HTTP ${response.status}`);
  return response.json() as Promise<{ data?: unknown }>;
}

export async function deliverDeviceAlert(job: InstanceType<typeof Notification>) {
  const target = job.data;
  if (!target || !["inquiry", "deal", "listings", "property"].includes(target.kind)
    || typeof target.id !== "string" || !isObjectIdOrHexString(target.id)
    || target.listingAnnouncement || job.readAt || Date.now() - job.createdAt.getTime() >= lifetime * 1000) return;
  const user = await User.findOne({ _id: job.recipient, isActive: { $ne: false }, isSuspended: { $ne: true },
    deletionRequestedAt: { $exists: false } }).select("sessionVersion").lean();
  if (!user) return;

  const devices = await PushDevice.find({
    userId: job.recipient, sessionVersion: user.sessionVersion ?? 0,
    token: { $nin: [...job.acceptedTokens, ...job.permanentTokens] },
  }).sort({ updatedAt: -1 }).limit(100).lean();
  if (!devices.length) return;
  const ttl = Math.max(0, lifetime - Math.floor((Date.now() - job.createdAt.getTime()) / 1000));
  const { data } = await expoRequest("send", devices.map(device => ({
    to: device.token,
    title: target.kind === "inquiry" ? "New property conversation update" : "MalikSe property update",
    body: "Open MalikSe to view the update.",
    channelId: "updates", sound: "default", ttl,
    data: { kind: target.kind, id: target.id },
  })));
  if (!Array.isArray(data) || data.length !== devices.length) throw new Error("Invalid Expo push tickets");
  const accepted: string[] = [];
  const permanent: string[] = [];
  const receipts: Array<{ ticketId: string; token: string; notificationId: typeof job._id }> = [];
  let retry = false;
  for (const [index, ticket] of (data as Ticket[]).entries()) {
    const device = devices[index];
    if (ticket?.status === "ok" && ticket.id) {
      accepted.push(device.token);
      receipts.push({ ticketId: ticket.id, token: device.token, notificationId: job._id });
      continue;
    }
    const error = ticket?.details?.error;
    if (error === "DeviceNotRegistered") {
      await PushDevice.deleteOne({ _id: device._id, updatedAt: device.updatedAt });
      permanent.push(device.token);
    } else if (error && permanentErrors.has(error)) {
      permanent.push(device.token);
      console.warn("[Device alerts] Expo rejected a device", { notificationId: job._id, error });
    } else {
      retry = true;
    }
  }
  if (accepted.length || permanent.length) await Notification.updateOne(
    { _id: job._id, leaseUntil: job.leaseUntil },
    { $addToSet: { acceptedTokens: { $each: accepted }, permanentTokens: { $each: permanent } } },
  );
  if (receipts.length) await PushReceipt.insertMany(receipts, { ordered: false });
  if (retry) throw new Error("Expo deferred one or more devices");
}

export async function checkDeviceAlertReceipts() {
  const now = Date.now();
  const pending = await PushReceipt.find({ createdAt: { $lte: new Date(now - 15 * 60_000) } })
    .sort({ createdAt: 1 }).limit(100).lean();
  if (!pending.length) return;
  const { data } = await expoRequest("getReceipts", { ids: pending.map(item => item.ticketId) });
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid Expo receipts");
  const receipts = data as Record<string, Ticket>;
  for (const item of pending) {
    const receipt = receipts[item.ticketId];
    if (!receipt && now - item.createdAt.getTime() < 24 * 60 * 60_000) continue;
    if (receipt?.details?.error === "DeviceNotRegistered") {
      await PushDevice.deleteOne({ token: item.token, updatedAt: { $lte: item.createdAt } });
    } else if (receipt?.status !== "ok") {
      console.warn("[Device alerts] Expo delivery unconfirmed", { notificationId: item.notificationId, error: receipt?.details?.error });
      if (receipt?.details?.error === "MessageRateExceeded" && item.notificationId) {
        await Notification.updateOne({
          _id: item.notificationId, attempts: { $lt: 3 }, readAt: null,
          createdAt: { $gt: new Date(now - lifetime * 1000) },
          acceptedTokens: item.token, leaseUntil: null,
        }, {
          $unset: { deliveredAt: 1 },
          $pull: { acceptedTokens: item.token },
          $set: { nextAttemptAt: new Date(now + 60_000) },
        });
      }
    }
    await PushReceipt.deleteOne({ _id: item._id });
  }
}
