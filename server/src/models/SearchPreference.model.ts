import mongoose, { Schema } from "mongoose";
const schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    searches: {
      type: [
        new Schema(
          { district: String, type: String, maxPrice: Number, at: Date },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
export const SearchPreference = mongoose.model("SearchPreference", schema);
