import { scanDocumentBytes } from "../services/documentScanner";
import { FileCleanup } from "../models/FileCleanup.model";
import { uploadCapacity } from "../middleware/uploadCapacity";
import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { authGuard, roleGuard } from "../middleware/auth.middleware";
import { User } from "../models/User.model";
import { randomBytes } from "crypto";
import { DocumentDownload } from "../models/DocumentDownload.model";
import { accountEnabled, apiOrigin, tokenDigest } from "../services/security";
const router = Router();
router.use(async (req: any, res, next) => {
  if (req.method !== "GET" || req.query.download === undefined) return authGuard(req, res, next);
  try {
    const fileId = req.path.slice(1);
    if (!mongoose.isValidObjectId(fileId) || typeof req.query.download !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(req.query.download)) return res.sendStatus(403);
    const ticket = await DocumentDownload.findOneAndDelete({ _id: tokenDigest(req.query.download), documentId: fileId, expiresAt: { $gt: new Date() } });
    const actor = ticket && await User.findById(ticket.actorId);
    if (!actor || !accountEnabled(actor)) return res.sendStatus(403);
    req.user = { id: String(actor._id), role: actor.role };
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  } catch { res.sendStatus(503); }
});
router.post("/:fileId/download", async (req: any, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId)) return res.sendStatus(400);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "kyc" });
    const file = await bucket.find({ _id: new mongoose.Types.ObjectId(req.params.fileId) }).next();
    if (!file || (req.user.role !== "admin" && file.metadata?.ownerId !== req.user.id)) return res.sendStatus(404);
    const nonce = randomBytes(32).toString("base64url");
    await DocumentDownload.create({ _id: tokenDigest(nonce), documentId: file._id, actorId: req.user.id, expiresAt: new Date(Date.now() + 60000) });
    res.setHeader("Cache-Control", "no-store");
    res.json({ url: `${apiOrigin(req)}/users/kyc/${file._id}?download=${nonce}` });
  } catch { res.sendStatus(503); }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 0, parts: 3 },
});
router.get("/", async (req: any, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "kycStatus kycDocuments kycSubmittedAt identityReview isVerifiedIdentity",
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.json(user);
  } catch {
    res.status(503).json({ message: "KYC status unavailable" });
  }
});
router.post("/", roleGuard("user"), rateLimit({ windowMs: 60000, limit: 3 }), uploadCapacity, async (req: any, res) => {
  if (process.env.NODE_ENV === "production" && process.env.KYC_UPLOADS_ENABLED !== "true") return res.status(403).json({ message: "KYC uploads are not enabled. Contact support." });
  const current = await User.findById(req.user.id).select("isVerifiedIdentity kycStatus").catch(() => null);
  if (!current || current.isVerifiedIdentity || current.kycStatus === "pending") return res.status(409).json({ message: "KYC is unavailable or already under review" });
  upload.array("files", 3)(req, res, async (error) => {
    if (error)
      return res
        .status(400)
        .json({ message: "Upload up to 3 files, maximum 5 MB each" });
    const ids: string[] = [];
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, {
      bucketName: "kyc",
    });
    try {
      const user = await User.findById(req.user.id);
      if (!user || user.isVerifiedIdentity || user.kycStatus === "pending")
        return res
          .status(409)
          .json({ message: "KYC is already approved or under review" });
      const files = req.files as Express.Multer.File[];
      if (!files?.length)
        return res
          .status(400)
          .json({ message: "Upload your identity document" });
      for (const file of files) {
        const b = file.buffer;
        const mime =
          b.subarray(0, 5).toString() === "%PDF-"
            ? "application/pdf"
            : b[0] === 255 && b[1] === 216 && b[2] === 255
              ? "image/jpeg"
              : b
                    .subarray(0, 8)
                    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                ? "image/png"
                : null;
        if (!mime) throw new Error("Use a valid PDF, JPG or PNG document");
        await scanDocumentBytes(new Uint8Array(b));
        const stream = bucket.openUploadStream("identity-document", {
          metadata: { ownerId: req.user.id, mime },
        });
        ids.push(String(stream.id));
        await FileCleanup.create({ _id: `kyc:${stream.id}`, bucket: "kyc", fileId: stream.id, nextAttemptAt: new Date(Date.now() + 3600000) });
        await new Promise<void>((resolve, reject) => {
          stream.on("finish", resolve);
          stream.on("error", reject);
          stream.end(b);
        });
      }
      for (const oldId of user.kycDocuments) await FileCleanup.updateOne({ _id: `kyc:${oldId}` }, { $set: { bucket: "kyc", fileId: new mongoose.Types.ObjectId(oldId), nextAttemptAt: new Date(Date.now() + 300000) } }, { upsert: true });
      const saved = await User.findOneAndUpdate(
        {
          _id: req.user.id,
          isVerifiedIdentity: false,
          kycStatus: { $ne: "pending" },
        },
        {
          $set: {
            kycStatus: "pending",
            kycSubmittedAt: new Date(),
            kycDocuments: ids,
          },
        },
        { new: true },
      );
      if (!saved) throw new Error("KYC changed; refresh and retry");
      res.status(202).json({ status: "pending" });
    } catch (e: any) {
      await Promise.all(
        ids.map((id) =>
          bucket.delete(new mongoose.Types.ObjectId(id)).catch(() => {}),
        ),
      );
      res.status(400).json({ message: e.message || "Upload failed" });
    }
  });
});
router.get("/:fileId", async (req: any, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId))
      return res.sendStatus(400);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, {
      bucketName: "kyc",
    });
    const file = await bucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.fileId) })
      .next();
    if (
      !file ||
      (req.user.role !== "admin" && file.metadata?.ownerId !== req.user.id)
    )
      return res.sendStatus(404);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type(file.metadata!.mime);
    const stream = bucket.openDownloadStream(file._id);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  } catch {
    if (!res.headersSent)
      res.status(503).json({ message: "Document unavailable" });
  }
});
export default router;
