import { RegionCount } from "../models/RegionCount.model";
import { regionCountGeneration } from "./regionCountStore";
import { publicResponse } from "./publicResponseCache";
import { publicBusy } from "./publicCacheGeneration";

export async function regionCounts(input: Record<string, unknown>) {
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
  const generation = await regionCountGeneration();
  return publicResponse({ db: RegionCount.db.name, kind: "regions", generation, state, district, type }, async () => {
    const groups = await RegionCount.find({ generation, level, state, district, propertyType: type || "all", count: { $gt: 0 } })
      .select("-_id key count lat lng").sort({ key: 1 }).limit(2001).lean().maxTimeMS(1500);
    if (groups.length > 2000) throw publicBusy();
    return { data: { level, groups: groups.map(group => ({ key: group.key || "__missing__", name: group.key || (level === "pincode" ? "Pincode not provided" : "Location not provided"), count: group.count, lat: group.lat, lng: group.lng })) } };
  });
}
