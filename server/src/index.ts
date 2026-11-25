import "./config/loadEnv";
import mongoose from "mongoose";
import { createFastifyApp } from "./fastifyApp";
import { positiveInteger } from "./middleware/runtime.middleware";
import { User } from "./models/User.model";
import { startAccountDeletionWorker } from "./services/accountDeletion";
import { processFileCleanup } from "./services/fileCleanup";
import { freePort } from "./services/freePort";
import { mongoPoolOptions } from "./services/mongoPool";
import { deliverNotifications } from "./services/notificationQueue";
import { checkDeviceAlertReceipts } from "./services/deviceAlerts";
import { monitorPool } from "./services/performanceMetrics";
import { closeRedis } from "./services/redis";
import { startRegionCounts, stopRegionCounts } from "./services/regionCountStore";
import { createRequiredIndexes, ensureActivityIndexes, verifyRequiredIndexes } from "./services/requiredIndexes";
import { startSubmissionWorker } from "./services/submissionQueue";
import { migrateAdvisorCodes } from "./scripts/migrateAdvisorCodes";

let stopping = false;
let initialized = false;
let finishStartup!: () => void;
const startupWait = new Promise<void>(resolve => { finishStartup = resolve; });
const startupDeadline = setTimeout(finishStartup, 8_000);
startupDeadline.unref();
const app = createFastifyApp(
  () => initialized && !stopping && mongoose.connection.readyState === 1,
  () => !initialized && !stopping ? startupWait : Promise.resolve(),
);
const PORT = positiveInteger("PORT", 5000, 65535);
mongoose.set("bufferCommands", false);

async function startListening(port: number): Promise<void> {
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err: any) {
    if (err?.code === "EADDRINUSE" && process.env.NODE_ENV !== "production") {
      console.warn(`[MalikSe] Port ${port} is currently busy. Reclaiming port...`);
      freePort(port);
      await new Promise(resolve => setTimeout(resolve, 500));
      await app.listen({ port, host: "0.0.0.0" });
      return;
    }
    throw err;
  }
}

let startupStage = `listening on port ${PORT}`;
// Bind before any remote database or region-count work to meet hosting startup deadlines.
startListening(PORT).then(() => {
  console.log(`[MalikSe] Fastify server running on http://localhost:${PORT}`);
  startupStage = "MongoDB connection";
  return mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse", {
    autoIndex: false,
    ...mongoPoolOptions(),
  });
}).then(async () => {
  monitorPool(mongoose.connection.getClient());
  console.log("[MalikSe] MongoDB connected");
  if (process.env.MONGO_READ_REPLICA === "true") {
    startupStage = "MongoDB read replica check";
    await mongoose.connection.db!.command({ ping: 1 }, { readPreference: "secondary" });
    console.log("[MalikSe] MongoDB secondary available for read traffic");
  }
  startupStage = "required index verification";
  if (process.env.NODE_ENV !== "production") await createRequiredIndexes();
  else {
    await User.collection.createIndex({ googleId: 1 }, { unique: true, sparse: true });
    await ensureActivityIndexes();
  }
  await verifyRequiredIndexes();
  await migrateAdvisorCodes().catch(err => console.warn("[MalikSe] Advisor code migration warning:", err?.message));
  initialized = true;
  clearTimeout(startupDeadline);
  finishStartup();
  const stopWorker = process.env.SUBMISSION_WORKER_ENABLED === "false" ? async () => {} : startSubmissionWorker();
  const stopDeletionWorker = startAccountDeletionWorker();
  let regionStartup: Promise<void> | undefined;
  let regionRetry: NodeJS.Timeout | undefined;
  const initializeRegions = () => {
    regionStartup = startRegionCounts().catch(() => {
      console.error("[RegionCounts] Initialization failed; retrying in 30 seconds");
      if (!stopping) {
        regionRetry = setTimeout(initializeRegions, 30_000);
        regionRetry.unref();
      }
    });
  };
  const startTask = (task: () => Promise<unknown>, interval: number) => {
    let pending: Promise<unknown> | undefined;
    const timer = setInterval(() => { if (!pending) pending = task().catch(() => console.error("Background delivery deferred")).finally(() => { pending = undefined; }); }, interval);
    timer.unref();
    return async () => { clearInterval(timer); await pending; };
  };
  const stopFileCleanup = startTask(processFileCleanup, 30000);
  const stopNotifications = startTask(deliverNotifications, 10000);
  const stopAlertReceipts = process.env.DEVICE_ALERTS_ENABLED === "true"
    ? startTask(checkDeviceAlertReceipts, 60000) : async () => {};
  console.log("[MalikSe] API ready");
  initializeRegions();
  const server = app.server;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearTimeout(regionRetry);

    const deadline = setTimeout(() => { (server as any).closeAllConnections?.(); process.exit(1); }, 15_000);
    deadline.unref();
    await Promise.all([app.close(), stopWorker(), stopDeletionWorker(), stopNotifications(), stopAlertReceipts(), stopFileCleanup()]);
    await regionStartup;
    await stopRegionCounts();
    await mongoose.disconnect();
    closeRedis();
    clearTimeout(deadline);
  };
  process.once("SIGTERM", () => { void shutdown(); });
  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGUSR2", () => { void shutdown(); });
}).catch(async (error: unknown) => {
  clearTimeout(startupDeadline);
  finishStartup();
  const cause = error as { name?: string; code?: string; message?: string };
  const message = String(cause?.message || "Unknown error").replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[redacted MongoDB URI]");
  console.error("[MalikSe] Server startup failed", { stage: startupStage, name: cause?.name, code: cause?.code, message });
  await app.close().catch(() => { });
  await stopRegionCounts();
  await mongoose.disconnect();
  closeRedis();
  process.exit(1);
});

export default app;
