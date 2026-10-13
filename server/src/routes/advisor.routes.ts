import { readPage, listFields } from "../services/pagination";
import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Property } from "../models/Property.model";
import { authGuard, roleGuard } from "../middleware/auth.middleware";
import { availableStaff, historyEvent, transition } from "../services/propertyWorkflow";

const router = Router();
router.use(authGuard, roleGuard("advisor", "verifier"));
router.param("propertyId", (_req, res, next, id) => isValidObjectId(id) ? next() : res.status(400).json({ message: "Invalid property ID" }));

router.get("/my-tasks", async (req: any, res) => {
  try {
    const advisor = req.user.role === "advisor";
    const field = advisor ? "assignedAdvisorId" : "assignedVerifierId";
    const pending = advisor ? "pending" : "advisor_verified";

    // Exclude suspended users
    const { User } = require("../models/User.model");
    const suspendedUsers = await User.find({ isSuspended: true }).select('_id');
    const suspendedUserIds = suspendedUsers.map((u: any) => u._id);
    const filter: any = {};
    if (suspendedUserIds.length > 0) filter.ownerId = { $nin: suspendedUserIds };

    // Queue summaries never expose owner contact details before assignment.
    const rows = await readPage(Property.find({ ...filter, $or: [{ [field]: req.user.id }, { [field]: null, status: pending }] }).select(listFields), req, res);
    for (const row of rows) if (!row[field]) {
      for (const key of Object.keys(row)) if (!["_id", "title", "type", "location", "status", "totalArea", "price", "createdAt"].includes(key)) delete row[key];
    }
    res.json(rows);
  } catch (error: any) { res.status(500).json({ message: "An unexpected server error occurred" }); }
});

router.post("/:propertyId/claim", async (req: any, res) => {
  try {
    const advisor = req.user.role === "advisor";
    const field = advisor ? "assignedAdvisorId" : "assignedVerifierId";
    const status = advisor ? "pending" : "advisor_verified";
    const property = await Property.findOneAndUpdate({ _id: req.params.propertyId, status, [field]: null }, { $set: { [field]: req.user.id }, $inc: { __v: 1 }, $push: { verificationHistory: historyEvent(req.user, status, status, "claimed") } }, { new: true });
    if (!property) return res.status(409).json({ message: "This property was assigned or has moved to another stage. Refresh the queue" });
    res.json(property);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.post("/:propertyId/report", async (req: any, res) => {
  try {
    const advisor = req.user.role === "advisor";
    const field = advisor ? "assignedAdvisorId" : "assignedVerifierId";
    const expected = advisor ? "pending" : "advisor_verified";
    const property = await Property.findById(req.params.propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (property[field]?.toString() !== req.user.id) return res.status(403).json({ message: "Not assigned to this property" });
    if (property.status !== expected) return res.status(409).json({ message: "This review stage has already finished or is not ready" });
    if (!advisor && (property.advisorReview?.decision !== "approve" || property.advisorReview?.actorId === req.user.id)) return res.status(409).json({ message: "A different Advisor must approve the property first" });
    const { decision, notes, signature, checklist, gpsCheckIn } = req.body;
    if (!["approve", "correction", "reject"].includes(decision)) return res.status(400).json({ message: "Choose approve, correction or reject" });
    if (typeof notes !== "string" || notes.trim().length < 5 || notes.length > 5000 || typeof signature !== "string" || signature.trim().length < 2 || signature.length > 200) return res.status(400).json({ message: "Add report notes/reason and your name as a signature" });
    const keys = advisor ? ["ownership", "location", "boundaries", "area", "disclosures", "documentsReviewed"] : ["advisorReport", "ownership", "location", "boundaries", "area", "disclosures", "documentsReviewed"];
    if (decision === "approve" && keys.some(key => checklist?.[key] !== true)) return res.status(400).json({ message: "Complete all review checks before approval (documents are optional, review any that are available)" });
    if (gpsCheckIn && (!Number.isFinite(gpsCheckIn.lat) || Math.abs(gpsCheckIn.lat) > 90 || !Number.isFinite(gpsCheckIn.lng) || Math.abs(gpsCheckIn.lng) > 180)) return res.status(400).json({ message: "Invalid site check-in coordinates" });
    const report = { actorId: req.user.id, role: req.user.role, decision, notes: notes.trim(), signature: signature.trim(), checklist: Object.fromEntries(keys.map(key => [key, checklist?.[key] === true])), gpsCheckIn: gpsCheckIn ? { lat: gpsCheckIn.lat, lng: gpsCheckIn.lng, timestamp: new Date() } : undefined, submittedAt: new Date() };
    const status = decision === "approve" ? advisor ? "advisor_verified" : "verified" : decision === "correction" ? "correction_required" : "rejected";
    const changes: any = { status, [advisor ? "advisorReview" : "verifierReview"]: report, rejectionReason: decision === "approve" ? "" : notes.trim(), "badges.fullyVerified": status === "verified" };
    if (advisor && decision === "approve") {
      changes.assignedVerifierId = await availableStaff("verifier") || null;
      changes["badges.documentsChecked"] = property.documents.length > 0 && checklist.documentsReviewed === true;
      changes["badges.siteVisited"] = !!gpsCheckIn;
    }
    const updated = await transition(property, changes, historyEvent(req.user, property.status, status, decision, { report }));
    if (!updated) return res.status(409).json({ message: "Another update was saved. Reload this property" });
    res.json(updated);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});
export default router;
