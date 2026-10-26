import { Schema, model } from "mongoose";

// Durable password reset challenge per user, shared across API processes
const schema = new Schema({
  _id: { type: String, required: true }, // User's ID or mobile number as unique key
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  identifier: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String },
  challengeId: { type: String, required: true, index: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  resendAt: { type: Date, required: true },
  lockUntil: { type: Date, default: () => new Date(0) },
  attempts: { type: Number, default: 0 },
  deleteAt: { type: Date, required: true },
});

schema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
export const PasswordReset = model("PasswordReset", schema);
