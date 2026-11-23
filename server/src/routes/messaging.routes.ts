import { Router, Response } from "express";
import { createHash } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware";
import { Inquiry } from "../models/Inquiry.model";
import { Property } from "../models/Property.model";
import { Notification } from "../models/Notification.model";
import { User } from "../models/User.model";
import { assignedStaff, OfferError } from "../services/marketplace";
import { identityApproved } from "../services/security";
import { chatNotificationTitle } from "../services/notificationMessage";

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
    const end = { $min: [Number(cursor ?? 0), { $max: [0, { $subtract: ["$count", previewSize] }] }] };
    const [page] = await Inquiry.aggregate([
      { $match: { _id: id, $or: [{ buyerId: account }, { staffId: account }] } },
      { $set: { count: { $size: { $ifNull: ["$messages", []] } } } },
      { $set: { end } },
      { $set: { start: { $max: [0, { $subtract: ["$end", historySize] }] } } },
      { $project: {
        messages: cursor === undefined ? { $slice: [{ $ifNull: ["$messages", []] }, -previewSize] } :
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
    const tag = '"' + createHash("sha256").update(JSON.stringify(result)).digest("base64url") + '"';
    res.setHeader("ETag", tag);
    if (req.headers["if-none-match"] === tag) return res.status(304).end();
    return res.json(result);
  } catch (error) { return respondError(error, res); }
});

messaging.post("/:id/message", async (req: AuthRequest, res) => {
  try {
    const actor = req.user!.id;
    const { text, clientMessageId } = req.body ?? {};
    if (typeof text !== "string" || !text.trim() || text.length > 5000)
      throw new OfferError(400, "Enter a message between 1 and 5000 characters");
    if (clientMessageId !== undefined && (typeof clientMessageId !== "string" || !/^[\w-]{16,80}$/.test(clientMessageId)))
      throw new OfferError(400, "Invalid message key");
    const messageId = clientMessageId ? new Types.ObjectId(createHash("sha256")
      .update([req.params.id, actor, clientMessageId].join("/")).digest().subarray(0, 12)) : new Types.ObjectId();

    const thread = await Inquiry.findOne({ _id: req.params.id, staffId: { $exists: true } })
      .select({ buyerId: 1, staffId: 1, propertyId: 1, messages: { $elemMatch: { _id: messageId } } })
      .lean();
    if (!thread) throw new OfferError(404, "Conversation not found");

    const listing = await Property.findById(thread.propertyId).select("status assignedAdvisorId assignedVerifierId").lean();
    if (!listing || listing.status !== "verified") throw new OfferError(409, "Property unavailable. Conversation is read-only");

    const staff = await assignedStaff(listing);
    const buyer = String(thread.buyerId) === actor;
    if (!buyer && String(staff._id) !== actor) throw new OfferError(403, "Not assigned to this property");

    if (buyer) {
      const user = await User.findById(actor).select("isVerifiedIdentity demoKycComplete").lean();
      if (!user || !identityApproved(user)) throw new OfferError(403, "Approved KYC is required to send messages");
    }

    if (thread.messages?.length) {
      if (thread.messages[0].text !== text.trim()) throw new OfferError(409, "Message key already used");
      return res.json(await Inquiry.findById(thread._id).select({ messages: { $elemMatch: { _id: messageId } } }).lean());
    }

    const message = { _id: messageId, senderId: actor, text: text.trim(), createdAt: new Date() };
    const updated = await Inquiry.findOneAndUpdate({ _id: thread._id, "messages.999": { $exists: false } },
      { $push: { messages: message }, $set: { staffId: staff._id },
        ...(String(thread.staffId) === String(staff._id) ? {} : { $unset: { staffReadAt: 1 } }) },
      { new: true, runValidators: true }).select({ messages: { $slice: -1 } }).lean();

    if (!updated) throw new OfferError(409, "Conversation message limit reached");

    // Queue push notification non-blockingly
    void Notification.create([{
      recipient: buyer ? staff._id : thread.buyerId,
      title: chatNotificationTitle(req.account?.name),
      body: "You have a new property message.",
      messageId,
      data: { kind: "inquiry", id: String(thread._id) }
    }]).catch(err => {
      console.warn("[messaging] Notification queue error:", err?.message || err);
    });

    return res.json(updated);
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
    await Inquiry.updateOne({ _id: req.params.id, [buyer ? "buyerId" : "staffId"]: req.user!.id,
      $or: [{ [field]: null }, { [field]: { $lt: through } }] },
      { $max: { [field]: through } }, { timestamps: false });
    // Also mark notifications read for this inquiry so badge counts update instantly
    void Notification.updateMany(
      { recipient: req.user!.id, "data.kind": "inquiry", "data.id": req.params.id, readAt: null },
      { $set: { readAt: through } }
    ).catch(() => {});
    return res.json({ success: true });
  } catch (error) { return respondError(error, res); }
});
