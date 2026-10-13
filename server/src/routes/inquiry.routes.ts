import express from "express";
import { Inquiry } from "../models/Inquiry.model";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";
import { OfferError, offerProperty } from "../services/marketplace";
import { isValidObjectId, Types } from "mongoose";
import { pageInput, cursorFor } from "../services/pagination";

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
      const rows = await Inquiry.aggregate([
        { $match: { $and: [party === "both" ? { $or: [{ buyerId: actor }, { sellerId: actor }] } : { [party]: actor }, filter] } }, { $sort: { createdAt: -1, _id: -1 } }, { $limit: limit + 1 },
        { $addFields: { unread: { $gt: [
          { $max: [{ $cond: [{ $eq: ["$sellerId", actor] }, "$createdAt", new Date(0)] }, { $max: { $map: { input: { $filter: { input: "$messages", as: "m", cond: { $ne: ["$$m.senderId", actor] } } }, as: "m", in: "$$m.createdAt" } } }] },
          { $ifNull: [{ $cond: [{ $eq: ["$buyerId", actor] }, "$buyerReadAt", "$sellerReadAt"] }, new Date(0)] }
        ] } } },
        { $set: { messages: { $slice: ["$messages", -1] } } },
      ]).option({ maxTimeMS: 5000 });
      res.setHeader("X-Next-Cursor", rows.length > limit ? cursorFor(rows[limit - 1]) : "");
      const items = rows.slice(0, limit);
      await Inquiry.populate(items, [{ path: "propertyId", select: "title price status location" }, { path: "buyerId", select: "name" }, { path: "sellerId", select: "name" }]);
      res.json(items);
    } catch { res.status(500).json({ error: "Could not load conversations" }); }
  });
}

router.get("/:id/messages", authGuard, async (req: AuthRequest, res) => {
  try {
    const before = req.query.before === undefined ? undefined : Number(req.query.before);
    if (before !== undefined && (!Number.isInteger(before) || before < 0)) return res.status(400).json({ error: "Invalid message cursor" });
    const filter = { _id: new Types.ObjectId(req.params.id), $or: [{ buyerId: new Types.ObjectId(req.user!.id) }, { sellerId: new Types.ObjectId(req.user!.id) }] };
    const rows = await Inquiry.aggregate([
      { $match: filter },
      { $set: { end: { $min: [before ?? 2147483647, { $size: "$messages" }] } } },
      { $set: { start: { $max: [0, { $subtract: ["$end", 50] }] } } },
      { $project: { messages: { $cond: [{ $gt: ["$end", 0] }, { $slice: ["$messages", "$start", { $subtract: ["$end", "$start"] }] }, []] }, nextBefore: { $cond: [{ $gt: ["$start", 0] }, "$start", null] } } },
    ]).option({ maxTimeMS: 5000 });
    if (!rows.length) return res.status(404).json({ error: "Inquiry not found" });
    res.json(rows[0]);
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
