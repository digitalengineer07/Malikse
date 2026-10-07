import { Router } from "express";
import multer from "multer";
import { storePropertyPhoto, discardPropertyPhoto } from "../services/propertyPhotos";
import { isValidObjectId } from "mongoose";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { authGuard, roleGuard } from "../middleware/auth.middleware";
import { availableStaff, canReadProperty, historyEvent, listingFields, publicFields, transition, validateListing } from "../services/propertyWorkflow";

const router = Router();
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
router.param("id", (_req, res, next, id) => isValidObjectId(id) ? next() : res.status(400).json({ message: "Invalid property ID" }));

router.get("/search", async (req, res) => {
  try {
    const { location, type } = req.query;
    const query: any = { status: "verified", "badges.fullyVerified": true, "advisorReview.decision": "approve", "verifierReview.decision": "approve" };
    if (typeof location === "string" && location.trim()) {
      const pattern = new RegExp(location.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ "location.state": pattern }, { "location.district": pattern }, { title: pattern }];
    }
    if (type) query.type = type;
    const min = req.query.minPrice ?? req.query.budgetMin;
    const max = req.query.maxPrice ?? req.query.budgetMax;
    if (min !== undefined || max !== undefined) {
      if ((min !== undefined && (!Number.isFinite(Number(min)) || Number(min) < 0)) || (max !== undefined && (!Number.isFinite(Number(max)) || Number(max) < 0))) return res.status(400).json({ message: "Invalid price filter" });
      query.price = { ...(min !== undefined ? { $gte: Number(min) } : {}), ...(max !== undefined ? { $lte: Number(max) } : {}) };
    }
    res.json(await Property.find(query).select(publicFields).sort("-createdAt"));
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get("/mine", authGuard, roleGuard("user"), async (req: any, res) => {
  try { res.json(await Property.find({ ownerId: req.user.id }).sort("-createdAt")); }
  catch (error: any) { res.status(500).json({ message: error.message }); }
});

router.get("/:id/workspace", authGuard, async (req: any, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (!canReadProperty(property, req.user)) return res.status(403).json({ message: "This property is not assigned to you" });
    await property.populate([{ path: "ownerId", select: "name mobile" }, { path: "assignedAdvisorId", select: "name" }, { path: "assignedVerifierId", select: "name" }]);
    res.json(property);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, status: "verified", "badges.fullyVerified": true, "advisorReview.decision": "approve", "verifierReview.decision": "approve" }).select(publicFields);
    if (!property) return res.status(404).json({ message: "Published property not found" });
    res.json(property);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.post("/", authGuard, roleGuard("user"), async (req: any, res) => {
  try {
    const seller = await User.findById(req.user.id);
    if (!seller?.demoKycComplete) return res.status(403).json({ message: "Complete demo KYC before listing" });
    const data = listingFields(req.body);
    const error = validateListing(data);
    if (error) return res.status(400).json({ message: error });
    const property = await Property.create({ ...data, ownerId: req.user.id, status: "draft", verificationHistory: [historyEvent(req.user, "draft", "draft", "draft_created")] });
    res.status(201).json(property);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.patch("/:id", authGuard, roleGuard("user"), async (req: any, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (!["draft", "correction_required"].includes(property.status)) return res.status(409).json({ message: "Only drafts or properties awaiting corrections can be edited" });
    const changes = listingFields(req.body);
    const error = validateListing({ ...property.toObject(), ...changes });
    if (error) return res.status(400).json({ message: error });
    const updated = await transition(property, changes, historyEvent(req.user, property.status, property.status, "seller_edited"));
    if (!updated) return res.status(409).json({ message: "Property changed. Reload and try again" });
    res.json(updated);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.post("/:id/submit", authGuard, roleGuard("user"), async (req: any, res) => {
  try {
    const seller = await User.findById(req.user.id);
    if (!seller?.demoKycComplete) return res.status(403).json({ message: "Complete demo KYC first" });
    const property = await Property.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (!["draft", "correction_required"].includes(property.status)) return res.status(409).json({ message: "Property has already been submitted or cannot be resubmitted" });
    if (req.body.consent !== true) return res.status(400).json({ message: "Accept the seller declaration before submitting" });
    const error = validateListing(property);
    if (error) return res.status(400).json({ message: error });
    if (!property.media?.photos?.length) return res.status(400).json({ message: "Upload at least one property photo before submitting" });
    const advisorId = property.assignedAdvisorId || await availableStaff("advisor");
    const result = await transition(property, { status: "pending", assignedAdvisorId: advisorId || null, assignedVerifierId: null, advisorReview: null, verifierReview: null, rejectionReason: "", badges: { identityVerified: false, documentsChecked: false, siteVisited: false, lawyerReviewed: false, fullyVerified: false } }, historyEvent(req.user, property.status, "pending", "submitted", { assignedAdvisorId: advisorId, consent: true }));
    if (!result) return res.status(409).json({ message: "Property changed. Reload and try again" });
    res.json(result);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});
router.post("/:id/photos", authGuard, roleGuard("user"), async (req: any, res, next) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] } });
    if (!property) return res.status(403).json({ message: "Upload photos only to your draft or correction request" });
    next();
  } catch { res.status(500).json({ message: "Could not check property access" }); }
}, (req: any, res) => {
  photoUpload.single("file")(req, res, async error => {
    if (error) return res.status(400).json({ message: "Choose one image under 10 MB" });
    let filename: string | undefined;
    let retained = false;
    try {
      if (!req.file) return res.status(400).json({ message: "Select a photo to upload" });
      filename = await storePropertyPhoto(req.file.buffer);
      const origin = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`;
      const url = `${origin.replace(/\/$/, "")}/property-photos/${filename}`;
      const property = await Property.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] }, "media.photos.9": { $exists: false } }, { $push: { "media.photos": url }, $inc: { __v: 1 } }, { new: true });
      if (!property) return res.status(409).json({ message: "Property changed or already has 10 photos. Reload and try again." });
      retained = true;
      res.status(201).json({ url });
    } catch (cause: any) { res.status(400).json({ message: cause.message || "Could not upload photo" }); }
    finally { if (filename && !retained) await discardPropertyPhoto(filename); }
  });
});
export default router;
