import { Schema, model } from "mongoose";

export const SearchCache = model("PropertySearchCache", new Schema({
  _id: String,
  ids: [{ type: Schema.Types.ObjectId }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}));
