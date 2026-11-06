import "dotenv/config";
import mongoose from "mongoose";
import { Property } from "../models/Property.model";
import { historyEvent } from "../services/propertyWorkflow";
// Dry run by default. This preserves every historical report and owner chat.
async function main() {
  await mongoose.connect(process.env.MONGO_URI!);
  const apply = process.argv.includes("--apply");
  const rows = await Property.find({ $or: [{ status: "advisor_verified" }, { assignedAdvisorId: { $ne: null }, assignedVerifierId: { $ne: null } }] });
  console.log(JSON.stringify({ apply, affectedProperties: rows.length }));
  for (const property of rows) {
    const changes: any = {};
    if (property.assignedVerifierId) changes.assignedAdvisorId = null;
    if (property.status === "advisor_verified") changes.status = "pending";
    if (property.status === "verified" && !property.firstPublishedAt) changes.firstPublishedAt = property.verifierReview?.submittedAt || property.advisorReview?.submittedAt || property.createdAt;
    if (apply) await Property.updateOne({ _id: property._id, __v: property.__v }, { $set: changes, $inc: { __v: 1 }, $push: { verificationHistory: historyEvent({ id: "migration", role: "system" }, property.status, changes.status || property.status, "single_reviewer_migration") } });
  }
  await mongoose.disconnect();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
