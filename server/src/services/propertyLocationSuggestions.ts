import { Property } from "../models/Property.model";
import { publishedFilter, enabledOwnerStages } from "./marketplace";
import { addressFields, addressPattern } from "./propertySearch";
import { publicResponse } from "./publicResponseCache";
import { replicaReadPreference } from "./readReplica";

export type LocationSuggestion = { kind: "state" | "district" | "pincode" | "address"; label: string; state: string; district?: string; pincode?: string; lat: number; lng: number };
export function locationSuggestions(input: Record<string, unknown>) {
  const query = input.q;
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 80) throw new Error("Enter 2–80 address characters");
  const q = query.trim().toLowerCase();
  const type = input.type;
  if (type !== undefined && (typeof type !== "string" || !["land", "flat", "house", "shop", "office"].includes(type))) throw new Error("Invalid property type");
  return publicResponse({ db: Property.db.name, kind: "location-suggestions", q, type }, async () => {
    const base = { state: "$location.state", district: "$location.district", pincode: { $ifNull: ["$location.pincode", ""] }, lat: "$location.lat", lng: "$location.lng" };
    const suggestion = (field: string, kind: string, rank: number, label: any) => ({ $cond: [
      { $regexMatch: { input: { $convert: { input: `$${field}`, to: "string", onNull: "", onError: "" } }, regex: addressPattern(q) } },
      { ...base, kind, rank, label }, null,
    ] });
    const addressLabel = (field: string) => ({ $concat: [`$${field}`, ", ", "$location.district", ", ", "$location.state"] });
    const rows = await Property.aggregate([
      { $match: { ...publishedFilter, ...(type ? { type } : {}), $or: addressFields(addressPattern(q)),
        "location.state": { $type: "string", $ne: "" }, "location.district": { $type: "string", $ne: "" },
        "location.lat": { $type: "number", $gte: -90, $lte: 90 }, "location.lng": { $type: "number", $gte: -180, $lte: 180 },
      } },
      ...enabledOwnerStages(),
      { $project: { suggestions: [
        suggestion("location.state", "state", 0, "$location.state"),
        suggestion("location.district", "district", 1, { $concat: ["$location.district", ", ", "$location.state"] }),
        suggestion("location.pincode", "pincode", 2, { $concat: ["$location.pincode", " · ", "$location.district", ", ", "$location.state"] }),
        ...["location.block", "location.mauza", "location.policeStation", "title"].map(field => suggestion(field, "address", 3, addressLabel(field))),
      ] } },
      { $unwind: "$suggestions" },
      { $match: { suggestions: { $ne: null } } },
      { $group: { _id: { kind: "$suggestions.kind", state: "$suggestions.state", label: "$suggestions.label",
        district: { $cond: [{ $eq: ["$suggestions.kind", "state"] }, "", "$suggestions.district"] },
        pincode: { $cond: [{ $in: ["$suggestions.kind", ["address", "pincode"]] }, "$suggestions.pincode", ""] },
      }, item: { $first: "$suggestions" } } },
      { $replaceRoot: { newRoot: "$item" } },
      { $sort: { rank: 1, label: 1 } }, { $limit: 20 }, { $unset: "rank" },
    ]).read(replicaReadPreference()).option({ maxTimeMS: 2500, allowDiskUse: true });
    return { data: rows };
  });
}
