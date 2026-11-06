import { Router } from "express";
import path from "path";
import mongoose from "mongoose";
import { photoDirectory } from "../services/propertyPhotos";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { authenticateRequest } from "../middleware/auth.middleware";
import { canReadProperty } from "../services/propertyWorkflow";

const router = Router();
router.get("/:filename", async (req, res) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "private, no-store");
  const filename = req.params.filename;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/i.test(filename)) return res.sendStatus(404);
  const localPath = path.resolve(photoDirectory, filename);
  if (path.dirname(localPath) !== path.resolve(photoDirectory)) return res.sendStatus(404);
  try {
    if (mongoose.connection.readyState !== 1) return res.sendStatus(503);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "photos" });
    const file = await bucket.find({ filename }).next();
    const references = { "media.photos": { $regex: `/property-photos/${filename.replace('.', '\\.')}$` } };
    const properties = await Property.find({ ...references, ...(file?.metadata?.propertyId ? { _id: file.metadata.propertyId } : {}) })
      .select("ownerId assignedAdvisorId assignedVerifierId status badges advisorReview.decision verifierReview.decision").limit(101).maxTimeMS(5000);
    if (!properties.length || properties.length > 100) return res.sendStatus(404);
    const owners = new Set((await User.find({ _id: { $in: properties.map(property => property.ownerId) }, isSuspended: { $ne: true }, isActive: { $ne: false } })
      .select("_id").lean().maxTimeMS(5000)).map(owner => String(owner._id)));
    const privateProperties = properties.filter(property => !(property.status === "verified" && property.badges?.fullyVerified && (property.advisorReview?.decision === "approve" || property.verifierReview?.decision === "approve") && owners.has(String(property.ownerId))));
    if (privateProperties.length) {
      const auth = await authenticateRequest(req.headers.authorization);
      if (auth.status || !auth.user) return res.status(auth.status || 401).json({ message: "Sign in to view this property photo" });
      // Legacy uploads lack ownership metadata. Require access to every reference,
      // so copying someone else's private photo URL to a draft cannot grant access.
      if (!privateProperties.every(property => canReadProperty(property, auth.user!))) return res.sendStatus(403);
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (file) {
      res.type(path.extname(filename));
      const stream = bucket.openDownloadStream(file._id);
      stream.on("error", () => { if (!res.headersSent) res.sendStatus(404); else res.destroy(); });
      res.on("close", () => stream.destroy());
      stream.pipe(res);
      return;
    }
    res.sendFile(localPath, error => { if (error && !res.headersSent) res.sendStatus(404); });
  } catch { if (!res.headersSent) res.sendStatus(503); else res.destroy(); }
});
export default router;
