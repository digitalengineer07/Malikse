import { uploadCapacity } from "../middleware/uploadCapacity";
import { readPage } from "../services/pagination";
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { PropertyDocument } from "../models/Document.model";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { authGuard, roleGuard } from "../middleware/auth.middleware";
import { canReadProperty } from "../services/propertyWorkflow";

const router = Router();
const uploadDir = path.join(__dirname, "../../uploads");
import { ACCESS_SECRET as secret, accountEnabled, apiOrigin } from "../services/security";
const upload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => { fs.mkdirSync(uploadDir, { recursive: true }); cb(null, uploadDir); },
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
}), limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 4, fieldSize: 1024 } });

router.post("/", authGuard, roleGuard("user"), uploadCapacity, upload.single("file"), async (req: any, res) => {
  let retained = false;
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const property = await Property.findOne({ _id: req.body.propertyId, ownerId: req.user.id, status: { $in: ["draft", "correction_required"] } });
    if (!property) return res.status(403).json({ message: "Upload documents only to your draft or correction request" });
    const doc = new PropertyDocument({ propertyId: property._id, type: req.body.type, fileName: req.file.originalname, fileSize: req.file.size, fileUrl: req.file.filename, uploadedBy: req.user.id });
    await doc.validate();
    const updated = await Property.updateOne({ _id: property._id, __v: property.__v, status: property.status }, { $push: { documents: doc._id }, $inc: { __v: 1 } });
    if (!updated.modifiedCount) return res.status(409).json({ message: "Property changed. Reload before uploading" });
    try { await doc.save(); } catch (error) { await Property.updateOne({ _id: property._id }, { $pull: { documents: doc._id }, $inc: { __v: 1 } }); throw error; }
    retained = true;
    res.status(201).json({ _id: doc._id, type: doc.type, fileName: doc.fileName });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
  finally { if (!retained && req.file) fs.rmSync(req.file.path, { force: true }); }
});

router.get("/", authGuard, async (req: any, res) => {
  try {
    const property = await Property.findById(req.query.propertyId);
    if (!property || !canReadProperty(property, req.user)) return res.status(403).json({ message: "Document access denied" });
    const docs = await readPage(PropertyDocument.find({ propertyId: property._id }), req, res);
    res.json(docs.map(doc => {
      const token = jwt.sign({ docId: doc._id.toString(), actorId: req.user.id, purpose: "document-view" }, secret, { expiresIn: "5m" });
      return { _id: doc._id, type: doc.type, fileName: doc.fileName, fileSize: doc.fileSize, createdAt: doc.createdAt, fileUrl: `${apiOrigin(req)}/documents/${doc._id}/file?token=${token}` };
    }));
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get("/:id/file", async (req, res) => {
  try {
    const token = jwt.verify(String(req.query.token || ""), secret) as any;
    if (token.purpose !== "document-view" || token.docId !== req.params.id) return res.sendStatus(403);
    const [doc, actor] = await Promise.all([PropertyDocument.findById(req.params.id), User.findById(token.actorId)]);
    if (!doc || !actor) return res.sendStatus(404);
    if (!accountEnabled(actor)) return res.sendStatus(403);
    const property = await Property.findById(doc.propertyId);
    if (!property || !canReadProperty(property, { id: actor._id.toString(), role: actor.role })) return res.sendStatus(403);
    res.setHeader("Cache-Control", "no-store");
    res.download(path.join(uploadDir, path.basename(doc.fileUrl)), doc.fileName);
  } catch { res.status(403).json({ message: "Document link expired. Reload the property" }); }
});
export default router;
