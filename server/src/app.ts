import express from "express";
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
import { validatePagination } from "./services/pagination";
import { errorHandler, installRuntimeMiddleware, notFound } from "./middleware/runtime.middleware";

export function createApp(isReady = () => mongoose.connection.readyState === 1) {
  const app = express();
  installRuntimeMiddleware(app);
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb", parameterLimit: 100 }));
  app.use(validatePagination);
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "MalikSe API" }));
  app.get("/ready", (_req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" });
  });
  app.use("/property-photos", photoRoutes);
  app.use("/auth", authRoutes);
  app.use("/properties", propertyRoutes);
  app.use("/documents", documentRoutes);
  app.use("/deals", dealRoutes);
  app.use("/verification", advisorRoutes);
  app.use("/admin", adminRoutes);
  app.use("/users", userRoutes);
  app.use("/inquiries", inquiryRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
