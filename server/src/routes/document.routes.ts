import { scanDocument } from "../services/documentScanner";
import { FileCleanup } from "../models/FileCleanup.model";
import { uploadCapacity } from "../middleware/uploadCapacity";
import { readPage } from "../services/pagination";
import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import fs from "fs/promises";
import { randomUUID, randomBytes, createHash } from "crypto";
import { DocumentDownload } from "../models/DocumentDownload.model";
import { PropertyDocument } from "../models/Document.model";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { authGuard, roleGuard, authenticateRequest } from "../middleware/auth.middleware";
import { canReadProperty } from "../services/propertyWorkflow";

const router = Router();
const uploadDir = path.join(__dirname, "../../uploads");
const temporaryUploadDir = path.join(uploadDir, ".incoming");
let directoryReady: Promise<unknown> | undefined;
const ensureUploadDirectory = () => directoryReady ??= fs.mkdir(temporaryUploadDir, { recursive: true }).catch(error => { directoryReady = undefined; throw error; });
import { accountEnabled, apiOrigin, tokenDigest } from "../services/security";
const upload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => { ensureUploadDirectory().then(() => cb(null, temporaryUploadDir), error => cb(error, temporaryUploadDir)); },
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
}), limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 4, parts: 5, fieldSize: 1024 } });

router.post("/", authGuard, roleGuard("user"), uploadCapacity, async (req: any, res, next) => {
  const propertyId = req.query.propertyId;
  if (typeof propertyId !== "string" || !mongoose.isValidObjectId(propertyId)) return res.status(400).json({ message: "Provide propertyId in the upload URL" });
  const lease = randomUUID();
  try {
    if (!await Property.exists({ _id: propertyId, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] } })) return res.status(403).json({ message: "Upload documents only to your draft or correction request" });
    const property = await Property.findOneAndUpdate({ _id: propertyId, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] }, $or: [{ documentUploadUntil: { $exists: false } }, { documentUploadUntil: { $lte: new Date() } }] }, { $set: { documentUploadLease: lease, documentUploadUntil: new Date(Date.now() + 180000) } });
    if (!property) { res.setHeader("Retry-After", "2"); return res.status(429).json({ message: "Property unavailable or another document is uploading" }); }
    req.documentLease = lease; req.documentPropertyId = propertyId;
    const release = () => { void Property.updateOne({ _id: propertyId, documentUploadLease: lease }, { $unset: { documentUploadLease: 1, documentUploadUntil: 1 } }).catch(() => {}); };
    res.once("finish", release); res.once("close", release);
    const usage = await PropertyDocument.aggregate([{ $match: { propertyId: property._id } }, { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: "$fileSize" } } }]);
    const replayId = typeof req.query.uploadId === "string" && /^[a-f0-9-]{36}$/i.test(req.query.uploadId) ? createHash("sha256").update(`${req.user.id}:${propertyId}:${req.query.uploadId}`).digest("hex").slice(0, 24) : undefined;
    const replay = replayId && await PropertyDocument.exists({ _id: replayId, propertyId });
    if (!replay && (usage[0]?.count >= 20 || usage[0]?.bytes > 180 * 1024 * 1024)) return res.status(409).json({ message: "Document limit reached (20 files / 200 MB per property)" });
    upload.single("file")(req, res, next);
  } catch { res.status(503).json({ message: "Upload unavailable" }); }
}, async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    if (req.body.propertyId !== req.documentPropertyId || (req.query.uploadId && req.query.uploadId !== req.body.uploadId)) return res.status(400).json({ message: "Property mismatch" });
    const handle = await fs.open(req.file.path, "r");
    const signature = Buffer.alloc(12);
    try { await handle.read(signature, 0, 12, 0); } finally { await handle.close(); }
    const mime = signature.subarray(0, 5).toString() === "%PDF-" ? "application/pdf" : signature.subarray(0, 3).equals(Buffer.from([255,216,255])) ? "image/jpeg" : signature.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png" : null;
    if (!mime) return res.status(400).json({ message: "Use a valid PDF, JPEG or PNG document" });
    await scanDocument(req.file.path);
    const property = await Property.findOneAndUpdate({ _id: req.documentPropertyId, documentUploadLease: req.documentLease, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] } }, { $set: { documentUploadUntil: new Date(Date.now() + 180000) } });
    if (req.aborted || !property || !await User.exists({ _id: req.user.id, isActive: { $ne: false }, isSuspended: { $ne: true } })) return res.status(403).json({ message: "Upload documents only to your draft or correction request" });
    const uploadId = req.body.uploadId;
    if (uploadId !== undefined && (typeof uploadId !== "string" || !/^[a-f0-9-]{36}$/i.test(uploadId))) return res.status(400).json({ message: "Invalid upload ID" });
    // The built-in unique _id index makes retries safe without an index migration.
    const id = uploadId ? createHash("sha256").update(`${req.user.id}:${property._id}:${uploadId}`).digest("hex").slice(0, 24) : undefined;
    let doc = id ? await PropertyDocument.findById(id) : null;
    if (!doc) {
      doc = new PropertyDocument({ ...(id ? { _id: id } : {}), propertyId: property._id, type: req.body.type, fileName: req.file.originalname, fileSize: req.file.size, fileUrl: req.file.filename, uploadedBy: req.user.id });
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "documents" });
      const stream = bucket.openUploadStream(req.file.filename, { metadata: { propertyId: property._id, ownerId: req.user.id, mime } });
      await FileCleanup.create({ _id: `documents:${stream.id}`, bucket: "documents", fileId: stream.id, nextAttemptAt: new Date(Date.now() + 3600000) });
      await pipeline(createReadStream(req.file.path), stream);
      doc.fileUrl = `gridfs:${stream.id}`;
      try { await doc.save(); }

      catch (error: any) {
        if (error.code !== 11000 || !id) throw error;
        await bucket.delete(stream.id).catch(() => {});
        doc = await PropertyDocument.findById(id);
        if (!doc) throw error;
      }
    }
    // No __v compare: different files may safely attach concurrently. Replaying
    // an upload also repairs a crash between saving the document and linking it.
    const updated = await Property.updateOne({ _id: property._id, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] } }, { $addToSet: { documents: doc._id }, $inc: { __v: 1 } });
    if (!updated.matchedCount) return res.status(409).json({ message: "Property changed. Reload before uploading" });
    res.status(201).json({ _id: doc._id, type: doc.type, fileName: doc.fileName });
  } catch (error: any) { res.status(error.status === 503 ? 503 : 400).json({ message: error.message }); }
  finally {
    if (req.file) await fs.rm(req.file.path, { force: true }).catch(() => {});

  }
});

router.get("/", authGuard, async (req: any, res) => {
  try {
    const property = await Property.findById(req.query.propertyId);
    if (!property || !canReadProperty(property, req.user)) return res.status(403).json({ message: "Document access denied" });
    const docs = await readPage(PropertyDocument.find({ propertyId: property._id }), req, res);
    res.json(docs.map(doc => {
      return { _id: doc._id, type: doc.type, fileName: doc.fileName, fileSize: doc.fileSize, createdAt: doc.createdAt, fileUrl: `${apiOrigin(req)}/documents/${doc._id}/file` };
    }));
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.post("/:id/download", authGuard, async (req: any, res) => {
  try {
    const doc = await PropertyDocument.findById(req.params.id);
    const property = doc && await Property.findById(doc.propertyId);
    if (!doc || !property || !canReadProperty(property, req.user)) return res.sendStatus(403);
    const nonce = randomBytes(32).toString("base64url");
    await DocumentDownload.create({ _id: tokenDigest(nonce), documentId: doc._id, actorId: req.user.id, expiresAt: new Date(Date.now() + 60000) });
    res.setHeader("Cache-Control", "no-store");
    res.json({ url: `${apiOrigin(req)}/documents/${doc._id}/file?download=${nonce}`, expiresInSeconds: 60 });
  } catch { res.status(503).json({ message: "Could not prepare document download" }); }
});

router.get("/:id/file", async (req, res) => {
  try {
    let actorId: string;
    if (req.query.download !== undefined) {
      if (typeof req.query.download !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(req.query.download)) return res.sendStatus(403);
      const ticket = await DocumentDownload.findOneAndDelete({ _id: tokenDigest(req.query.download), documentId: req.params.id, expiresAt: { $gt: new Date() } });
      if (!ticket) return res.status(403).json({ message: "Download link expired or already used" });
      actorId = String(ticket.actorId);
    } else {
      const auth = await authenticateRequest(req.headers.authorization);
      if (auth.status || !auth.user) return res.status(auth.status || 401).json({ message: "Authentication required" });
      actorId = auth.user.id;
    }
    const [doc, actor] = await Promise.all([PropertyDocument.findById(req.params.id), User.findById(actorId)]);
    if (!doc || !actor) return res.sendStatus(404);
    if (!accountEnabled(actor)) return res.sendStatus(403);
    const property = await Property.findById(doc.propertyId);
    if (!property || !canReadProperty(property, { id: actor._id.toString(), role: actor.role })) return res.sendStatus(403);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (doc.fileUrl.startsWith("gridfs:")) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "documents" });
      const fileId = new mongoose.Types.ObjectId(doc.fileUrl.slice(7));
      const file = await bucket.find({ _id: fileId }).next();
      if (!file) return res.sendStatus(404);
      res.attachment(doc.fileName); res.type("application/octet-stream"); res.setHeader("X-Content-Type-Options", "nosniff");
      const stream = bucket.openDownloadStream(fileId);
      stream.on("error", () => res.destroy()); res.on("close", () => stream.destroy()); stream.pipe(res); return;
    }
    res.download(path.join(uploadDir, path.basename(doc.fileUrl)), doc.fileName, error => {
      if (error && !res.headersSent) res.sendStatus(404);
      else if (error) res.destroy();
    });
  } catch { res.status(403).json({ message: "Document link expired. Reload the property" }); }
});
export default router;
