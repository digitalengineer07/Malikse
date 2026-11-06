import mongoose, { Schema } from "mongoose";
const schema = new Schema({ propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true }, actor: { type: String, required: true }, kind: { type: String, enum: ["view", "search", "save"], required: true }, day: { type: String, required: true }, createdAt: { type: Date, default: Date.now, expires: 2592000 } });
schema.index({ propertyId: 1, actor: 1, kind: 1, day: 1 }, { unique: true });
schema.index({ createdAt: -1, propertyId: 1 });
export const Engagement = mongoose.model("Engagement", schema);
