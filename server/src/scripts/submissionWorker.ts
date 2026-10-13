import "dotenv/config";
import mongoose from "mongoose";
import { startSubmissionWorker } from "../services/submissionQueue";
import { Property } from "../models/Property.model";

async function main() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse");
  await Property.createIndexes();
  const stop = startSubmissionWorker();
  console.log("Submission worker started");
  const shutdown = async () => { await stop(); await mongoose.disconnect(); };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
main().catch(async () => { console.error("Could not start submission worker"); await mongoose.disconnect(); process.exitCode = 1; });
