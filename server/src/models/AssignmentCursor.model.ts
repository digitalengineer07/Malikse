import { Schema, model } from "mongoose";

// One atomic counter per role, shared by every API/worker process.
export const AssignmentCursor = model("AssignmentCursor", new Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
}));
