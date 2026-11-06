import mongoose, { Schema } from "mongoose";

export interface IPushDevice {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: "android" | "ios";
  updatedAt: Date;
}

const PushDeviceSchema = new Schema<IPushDevice>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ["android", "ios"], required: true },
}, { timestamps: true });

export const PushDevice = mongoose.model<IPushDevice>("PushDevice", PushDeviceSchema);
