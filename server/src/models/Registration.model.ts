import { Schema, model } from "mongoose";

// One durable challenge per mobile or email, shared by every API process.
const schema = new Schema({
  _id: { type: String, required: true },
  challengeId: String,
  channel: { type: String, enum: ["mobile", "email"], default: "mobile" },
  name: String,
  mobile: String,
  email: String,
  passwordHash: String,
  otpHash: String,
  expiresAt: Date,
  resendAt: Date,
  lockUntil: Date,
  attempts: { type: Number, default: 0 },
  deleteAt: { type: Date, required: true },
});
schema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
export const Registration = model("Registration", schema);
