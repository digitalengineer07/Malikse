import mongoose, { Schema } from "mongoose";
const schema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: String,
    body: String,
    data: Schema.Types.Mixed,
    deliveredAt: Date,
    failedAt: Date,
    lastError: String,
    acceptedTokens: { type: [String], default: [] },
    permanentTokens: { type: [String], default: [] },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: Date,
  },
  { timestamps: true },
);
schema.index({ deliveredAt: 1, nextAttemptAt: 1, leaseUntil: 1 });
export const Notification = mongoose.model("Notification", schema);
