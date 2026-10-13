import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { publishedFilter } from "./marketplace";
import { publicResponse } from "./publicResponseCache";
import { publicBusy } from "./publicCacheGeneration";

export function regionCounts(input: Record<string, unknown>) {
  const read = (key: string) => {
    const value = input[key];
    if (value === undefined) return "";
    if (typeof value !== "string" || !value.trim() || value.length > 200) throw new Error(`Invalid ${key}`);
    return value.trim();
  };
  const state = read("state"), district = read("district"), type = read("type");
  if (district && !state) throw new Error("Select a state first");
  if (type && !["land", "flat", "house", "shop", "office"].includes(type)) throw new Error("Invalid property type");
  const level = district ? "pincode" : state ? "district" : "state";
  return publicResponse({ db: Property.db.name, kind: "regions", state, district, type }, async () => {
    // Group by owner first to avoid repeating the eligibility lookup per listing.
    // Only aggregates leave MongoDB: no property cards, media, or parcel geometry.
    const groups = await Property.aggregate([
      { $match: { ...publishedFilter, ...(state ? { "location.state": state } : {}), ...(district ? { "location.district": district } : {}), ...(type ? { type } : {}) } },
      { $group: { _id: { region: { $ifNull: [`$location.${level}`, ""] }, owner: "$ownerId" }, count: { $sum: 1 }, lat: { $sum: "$location.lat" }, lng: { $sum: "$location.lng" } } },
      { $lookup: { from: User.collection.name, localField: "_id.owner", foreignField: "_id", pipeline: [{ $match: { isSuspended: { $ne: true }, isActive: { $ne: false } } }, { $project: { _id: 1 } }], as: "owner" } },
      { $match: { "owner.0": { $exists: true } } },
      { $group: { _id: "$_id.region", count: { $sum: "$count" }, lat: { $sum: "$lat" }, lng: { $sum: "$lng" } } },
      { $sort: { _id: 1 } }, { $limit: 2001 },
      { $project: { _id: 0, name: "$_id", count: 1, lat: { $divide: ["$lat", "$count"] }, lng: { $divide: ["$lng", "$count"] } } },
    ]).option({ maxTimeMS: 3000 });
    if (groups.length > 2000) throw publicBusy();
    return { data: { level, groups: groups.map(group => ({ ...group, key: group.name || "__missing__", name: group.name || (level === "pincode" ? "Pincode not provided" : "Location not provided") })) } };
  });
}
