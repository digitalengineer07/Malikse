import { Router, Response } from "express";
import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware";
import { Inquiry } from "../models/Inquiry.model";
import { Property } from "../models/Property.model";
import { Notification } from "../models/Notification.model";
import { assignedStaff, OfferError } from "../services/marketplace";
import { identityApproved } from "../services/security";
import { chatNotificationTitle } from "../services/notificationMessage";
import { canWaitForChat, chatCursor, wakeChat } from "../services/chatActivity";

const historySize = 50;
const previewSize = 6;

function respondError(error: unknown, res: Response) {
  if (error instanceof OfferError) return res.status(error.status).json({ error: error.message });
  console.error(JSON.stringify({ event: "chat_request_failed", requestId: res.locals.requestId,
    errorType: error instanceof Error ? error.name : "Unknown", code: (error as {code?:number})?.code }));
  return res.status(500).json({ error: "Chat request failed" });
}

// Mounted after authentication and the inquiry assignment guard.
export const messaging = Router();
messaging.get("/:id/messages", async (req: AuthRequest, res) => {
  try {
    const cursor = req.query.before;
    if (cursor !== undefined && (typeof cursor !== "string" || !/^\d+$/.test(cursor) || !Number.isSafeInteger(Number(cursor))))
      throw new OfferError(400, "Invalid message cursor");
    const id = new Types.ObjectId(req.params.id);
    const account = new Types.ObjectId(req.user!.id);
    const live = req.query.live === "1" && cursor === undefined;
    const since = live && req.query.since !== undefined ? Number(req.query.since) : null;
    if (since !== null && (!Number.isSafeInteger(since) || since < 0 || since > 2147483647 || typeof req.query.since !== "string"))
      throw new OfferError(400, "Invalid conversation offset");
    // Capture before querying so a concurrent commit invalidates this cursor.
    const revision = live ? chatCursor(String(id), String(account)) : undefined;
    const end = { $min: [Number(cursor ?? 0), { $max: [0, { $subtract: ["$count", previewSize] }] }] };
    const [page] = await Inquiry.aggregate([
      { $match: { _id: id, $or: [{ buyerId: account }, { staffId: account }] } },
      { $set: { count: { $size: { $ifNull: ["$messages", []] } } } },
      { $set: { end } },
      { $set: { start: { $max: [0, { $subtract: ["$end", historySize] }] } } },
      { $project: {
        count: 1, messages: since !== null ? { $slice: [{ $ifNull: ["$messages", []] }, since, historySize] } :
          cursor === undefined ? { $slice: [{ $ifNull: ["$messages", []] }, -previewSize] } :
          { $cond: [{ $gt: ["$end", 0] }, { $slice: ["$messages", "$start", { $subtract: ["$end", "$start"] }] }, []] },
        offset: cursor === undefined ? { $subtract: ["$count", previewSize] } : "$start",
        buyerId: 1, staffReadAt: 1, buyerReadAt: 1,
      } },
    ]).read("primary").option({ maxTimeMS: 5000 });
    if (!page) throw new OfferError(404, "Conversation not found");
    const payload = { messages: page.messages, nextBefore: page.offset > 0 ? page.offset : null };
    if (cursor !== undefined) return res.json(payload);
    const buyer = account.equals(page.buyerId);
    const result = { ...payload, ownReadAt: (buyer ? page.buyerReadAt : page.staffReadAt) ?? null,
      recipientReadAt: (buyer ? page.staffReadAt : page.buyerReadAt) ?? null };
    if (live) {
      const messageCount = since === null ? page.count : Math.min(page.count, since + page.messages.length);
      return res.json({ ...result, messageCount, liveCursor: revision,
        more: messageCount < page.count, canWait: !res.locals.chatWaitBusy && canWaitForChat(String(account)) });
    }
    const tag = '"' + createHash("sha256").update(JSON.stringify(result)).digest("base64url") + '"';
    res.setHeader("ETag", tag);
    if (req.headers["if-none-match"] === tag) return res.status(304).end();
    return res.json(result);
  } catch (error) { return respondError(error, res); }
});

type SendItem = { text: string; clientMessageId?: string };
type StoredMessage = { _id: Types.ObjectId; senderId: Types.ObjectId; text: string; createdAt: Date };
type ThreadSnapshot = { _id: Types.ObjectId; propertyId: Types.ObjectId; buyerId: Types.ObjectId;
  staffId: Types.ObjectId; messages: StoredMessage[]; count: number };

function parseItems(body: {text?: unknown; clientMessageId?: unknown; batch?: unknown}) {
  const batch = body.batch;
  const items = batch === undefined ? [body] : batch;
  if (!Array.isArray(items) || !items.length || items.length > 8)
    throw new OfferError(400, "Invalid message batch");
  const keys = new Set<string>();
  return items.map((item): SendItem => {
    if (typeof item?.text !== "string" || !item.text.trim() || item.text.length > 5000)
      throw new OfferError(400, "Enter a message between 1 and 5000 characters");
    const key = item.clientMessageId;
    if (key !== undefined || batch !== undefined) {
      if (typeof key !== "string" || !/^[\w-]{16,80}$/.test(key) || keys.has(key))
        throw new OfferError(400, "Invalid or duplicate message key");
      keys.add(key);
    }
    return { text: item.text.trim(), clientMessageId: key };
  });
}

async function appendMessages(req: AuthRequest, items: SendItem[]) {
  const actor = req.user!.id;
  const inquiryId = new Types.ObjectId(req.params.id);
  const senderId = new Types.ObjectId(actor);
  const pending = items.map(({ text, clientMessageId }) => ({
    _id: clientMessageId ? new Types.ObjectId(createHash("sha256")
      .update([req.params.id, actor, clientMessageId].join("/")).digest().subarray(0, 12)) : new Types.ObjectId(),
    text, senderId, createdAt: new Date(),
  }));
  const ids = pending.map(message => message._id);
  // Each collision can only occur if another writer has inserted one of our keys
  // or the assignment changed. Read the primary again before acknowledging a replay.
  for (let attempt = 0; attempt <= pending.length; attempt++) {
    const [thread] = await Inquiry.aggregate<ThreadSnapshot>([
      { $match: { _id: inquiryId, staffId: { $exists: true } } },
      { $project: { buyerId: 1, staffId: 1, propertyId: 1, count: { $size: { $ifNull: ["$messages", []] } },
        messages: { $filter: { input: { $ifNull: ["$messages", []] }, as: "m", cond: { $in: ["$$m._id", ids] } } } } },
    ]).read("primary");
    if (!thread) throw new OfferError(404, "Conversation not found");
    const listing = await Property.findById(thread.propertyId).select("status assignedAdvisorId assignedVerifierId").lean();
    if (listing?.status !== "verified") throw new OfferError(409, "Property unavailable. Conversation is read-only");
    const staff = await assignedStaff(listing);
    const buyer = thread.buyerId.equals(senderId);
    if (!buyer && String(staff._id) !== actor) throw new OfferError(403, "Not assigned to this property");
    if (buyer && (!req.account || !identityApproved(req.account))) throw new OfferError(403, "Approved KYC is required to send messages");

    const stored = new Map(thread.messages.map(message => [String(message._id), message]));
    const missing = pending.filter(message => {
      const existing = stored.get(String(message._id));
      if (existing && existing.text !== message.text) throw new OfferError(409, "Message key already used");
      return !existing;
    });
    if (missing.length) {
      if (thread.count + missing.length > 1000) throw new OfferError(409, "Conversation message limit reached");
      const updated = await Inquiry.updateOne({ _id: inquiryId, staffId: thread.staffId,
        "messages._id": { $nin: missing.map(message => message._id) },
        [`messages.${1000 - missing.length}`]: { $exists: false } },
        { $push: { messages: { $each: missing } }, $set: { staffId: staff._id },
          ...(String(thread.staffId) === String(staff._id) ? {} : { $unset: { staffReadAt: 1 } }) },
        { runValidators: true });
      if (!updated.matchedCount) continue;
      const recipient = buyer ? staff._id : thread.buyerId;
      wakeChat(String(inquiryId), String(recipient));
      void Notification.insertMany(missing.map(message => ({
        recipient, title: chatNotificationTitle(req.account?.name), body: "You have a new property message.",
        messageId: message._id, data: { kind: "inquiry", id: String(inquiryId) },
      }))).catch(error => console.warn("[messaging] Notification queue error:", error?.name));
    }
    return { _id: inquiryId, messages: pending.map(message => stored.get(String(message._id)) ?? message), maxBatch: 8 };
  }
  throw new OfferError(409, "Conversation changed. Retry your message");
}

messaging.post("/:id/message", async (req: AuthRequest, res) => {
  try {
    return res.json(await appendMessages(req, parseItems(req.body ?? {})));
  } catch (error) { return respondError(error, res); }
});

messaging.post("/:id/read", async (req: AuthRequest, res) => {
  try {
    const value = req.body?.through;
    const through = new Date(value);
    if (typeof value !== "string" || !Number.isFinite(through.getTime()) || through.getTime() > Date.now())
      throw new OfferError(400, "Invalid read timestamp");
    const buyer = res.locals.inquiryBuyer;
    const field = buyer ? "buyerReadAt" : "staffReadAt";
    const updated = await Inquiry.updateOne({ _id: req.params.id, [buyer ? "buyerId" : "staffId"]: req.user!.id,
      $or: [{ [field]: null }, { [field]: { $lt: through } }] },
      { $max: { [field]: through } }, { timestamps: false });
    if (updated.modifiedCount) wakeChat(req.params.id.toLowerCase(), res.locals.chatPeer);
    // Also mark notifications read for this inquiry so badge counts update instantly
    void Notification.updateMany(
      { recipient: req.user!.id, "data.kind": "inquiry", "data.id": req.params.id, readAt: null },
      { $set: { readAt: through } }
    ).catch(() => {});
    return res.json({ success: true });
  } catch (error) { return respondError(error, res); }
});
