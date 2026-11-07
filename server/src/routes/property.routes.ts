import { identityApproved } from "../services/security";
import { Router } from "express";
import { isValidObjectId } from "mongoose";
import multer from "multer";
import { authGuard, roleGuard } from "../middleware/auth.middleware";
import { uploadCapacity } from "../middleware/uploadCapacity";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { listFields, readPage } from "../services/pagination";
import { discardPropertyPhoto, storePropertyPhoto } from "../services/propertyPhotos";
import { activeStaffFilter, canReadProperty, historyEvent, listingFields, mediaInputError, publicFields, transition, validateListing } from "../services/propertyWorkflow";

import { publishedFilter } from "../services/marketplace";
import { apiOrigin } from "../services/security";

import { locationSuggestions } from "../services/propertyLocationSuggestions";
import { regionCounts } from "../services/propertyRegions";
import { getPublicSearchResponse } from "../services/propertySearch";
import { publicResponse, sendPublicResponse } from "../services/publicResponseCache";
import { enqueueSubmission } from "../services/submissionQueue";
import { replicaReadPreference } from "../services/readReplica";

const router = Router();
async function restoreUploadedPhoto(id: string, ownerId: string, url: string) {
  const result = await Property.updateOne({ _id: id, ownerId, status: { $in: ["draft", "correction_required"] },
    $or: [{ "media.photos": url }, { "media.photos.9": { $exists: false } }],
  }, { $addToSet: { "media.photos": url }, $inc: { __v: 1 } });
  return result.matchedCount > 0;
}
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
router.param("id", (_req, res, next, id) => isValidObjectId(id) ? next() : res.status(400).json({ message: "Invalid property ID" }));

router.get("/regions/suggest", async (req, res) => {
  try { sendPublicResponse(req, res, await locationSuggestions(req.query)); }
  catch (error: any) {
    const unavailable = error.status === 503 || error.code === 50 || /Mongo|Mongoose/.test(error.name || "");
    if (unavailable) res.setHeader("Retry-After", "1");
    res.status(unavailable ? 503 : 400).json({ message: unavailable ? "Address search is busy. Please try again shortly." : error.message });
  }
});

router.get("/regions", async (req, res) => {
  try { sendPublicResponse(req, res, await regionCounts(req.query)); }
  catch (error: any) {
    const unavailable = error.status === 503 || error.code === 50 || /Mongo|Mongoose/.test(error.name || "");
    if (unavailable) res.setHeader("Retry-After", "1");
    res.status(unavailable ? 503 : 400).json({ message: unavailable ? "Area counts are busy. Please try again shortly." : error.message });
  }
});

router.get("/search", async (req, res) => {
  try {
    sendPublicResponse(req, res, await getPublicSearchResponse(req.query));
  } catch (error: any) {
    const unavailable = error.status === 503 || error.code === 50 || /Mongo|MongooseServerSelection/.test(error.name || "");
    if (unavailable) res.setHeader("Retry-After", "1");
    res.status(unavailable ? 503 : 400).json({ message: unavailable ? "Search is busy. Please try again shortly." : error.message });
  }
});

router.get("/mine", authGuard, roleGuard("user"), async (req: any, res) => {
  try { res.json(await readPage(Property.find({ ownerId: req.user.id }).select(listFields).read(replicaReadPreference()), req, res)); }
  catch (error: any) { res.status(500).json({ message: "An unexpected server error occurred" }); }
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
    const response = await publicResponse({ db: Property.db.name, kind: "detail", id: req.params.id }, async () => {
      const property = await Property.findOne({ ...publishedFilter, _id: req.params.id }).select(publicFields + " ownerId").read(replicaReadPreference()).maxTimeMS(1500).lean();
      const owner = property && await User.exists({ _id: property.ownerId, isSuspended: { $ne: true }, isActive: { $ne: false } }).read(replicaReadPreference()).maxTimeMS(1000);
      if (!property || !owner) return { data: { message: "Published property not found" }, status: 404 };
      const { ownerId: _owner, ...dto } = property;
      return { data: dto };
    });
    sendPublicResponse(req, res, response);
  } catch { res.setHeader("Retry-After", "1"); res.status(503).json({ message: "Search is busy. Please try again shortly." }); }
});

router.post("/", authGuard, roleGuard("user"), async (req: any, res) => {
  try {
    const seller = await User.findById(req.user.id);
    if ((!seller || !identityApproved(seller))) return res.status(403).json({ message: "Complete identity verification before listing" });
    const mediaError = mediaInputError(req.body.media);
    if (mediaError) return res.status(400).json({ message: mediaError });
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
    const mediaError = mediaInputError(req.body.media, property.media);
    if (mediaError) return res.status(400).json({ message: mediaError });
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
    if ((!seller || !identityApproved(seller))) return res.status(403).json({ message: "Complete identity verification first" });
    const property = await Property.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (!["draft", "correction_required"].includes(property.status)) return res.status(409).json({ message: "Property has already been submitted or cannot be resubmitted" });
    if (req.body.consent !== true) return res.status(400).json({ message: "Accept the seller declaration before submitting" });
    const error = validateListing(property);
    if (error) return res.status(400).json({ message: error });
    if (!property.media?.photos?.length) return res.status(400).json({ message: "Upload at least one property photo before submitting" });
    if (property.requestedAdvisorId && (!isValidObjectId(property.requestedAdvisorId) || !await User.exists({ _id: property.requestedAdvisorId, role: "advisor", ...activeStaffFilter }))) return res.status(400).json({ message: "Advisor ID is invalid or unavailable. Correct it or leave it blank for Verifier assignment" });
    const result = await enqueueSubmission(property, req.user);
    if (!result) return res.status(409).json({ message: "Property changed. Reload and try again" });
    res.status(202).json(result);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});
router.post("/:id/photos", authGuard, roleGuard("user"), uploadCapacity, async (req: any, res, next) => {
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
      const uploadId = req.body.uploadId;
      if (uploadId !== undefined && (typeof uploadId !== "string" || !/^[a-f0-9-]{36}$/i.test(uploadId))) return res.status(400).json({ message: "Invalid upload ID" });
      const receiptPath = uploadId ? `uploadReceipts.${uploadId}` : undefined;
      const previous = receiptPath && await Property.findById(req.params.id).select("+uploadReceipts");
      const previousUrl = previous && previous.uploadReceipts?.get(uploadId);
      if (previousUrl) {
        if (!await restoreUploadedPhoto(req.params.id, req.user.id, previousUrl)) return res.status(409).json({ message: "Property changed or photo limit reached" });
        return res.status(200).json({ url: previousUrl });
      }
      filename = await storePropertyPhoto(req.file.buffer, req.params.id);
      const origin = apiOrigin(req);
      const url = `${origin.replace(/\/$/, "")}/property-photos/${filename}`;
      const property = await Property.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] }, "media.photos.9": { $exists: false }, ...(receiptPath ? { [receiptPath]: { $exists: false } } : {}) }, { ...(receiptPath ? { $set: { [receiptPath]: url } } : {}), $push: { "media.photos": url }, $inc: { __v: 1 } }, { new: true });
      if (!property) {
        const saved = receiptPath && await Property.findById(req.params.id).select("+uploadReceipts");
        const savedUrl = saved && saved.uploadReceipts?.get(uploadId);
        if (savedUrl && await restoreUploadedPhoto(req.params.id, req.user.id, savedUrl)) return res.status(200).json({ url: savedUrl });
        return res.status(409).json({ message: "Property changed or already has 10 photos. Reload and try again." });
      }
      retained = true;
      res.status(201).json({ url });
    } catch (cause: any) { res.status(400).json({ message: cause.message || "Could not upload photo" }); }
    finally {
      if (filename && !retained) {
        // A lost DB acknowledgement may still have committed the attachment.
        // Preserve the file if that check fails; never delete a possibly saved photo.
        try {
          const attached = await Property.exists({ _id: req.params.id, "media.photos": { $regex: `/${filename.replace(/\./g, "\\.")}$` } });
          if (!attached) await discardPropertyPhoto(filename);
        } catch { /* Leave uncertain files intact for recovery. */ }
      }
    }
  });
});
export default router;
