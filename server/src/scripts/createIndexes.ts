import "dotenv/config";
import mongoose from "mongoose";
import { createRequiredIndexes, verifyRequiredIndexes } from "../services/requiredIndexes";
async function main() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse", { autoIndex: false });
  try { await createRequiredIndexes(); await verifyRequiredIndexes(); console.log("Required indexes verified"); }
  finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error("Index migration failed", error.message); process.exitCode = 1; });
