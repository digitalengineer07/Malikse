import "dotenv/config";
import mongoose from "mongoose";
import { createFastifyApp } from "./fastifyApp";
import { positiveInteger } from "./middleware/runtime.middleware";
import { startSubmissionWorker } from "./services/submissionQueue";
import { mongoPoolOptions } from "./services/mongoPool";
import { closeRedis } from "./services/redis";
import { monitorPool } from "./services/performanceMetrics";
import { startRegionCounts, stopRegionCounts } from "./services/regionCountStore";

let stopping = false;
const app = createFastifyApp(() => !stopping && mongoose.connection.readyState === 1);
const PORT = positiveInteger("PORT", 5000, 65535);
mongoose.set("bufferCommands", false);

let startupStage = "Fastify route registration";
Promise.resolve(app.ready()).then(() => {
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
  startupStage = `listening on port ${PORT}`;
  await app.listen({ port: PORT, host: "0.0.0.0" });
  const stopWorker = process.env.SUBMISSION_WORKER_ENABLED === "false" ? async () => {} : startSubmissionWorker();
  console.log(`[MalikSe] Fastify server running on http://localhost:${PORT}`);
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
