import { Schema, model } from "mongoose";

// Personal identifiers are retained only while cleanup needs them. Completed
// receipts contain no account link and expire after 90 days.
const schema = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["pending", "processing", "awaiting_deals", "completed"], default: "pending" },
  requestedAt: { type: Date, default: Date.now },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseToken: String,
  leaseUntil: Date,
  attempts: { type: Number, default: 0 },
  email: String,
  mobile: String,
  completedAt: Date,
  expiresAt: Date,
});
schema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const AccountDeletion = model("AccountDeletion", schema);
