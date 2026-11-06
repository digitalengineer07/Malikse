import { Schema, model } from "mongoose";

// TTL belongs on disposable tickets, never on the User collection.
const schema = new Schema({
  _id: { type: String, required: true },
  documentId: { type: Schema.Types.ObjectId, required: true },
  actorId: { type: Schema.Types.ObjectId, required: true },
  expiresAt: { type: Date, required: true },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const DocumentDownload = model("DocumentDownload", schema);
