import { Router } from "express";
import path from "path";
import fs from "fs/promises";
import mongoose from "mongoose";
import sharp from "sharp";
import { photoDirectory, photoCacheDirectory } from "../services/propertyPhotos";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { authenticateRequest } from "../middleware/auth.middleware";
import { canReadProperty } from "../services/propertyWorkflow";

const router = Router();

// Bucketize requested thumbnail widths to prevent cache pollution attacks
function getBucketWidth(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed <= 0) return undefined;
  if (parsed <= 400) return 400;
  if (parsed <= 600) return 600;
  if (parsed <= 900) return 900;
  if (parsed <= 1200) return 1200;
  return 1600;
}

router.get("/:filename", async (req, res) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const filename = req.params.filename;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/i.test(filename)) return res.sendStatus(404);
  const localPath = path.resolve(photoDirectory, filename);
  if (path.dirname(localPath) !== path.resolve(photoDirectory)) return res.sendStatus(404);

  const width = getBucketWidth(typeof req.query.w === "string" ? req.query.w : undefined);
  const etag = `"${filename}${width ? `-${width}` : ""}"`;

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
      // Private photos: allow user's browser to cache for 1 hour, prevent shared CDN caching
      res.setHeader("Cache-Control", "private, max-age=3600");
    } else {
      // Verified public photos: enable long-term browser & CDN caching (30 days) with stale-while-revalidate
      res.setHeader("Cache-Control", "public, max-age=2592000, stale-while-revalidate=86400, immutable");
    }

    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) {
      return res.sendStatus(304);
    }

    // 1. Resized thumbnail requested
    if (width) {
      const cachedFile = path.resolve(photoCacheDirectory, `${width}_${filename}`);
      try {
        const cachedStat = await fs.stat(cachedFile);
        if (cachedStat.isFile()) {
          res.type(path.extname(filename));
          return res.sendFile(cachedFile);
        }
      } catch {
        // Cache miss, proceed to generate thumbnail
      }

      // Read original image from GridFS or local disk
      let originalBuffer: Buffer | null = null;
      if (file) {
        const chunks: Buffer[] = [];
        const downloadStream = bucket.openDownloadStream(file._id);
        for await (const chunk of downloadStream) {
          chunks.push(chunk as Buffer);
        }
        originalBuffer = Buffer.concat(chunks);
      } else {
        originalBuffer = await fs.readFile(localPath).catch(() => null);
      }

      if (!originalBuffer) return res.sendStatus(404);

      try {
        const ext = path.extname(filename).toLowerCase();
        const resizedPipeline = sharp(originalBuffer)
          .rotate()
          .resize({ width, fit: "inside", withoutEnlargement: true });

        let resizedBuffer: Buffer;
        if (ext === ".png") {
          resizedBuffer = await resizedPipeline.png({ compressionLevel: 8 }).toBuffer();
        } else if (ext === ".webp") {
          resizedBuffer = await resizedPipeline.webp({ quality: 80 }).toBuffer();
        } else {
          resizedBuffer = await resizedPipeline.jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
        }

        // Asynchronously persist thumbnail to cache directory
        void (async () => {
          try {
            await fs.mkdir(photoCacheDirectory, { recursive: true });
            await fs.writeFile(cachedFile, resizedBuffer);
          } catch {
            // Non-critical cache write error
          }
        })();

        res.type(path.extname(filename));
        return res.send(resizedBuffer);
      } catch {
        // Fall back to original stream if sharp resize encounters unparseable data
      }
    }

    // 2. Full size original
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
