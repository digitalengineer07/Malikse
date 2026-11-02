import { uploadCapacity } from "../middleware/uploadCapacity";
import { readPage } from "../services/pagination";
import { Router } from "express";
import multer from "multer";
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
let directoryReady: Promise<unknown> | undefined;
const ensureUploadDirectory = () => directoryReady ??= fs.mkdir(uploadDir, { recursive: true }).catch(error => { directoryReady = undefined; throw error; });
import { accountEnabled, apiOrigin, tokenDigest } from "../services/security";
const upload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => { ensureUploadDirectory().then(() => cb(null, uploadDir), error => cb(error, uploadDir)); },
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
}), limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 4, fieldSize: 1024 } });

router.post("/", authGuard, roleGuard("user"), uploadCapacity, upload.single("file"), async (req: any, res) => {
  let retained = false;
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const property = await Property.findOne({ _id: req.body.propertyId, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] } });
    if (!property) return res.status(403).json({ message: "Upload documents only to your draft or correction request" });
    const uploadId = req.body.uploadId;
    if (uploadId !== undefined && (typeof uploadId !== "string" || !/^[a-f0-9-]{36}$/i.test(uploadId))) return res.status(400).json({ message: "Invalid upload ID" });
    // The built-in unique _id index makes retries safe without an index migration.
    const id = uploadId ? createHash("sha256").update(`${req.user.id}:${property._id}:${uploadId}`).digest("hex").slice(0, 24) : undefined;
    let doc = id ? await PropertyDocument.findById(id) : null;
    if (!doc) {
      doc = new PropertyDocument({ ...(id ? { _id: id } : {}), propertyId: property._id, type: req.body.type, fileName: req.file.originalname, fileSize: req.file.size, fileUrl: req.file.filename, uploadedBy: req.user.id });
      try { await doc.save(); retained = true; }
      catch (error: any) {
        if (error.code !== 11000 || !id) throw error;
        doc = await PropertyDocument.findById(id);
        if (!doc) throw error;
      }
    }
    // No __v compare: different files may safely attach concurrently. Replaying
    // an upload also repairs a crash between saving the document and linking it.
    const updated = await Property.updateOne({ _id: property._id, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] } }, { $addToSet: { documents: doc._id }, $inc: { __v: 1 } });
    if (!updated.matchedCount) return res.status(409).json({ message: "Property changed. Reload before uploading" });
    res.status(201).json({ _id: doc._id, type: doc.type, fileName: doc.fileName });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
  finally {
    if (!retained && req.file) {
      // A timed-out save may have committed. Never remove its document bytes.
      try {
        const saved = await PropertyDocument.exists({ fileUrl: req.file.filename });
        if (!saved) await fs.rm(req.file.path, { force: true }).catch(() => {});
      } catch { /* Preserve uncertain files for retry recovery. */ }
    }
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
    res.download(path.join(uploadDir, path.basename(doc.fileUrl)), doc.fileName, error => {
      if (error && !res.headersSent) res.sendStatus(404);
      else if (error) res.destroy();
    });
  } catch { res.status(403).json({ message: "Document link expired. Reload the property" }); }
});
export default router;
