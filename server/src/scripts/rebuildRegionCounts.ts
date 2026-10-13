import "dotenv/config";
import mongoose from "mongoose";
import { startRegionCounts, refreshRegionCounts, stopRegionCounts } from "../services/regionCountStore";
import { RegionCountState } from "../models/RegionCount.model";
import { mongoPoolOptions } from "../services/mongoPool";

async function main() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/malikse", { ...mongoPoolOptions() });
  await startRegionCounts();
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = await RegionCountState.findById("public-regions-v1").lean();
    if (state?.generation && state.revision === state.builtRevision) { console.log("Area count snapshot rebuilt successfully");return; }
    await new Promise(resolve => setTimeout(resolve, 1000));
    await refreshRegionCounts();
  }
  throw new Error("Area count refresh still pending; another worker may be refreshing it");
}
main().catch(error => { console.error(error.message);process.exitCode = 1; }).finally(async () => { await stopRegionCounts();await mongoose.disconnect(); });
