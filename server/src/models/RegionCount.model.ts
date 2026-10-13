import mongoose, { Schema } from "mongoose";

// Derived data only. Listings remain the source of truth; snapshots can be rebuilt.
const RegionCountSchema = new Schema({
  generation: { type: String, required: true },
  level: { type: String, enum: ["state", "district", "pincode"], required: true },
  state: { type: String, default: "" }, district: { type: String, default: "" },
  key: { type: String, default: "" },
  propertyType: { type: String, enum: ["all", "land", "flat", "house", "shop", "office"], required: true },
  count: { type: Number, required: true, min: 0 }, lat: Number, lng: Number,
  builtAt: { type: Date, required: true },
}, { versionKey: false });
RegionCountSchema.index({ generation: 1, level: 1, state: 1, district: 1, propertyType: 1, key: 1 }, { unique: true, name: "region_count_lookup" });
RegionCountSchema.index({ builtAt: 1 }, { name: "region_count_cleanup" });
export const RegionCount = mongoose.model("RegionCount", RegionCountSchema);

const RegionCountStateSchema = new Schema({
  _id: { type: String }, revision: { type: Number, default: 0 },
  builtRevision: { type: Number, default: -1 }, generation: { type: String, default: "" },
  leaseToken: String, leaseUntil: Date, builtAt: Date,
}, { versionKey: false });
export const RegionCountState = mongoose.model("RegionCountState", RegionCountStateSchema);
