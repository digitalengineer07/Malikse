import express from "express";
import { Inquiry } from "../models/Inquiry.model";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";
import { OfferError, offerProperty } from "../services/marketplace";
import { isValidObjectId } from "mongoose";

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

// Get sent inquiries (Buyer view)
router.get("/sent", authGuard, async (req: AuthRequest, res) => {
  try {
    const inquiries = await Inquiry.find({ buyerId: req.user?.id })
      .populate("propertyId", "title price media status location")
      .populate("sellerId", "name")
      .sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get received inquiries (Seller view)
router.get("/received", authGuard, async (req: AuthRequest, res) => {
  try {
    const inquiries = await Inquiry.find({ sellerId: req.user?.id })
      .populate("propertyId", "title price media status location")
      .populate("buyerId", "name")
      .sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
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
    );

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

    const inquiry = await Inquiry.findOne({
      _id: req.params.id,
      $or: [{ buyerId: req.user?.id }, { sellerId: req.user?.id }],
    });

    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });

    inquiry.messages.push({
      senderId: req.user!.id,
      text: text.trim(),
      createdAt: new Date(),
    });

    await inquiry.save();
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
    const inquiry = await Inquiry.findOne({ _id: req.params.id, $or: [{ buyerId: req.user!.id }, { sellerId: req.user!.id }] });
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    const field = inquiry.buyerId.toString() === req.user!.id ? "buyerReadAt" : "sellerReadAt";
    await Inquiry.updateOne({ _id: inquiry._id }, { $max: { [field]: through } }, { timestamps: false });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Could not mark messages as read" }); }
});

export default router;
