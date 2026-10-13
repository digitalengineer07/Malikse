import { Schema, model } from "mongoose";

// One durable challenge per number, shared by every API process.
const schema = new Schema({
  _id: { type: String, required: true },
  challengeId: String,
  name: String,
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
