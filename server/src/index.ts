import "dotenv/config";
import mongoose from "mongoose";
import { createFastifyApp } from "./fastifyApp";
import { positiveInteger } from "./middleware/runtime.middleware";
import { mongoPoolOptions } from "./services/mongoPool";
import { monitorPool } from "./services/performanceMetrics";
import { closeRedis } from "./services/redis";
import { startRegionCounts, stopRegionCounts } from "./services/regionCountStore";
import { startSubmissionWorker } from "./services/submissionQueue";

let stopping = false;
let initialized = false;
const app = createFastifyApp(() => initialized && !stopping && mongoose.connection.readyState === 1);
const PORT = positiveInteger("PORT", 5000, 65535);
mongoose.set("bufferCommands", false);

let startupStage = `listening on port ${PORT}`;
// Bind before any remote database or region-count work to meet hosting startup deadlines.
app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`[MalikSe] Fastify server running on http://localhost:${PORT}`);
  startupStage = "MongoDB connection";
  return mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse", {
  autoIndex: process.env.NODE_ENV !== "production",
  ...mongoPoolOptions(),
  });
}).then(async () => {
  monitorPool(mongoose.connection.getClient());
  console.log("[MalikSe] MongoDB connected");
  startupStage = "region count initialization";
  await startRegionCounts();
  initialized = true;
  const stopWorker = process.env.SUBMISSION_WORKER_ENABLED === "false" ? async () => {} : startSubmissionWorker();
  console.log("[MalikSe] API ready");
  const server = app.server;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 15_000);
    deadline.unref();
    await Promise.all([app.close(), stopWorker()]);
    await stopRegionCounts();
    await mongoose.disconnect();
    closeRedis();
    clearTimeout(deadline);
  };
  process.once("SIGTERM", () => { void shutdown(); });
  process.once("SIGINT", () => { void shutdown(); });
}).catch(async (error: unknown) => {
  const cause = error as { name?: string; code?: string; message?: string };
  const message = String(cause?.message || "Unknown error").replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[redacted MongoDB URI]");
  console.error("[MalikSe] Server startup failed", { stage: startupStage, name: cause?.name, code: cause?.code, message });
  await app.close().catch(() => {});
  await stopRegionCounts();
  await mongoose.disconnect();
  closeRedis();
  process.exit(1);
});

export default app;
