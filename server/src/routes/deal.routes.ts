import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Deal } from "../models/Deal.model";
import { publicFields } from "../services/propertyWorkflow";
import { OfferError, offerProperty } from "../services/marketplace";

import { authGuard, roleGuard } from "../middleware/auth.middleware";

const router = Router();
router.param("id", (_req, res, next, id) => isValidObjectId(id) ? next() : res.status(400).json({ message: "Invalid deal ID" }));

// POST /deals/:propertyId/offer (Buyer)
router.post("/:propertyId/offer", authGuard, roleGuard("user"), async (req: any, res) => {
  try {
    const { amount } = req.body;
    if (amount === undefined) return res.status(400).json({ message: "Enter a positive offer amount" });
    const propertyId = req.params.propertyId;
    const property = await offerProperty(req.user.id, propertyId, amount);
    const commissionAmount = amount * 0.0118; // 1% + 18% GST

    const deal = new Deal({
      propertyId,
      buyerId: req.user.id,
      ownerId: property.ownerId,
      offerAmount: amount,
      commissionAmount,
      status: "offered"
    });

    await deal.save();
    res.status(201).json(deal);
  } catch (error: any) {
    res.status(error instanceof OfferError ? error.status : 500).json({ message: error instanceof OfferError ? error.message : "An unexpected server error occurred" });
  }
});

// GET /deals/:id
router.get("/:id", authGuard, async (req: any, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    const owner = deal.ownerId.toString() === req.user.id;
    if (deal.buyerId.toString() !== req.user.id && !owner && req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized" });
    await deal.populate([
      { path: "propertyId", ...(!owner && req.user.role !== "admin" ? { select: publicFields } : {}) },
      { path: "buyerId", select: "name" }, { path: "ownerId", select: "name" },
    ]);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ message: "An unexpected server error occurred" });
  }
});

// PATCH /deals/:id/status
router.patch("/:id/status", authGuard, async (req: any, res) => {
  try {
    const { status } = req.body;
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    
    const transitions: Record<string, string[]> = {
      offered: ["accepted", "rejected", "countered", "cancelled"],
      countered: ["accepted", "rejected", "cancelled"],
      accepted: ["token_paid", "cancelled"], token_paid: ["completed", "cancelled"],
      completed: [], cancelled: [], rejected: [],
    };
    const ownerAction = deal.ownerId.toString() === req.user.id && ["accepted", "rejected", "countered"].includes(status);
    if (!ownerAction && req.user.role !== "admin") return res.status(403).json({ message: "Unauthorized to change status" });
    if (!transitions[deal.status]?.includes(status)) return res.status(409).json({ message: "This deal cannot move to that status" });
    const changes: any = { status };
    if (status === "countered") {
      const amount = req.body.counterAmount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Enter a positive counter amount" });
      changes.counterAmount = amount;
    }
    if (status === "accepted" && deal.counterAmount) changes.commissionAmount = deal.counterAmount * 0.0118;
    const updated = await Deal.findOneAndUpdate({ _id: deal._id, status: deal.status, __v: deal.__v }, { $set: changes, $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ message: "Deal changed. Reload and try again" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: "An unexpected server error occurred" });
  }
});

export default router;
