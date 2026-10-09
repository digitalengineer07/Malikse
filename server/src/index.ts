import "dotenv/config";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./routes/auth.routes";
import propertyRoutes from "./routes/property.routes";
import documentRoutes from "./routes/document.routes";
import dealRoutes from "./routes/deal.routes";
import advisorRoutes from "./routes/advisor.routes";
import adminRoutes from "./routes/admin.routes";
import userRoutes from "./routes/user.routes";
import inquiryRoutes from "./routes/inquiry.routes";
import { photoDirectory } from "./services/propertyPhotos";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
import fs from "fs";
import path from "path";

// Only public property photography is served here, never ownership documents.
app.get("/property-photos/:filename", async (req, res, next) => {
  try {
    const filename = req.params.filename;
    if (mongoose.connection.readyState === 1) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "photos" });
      const files = await bucket.find({ filename }).toArray();
      if (files.length > 0) {
        const file = files[0];
        res.setHeader("Content-Type", file.contentType || "image/jpeg");
        res.setHeader("X-Content-Type-Options", "nosniff");
        return bucket.openDownloadStream(file._id).pipe(res);
      }
    }
    // Fallback to local disk
    const localPath = path.join(photoDirectory, filename);
    if (fs.existsSync(localPath)) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.sendFile(localPath);
    }
    res.status(404).send("File not found");
  } catch (error) {
    res.status(500).send("Error fetching photo");
  }
});
// Ownership documents are served only through authorized, expiring document links.

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/properties", propertyRoutes);
app.use("/documents", documentRoutes);
app.use("/deals", dealRoutes);
app.use("/verification", advisorRoutes);
app.use("/admin", adminRoutes);
app.use("/users", userRoutes);
app.use("/inquiries", inquiryRoutes);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", service: "MalikSe API" }));

// ── Database ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/malikse";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(`[MalikSe] MongoDB connected`);
    app.listen(PORT, () => {
      console.log(`[MalikSe] Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[MalikSe] MongoDB connection error:", err);
    process.exit(1);
  });

export default app;

