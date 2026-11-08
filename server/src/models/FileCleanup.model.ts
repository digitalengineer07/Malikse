import mongoose, { Schema } from "mongoose";
export const FileCleanup = mongoose.model("FileCleanup", new Schema({
  _id: String, bucket: { type: String, enum: ["kyc", "documents"], required: true }, fileId: { type: Schema.Types.ObjectId, required: true },
  nextAttemptAt: { type: Date, default: Date.now, index: true }, attempts: { type: Number, default: 0 },
}));
