import { Schema, model } from "mongoose";
export const ContactChange = model("ContactChange", new Schema({
  _id: String, challenge: String, email: String, previousEmail: String, previousMobile: String,
  sessionVersion: Number, oldChannel: String, oldProvider: String, oldHash: String, newHash: String,
  attempts: { type: Number, default: 0 }, ready: { type: Boolean, default: false },
  expiresAt: { type: Date, expires: 0 }, resendAt: Date,
}));
