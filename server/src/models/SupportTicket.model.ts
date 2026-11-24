import mongoose, { Schema } from "mongoose";

export const supportCategories = ["account", "verification", "listing", "conversation", "assignment", "other"] as const;
export const supportStatuses = ["open", "awaiting_reply", "resolved"] as const;

const messageSchema = new Schema({
  author: { type: Schema.Types.ObjectId, required: true },
  side: { type: String, enum: ["requester", "support"], required: true },
  body: { type: String, required: true, maxlength: 2000 },
  requestId: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
}, { _id: false });

const schema = new Schema({
  requester: { type: Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: String, enum: supportCategories, required: true },
  subject: { type: String, required: true, maxlength: 100 },
  status: { type: String, enum: supportStatuses, default: "open", required: true },
  referenceKind: { type: String, enum: ["property", "conversation"] },
  referenceId: Schema.Types.ObjectId,
  requestId: { type: String, required: true },
  messages: { type: [messageSchema], required: true },
}, { timestamps: true });

schema.index({ requester: 1, requestId: 1 }, { unique: true });
schema.index({ requester: 1, updatedAt: -1, _id: -1 });
schema.index({ status: 1, updatedAt: -1, _id: -1 });
schema.index({ updatedAt: -1, _id: -1 });
export const SupportTicket = mongoose.model("SupportTicket", schema);
