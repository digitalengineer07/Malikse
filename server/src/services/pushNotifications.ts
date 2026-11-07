import { PushDevice } from "../models/PushDevice.model";
import { PushReceipt } from "../models/PushReceipt.model";
import { User } from "../models/User.model";

type PushData = { kind: "inquiry" | "deal"; id: string };
type PushTicket = { status: "ok" | "error"; id?: string; details?: { error?: string }; message?: string };

export async function notifyUser(userId: string, title: string, body: string, data: PushData) {
  if (!await User.exists({ _id: userId, deletionRequestedAt: { $exists: false } })) return;
  const devices = await PushDevice.find({ userId }).select("token").lean();
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
    const pending: Array<{ ticketId: string; token: string }> = [];
    for (const [index, ticket] of (result.data || []).entries()) {
      if (ticket.status === "ok" && ticket.id) {
        pending.push({ ticketId: ticket.id, token: batch[index].token });
        continue;
      }
      if (ticket.status !== "error") continue;
      if (ticket.details?.error === "DeviceNotRegistered") {
        await PushDevice.deleteOne({ token: batch[index].token });
      } else {
        console.warn("[Push] Expo rejected notification", ticket.details?.error || ticket.message);
      }
    }
    if (pending.length) await PushReceipt.insertMany(pending, { ordered: false });
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
    const receipt = result.data?.[item.ticketId];
    if (!receipt) continue;
    completed.push(item.ticketId);
    if (receipt.status === "error") {
      if (receipt.details?.error === "DeviceNotRegistered") {
        await PushDevice.deleteOne({ token: item.token });
      } else {
        console.warn("[Push] Delivery failed", receipt.details?.error || receipt.message);
      }
    }
  }
  if (completed.length) await PushReceipt.deleteMany({ ticketId: { $in: completed } });
}

export function sendPush(userId: string, title: string, body: string, data: PushData) {
  void notifyUser(userId, title, body, data).catch(error => {
    console.warn("[Push] Delivery request failed", error instanceof Error ? error.message : error);
  });
}
