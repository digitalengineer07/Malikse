import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app";
import { positiveInteger } from "./middleware/runtime.middleware";
import { startSubmissionWorker } from "./services/submissionQueue";
import { mongoPoolOptions } from "./services/mongoPool";
import { closeRedis } from "./services/redis";
import { monitorPool } from "./services/performanceMetrics";
import { startRegionCounts, stopRegionCounts } from "./services/regionCountStore";

let stopping = false;
const app = createApp(() => !stopping && mongoose.connection.readyState === 1);
const PORT = positiveInteger("PORT", 5000, 65535);
mongoose.set("bufferCommands", false);

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse", {
  autoIndex: process.env.NODE_ENV !== "production",
  ...mongoPoolOptions(),
}).then(async () => {
  monitorPool(mongoose.connection.getClient());
  console.log("[MalikSe] MongoDB connected");
  await startRegionCounts();
  const stopWorker = process.env.SUBMISSION_WORKER_ENABLED === "false" ? async () => {} : startSubmissionWorker();
  const server = app.listen(PORT, () => console.log(`[MalikSe] Server running on http://localhost:${PORT}`));
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 15_000);
    deadline.unref();
    await Promise.all([new Promise<void>(resolve => server.close(() => resolve())), stopWorker()]);
    await stopRegionCounts();
    await mongoose.disconnect();
    closeRedis();
    clearTimeout(deadline);
  };
  process.once("SIGTERM", () => { void shutdown(); });
  process.once("SIGINT", () => { void shutdown(); });
}).catch(() => {
  console.error("[MalikSe] Database startup failed");
  process.exit(1);
});

export default app;
