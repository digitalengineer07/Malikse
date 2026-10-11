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
import photoRoutes from "./routes/photo.routes";
import { startSubmissionWorker } from "./services/submissionQueue";
import { Property } from "./models/Property.model";
import { SearchCache } from "./models/SearchCache.model";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/property-photos", photoRoutes);
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
  .then(async () => {
    await Promise.all([Property.createIndexes(), SearchCache.createIndexes()]);
    console.log(`[MalikSe] MongoDB connected`);
    const stopWorker = process.env.SUBMISSION_WORKER_ENABLED === "false" ? async () => {} : startSubmissionWorker();
    const server = app.listen(PORT, () => {
      console.log(`[MalikSe] Server running on http://localhost:${PORT}`);
    });
    const shutdown = async () => {
      await Promise.all([new Promise<void>(resolve => server.close(() => resolve())), stopWorker()]);
      await mongoose.disconnect();
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  })
  .catch((err) => {
    console.error("[MalikSe] MongoDB connection error:", err);
    process.exit(1);
  });

export default app;

