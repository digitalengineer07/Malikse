import express from "express";
import { Inquiry } from "../models/Inquiry.model";
import { Property } from "../models/Property.model";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";

const router = express.Router();

// Submit an offer / contact seller
router.post("/", authGuard, async (req: AuthRequest, res) => {
  try {
    const { propertyId, message, offerAmount } = req.body;
    
    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ error: "Property not found" });

    if (property.ownerId.toString() === req.user?.id) {
      return res.status(400).json({ error: "You cannot inquire about your own property" });
    }

    const inquiry = await Inquiry.create({
      propertyId,
      buyerId: req.user?.id,
      sellerId: property.ownerId,
      message,
      offerAmount,
    });

    res.status(201).json(inquiry);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get sent inquiries (Buyer view)
router.get("/sent", authGuard, async (req: AuthRequest, res) => {
  try {
    const inquiries = await Inquiry.find({ buyerId: req.user?.id })
      .populate("propertyId", "title price media status location")
      .populate("sellerId", "name mobile")
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
      .populate("buyerId", "name mobile")
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
    if (!text) return res.status(400).json({ error: "Text is required" });

    const inquiry = await Inquiry.findOne({
      _id: req.params.id,
      $or: [{ buyerId: req.user?.id }, { sellerId: req.user?.id }],
    });

    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });

    inquiry.messages.push({
      senderId: req.user!.id,
      text,
      createdAt: new Date(),
    });

    await inquiry.save();
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
