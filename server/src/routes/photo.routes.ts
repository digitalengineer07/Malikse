import { Router } from "express";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { photoDirectory } from "../services/propertyPhotos";

const router = Router();
router.get("/:filename", async (req, res) => {
  // Property images are intentionally embedded by web clients on other origins.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  const filename = req.params.filename;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/i.test(filename)) return res.sendStatus(404);
  const localPath = path.resolve(photoDirectory, filename);
  if (path.dirname(localPath) !== path.resolve(photoDirectory)) return res.sendStatus(404);
  try {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (mongoose.connection.readyState === 1) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "photos" });
      const file = await bucket.find({ filename }).next();
      if (file) {
        res.type(path.extname(filename));
        const stream = bucket.openDownloadStream(file._id);
        stream.on("error", () => { if (!res.headersSent) res.sendStatus(404); else res.destroy(); });
        res.on("close", () => stream.destroy());
        stream.pipe(res);
        return;
      }
    }
    if (fs.existsSync(localPath)) return res.sendFile(localPath);
    res.sendStatus(404);
  } catch { if (!res.headersSent) res.sendStatus(500); else res.destroy(); }
});
export default router;
