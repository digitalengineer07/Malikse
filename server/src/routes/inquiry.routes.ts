import express from "express";
import { Inquiry } from "../models/Inquiry.model";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";
import { OfferError, offerProperty } from "../services/marketplace";
import { isValidObjectId, Types, PipelineStage } from "mongoose";
import { pageInput, cursorFor } from "../services/pagination";
import { replicaReadPreference } from "../services/readReplica";
import { sendPush } from "../services/pushNotifications";

const router = express.Router();
router.param("id", (_req, res, next, id) => isValidObjectId(id) ? next() : res.status(400).json({ error: "Invalid inquiry ID" }));

// Submit an offer / contact seller
router.post("/", authGuard, async (req: AuthRequest, res) => {
  try {
    const { propertyId, message, offerAmount } = req.body;
    
    const property = await offerProperty(req.user!.id, propertyId, offerAmount);
    if (typeof message !== "string" || !message.trim() || message.length > 5000) return res.status(400).json({ error: "Enter a message between 1 and 5000 characters" });

    const inquiry = await Inquiry.create({
      propertyId,
      buyerId: req.user?.id,
      sellerId: property.ownerId,
      message: message.trim(),
      offerAmount,
      buyerReadAt: new Date(),
    });

    res.status(201).json(inquiry);
    sendPush(property.ownerId.toString(), "New property inquiry", "Someone sent an inquiry about your property.", { kind: "inquiry", id: inquiry._id.toString() });
  } catch (err) {
    res.status(err instanceof OfferError ? err.status : 500).json({ error: err instanceof OfferError ? err.message : "Server error" });
  }
});

// Lists include one preview message; full history is fetched only for an open chat.
for (const [route, party, other] of [["/", "both", "both"], ["/sent", "buyerId", "sellerId"], ["/received", "sellerId", "buyerId"]]) {
  router.get(route, authGuard, async (req: AuthRequest, res) => {
    try {
      const { limit, filter } = pageInput(req.query);
      const actor = new Types.ObjectId(req.user!.id);
      const membership = party === "both" ? { $or: [{ buyerId: actor }, { sellerId: actor }] } : { [party]: actor };
      // The first six conversations are always read from the primary. The
      // boundary comes from the primary too, so a secondary never serves them.
      const newest = await Inquiry.find(membership).select("_id createdAt").sort({ createdAt: -1, _id: -1 }).limit(6).lean();
      const primaryIds = newest.map(row => row._id);
      const pipeline = (match: object, count: number): PipelineStage[] => [
        { $match: match }, { $sort: { createdAt: -1, _id: -1 } }, { $limit: count },
        { $addFields: { unread: { $gt: [
          { $max: [{ $cond: [{ $eq: ["$sellerId", actor] }, "$createdAt", new Date(0)] }, { $max: { $map: { input: { $filter: { input: "$messages", as: "m", cond: { $ne: ["$$m.senderId", actor] } } }, as: "m", in: "$$m.createdAt" } } }] },
          { $ifNull: [{ $cond: [{ $eq: ["$buyerId", actor] }, "$buyerReadAt", "$sellerReadAt"] }, new Date(0)] }
        ] } } },
        { $set: { messages: { $slice: ["$messages", -1] } } },
      ];
      const primaryRows = await Inquiry.aggregate(pipeline({ $and: [membership, filter, { _id: { $in: primaryIds } }] }, limit + 1)).option({ maxTimeMS: 5000 });
      let rows = primaryRows;
      if (newest.length === 6 && rows.length <= limit) {
        const boundary = newest[5];
        const older = { $or: [{ createdAt: { $lt: boundary.createdAt } }, { createdAt: boundary.createdAt, _id: { $lt: boundary._id } }] };
        const replicaRows = await Inquiry.aggregate(pipeline({ $and: [membership, filter, older] }, limit + 1 - rows.length))
          .read(replicaReadPreference()).option({ maxTimeMS: 5000 });
        rows = [...rows, ...replicaRows];
      }
      res.setHeader("X-Next-Cursor", rows.length > limit ? cursorFor(rows[limit - 1]) : "");
      const items = rows.slice(0, limit);
      const populate = (subset: any[], readPreference: "primary" | "secondary") => Inquiry.populate(subset, [
        { path: "propertyId", select: "title price status location", options: { readPreference } },
        { path: "buyerId", select: "name", options: { readPreference } },
        { path: "sellerId", select: "name", options: { readPreference } },
      ]);
      await populate(items.slice(0, Math.min(primaryRows.length, limit)), "primary");
      await populate(items.slice(primaryRows.length), replicaReadPreference());
      res.json(items);
    } catch { res.status(500).json({ error: "Could not load conversations" }); }
  });
}

router.get("/:id", authGuard, async (req: AuthRequest, res) => {
  try {
    const inquiry = await Inquiry.findOne({
      _id: req.params.id,
      $or: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }],
    }).select({ messages: { $slice: -1 } }).populate([
      { path: "propertyId", select: "title price status location" },
      { path: "buyerId", select: "name" },
      { path: "sellerId", select: "name" },
    ]).lean();
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    res.json(inquiry);
  } catch { res.status(500).json({ error: "Could not load inquiry" }); }
});

router.get("/:id/messages", authGuard, async (req: AuthRequest, res) => {
  try {
    const before = req.query.before === undefined ? undefined : Number(req.query.before);
    if (before !== undefined && (!Number.isInteger(before) || before < 0)) return res.status(400).json({ error: "Invalid message cursor" });
    const filter = { _id: new Types.ObjectId(req.params.id), $or: [{ buyerId: new Types.ObjectId(req.user!.id) }, { sellerId: new Types.ObjectId(req.user!.id) }] };
    // Count and latest six come from the primary, so a newly sent message is
    // visible immediately. Older pages are served from a secondary.
    const latest = await Inquiry.aggregate([
      { $match: filter },
      { $project: { total: { $size: "$messages" }, messages: { $slice: ["$messages", -6] } } },
    ]).option({ maxTimeMS: 5000 });
    if (!latest.length) return res.status(404).json({ error: "Inquiry not found" });
    const total = latest[0].total as number;
    if (before === undefined) return res.json({ messages: latest[0].messages, nextBefore: total > 6 ? total - 6 : null });
    const end = Math.min(before, Math.max(0, total - 6));
    const start = Math.max(0, end - 50);
    const rows = await Inquiry.aggregate([
      { $match: filter },
      { $project: { messages: { $cond: [{ $gt: [end, 0] }, { $slice: ["$messages", start, end - start] }, []] } } },
    ]).read(replicaReadPreference()).option({ maxTimeMS: 5000 });
    if (!rows.length || rows[0].messages.length !== end - start) {
      res.setHeader("Retry-After", "1");
      return res.status(503).json({ error: "Messages are still syncing. Please try again." });
    }
    res.json({ messages: rows[0]?.messages || [], nextBefore: start > 0 ? start : null });
  } catch { res.status(500).json({ error: "Could not load messages" }); }
});

// Reply/update inquiry status (Seller view)
router.put("/:id/status", authGuard, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "accepted", "rejected", "countered"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const inquiry = await Inquiry.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.user?.id },
      { $set: { status } },
      { new: true }
    ).select({ messages: { $slice: -1 } }).lean();

    if (!inquiry) return res.status(404).json({ error: "Inquiry not found or unauthorized" });
    res.json(inquiry);
    sendPush(inquiry.buyerId.toString(), "Inquiry update", `Your inquiry was ${status}.`, { kind: "inquiry", id: inquiry._id.toString() });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Send a message on an inquiry
router.post("/:id/message", authGuard, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== "string" || !text.trim() || text.length > 5000) return res.status(400).json({ error: "Enter a message between 1 and 5000 characters" });

    const inquiry = await Inquiry.findOneAndUpdate({
      _id: req.params.id,
      $or: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }],
      "messages.999": { $exists: false },
    }, { $push: { messages: { senderId: req.user!.id, text: text.trim(), createdAt: new Date() } } }, { new: true, runValidators: true })
      .select({ messages: { $slice: -1 } }).lean();
    if (!inquiry) return res.status(409).json({ error: "Conversation unavailable or its 1,000-message limit has been reached" });

    res.json(inquiry);
    const recipientId = inquiry.buyerId.toString() === req.user!.id ? inquiry.sellerId : inquiry.buyerId;
    sendPush(recipientId.toString(), "New message", "You have a new inquiry message.", { kind: "inquiry", id: inquiry._id.toString() });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// A client acknowledges only the activity it has actually displayed.
router.post("/:id/read", authGuard, async (req: AuthRequest, res) => {
  try {
    const through = new Date(req.body.through);
    if (typeof req.body.through !== "string" || !Number.isFinite(through.getTime()) || through.getTime() > Date.now()) return res.status(400).json({ error: "Invalid read timestamp" });
    const inquiry = await Inquiry.findOne({ _id: req.params.id, $or: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] }).select("buyerId sellerId").lean();
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    const field = inquiry.buyerId.toString() === req.user!.id ? "buyerReadAt" : "sellerReadAt";
    await Inquiry.updateOne({ _id: inquiry._id }, { $max: { [field]: through } }, { timestamps: false });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Could not mark messages as read" }); }
});

export default router;
