import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { publishedFilter } from "./marketplace";
import { addressFields, addressPattern } from "./propertySearch";
import { publicResponse } from "./publicResponseCache";

export type LocationSuggestion = { kind: "state" | "district" | "pincode" | "address"; label: string; state: string; district?: string; pincode?: string; lat: number; lng: number };
export function locationSuggestions(input: Record<string, unknown>) {
  const query = input.q;
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 80) throw new Error("Enter 2–80 address characters");
  const q = query.trim().toLowerCase();
  const type = input.type;
  if (type !== undefined && (typeof type !== "string" || !["land", "flat", "house", "shop", "office"].includes(type))) throw new Error("Invalid property type");
  return publicResponse({ db: Property.db.name, kind: "location-suggestions", q, type }, async () => {
    // Bounded, projected search. Cards, media and boundaries never leave MongoDB.
    const rows = await Property.find({ ...publishedFilter, ...(type ? { type } : {}), $or: addressFields(addressPattern(q)) })
      .select("ownerId title location.state location.district location.pincode location.block location.mauza location.policeStation location.lat location.lng")
      .limit(500).maxTimeMS(1500).lean();
    const enabled = new Set((await User.find({ _id: { $in: rows.map(row => row.ownerId) }, isSuspended: { $ne: true }, isActive: { $ne: false } }).select("_id").maxTimeMS(1000).lean()).map(user => String(user._id)));
    const results = new Map<string, LocationSuggestion>();
    const matches = (value: unknown) => typeof value === "string" && value.toLowerCase().includes(q);
    function add(item: LocationSuggestion) {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng) || Math.abs(item.lat) > 90 || Math.abs(item.lng) > 180) return;
      const key = item.kind === "state" ? [item.kind, item.state].join("|")
        : item.kind === "district" ? [item.kind, item.state, item.district].join("|")
        : item.kind === "pincode" ? [item.kind, item.state, item.district, item.pincode].join("|")
        : [item.kind, item.state, item.district, item.pincode, item.label].join("|");
      if (!results.has(key)) results.set(key, item);
    }
    for (const row of rows) {
      if (!enabled.has(String(row.ownerId))) continue;
      const location = row.location;
      if (!location?.state || !location.district) continue;
      const base = { state: location.state, district: location.district, pincode: location.pincode || undefined, lat: location.lat, lng: location.lng };
      if (matches(location.state)) add({ ...base, kind: "state", label: location.state });
      if (matches(location.district)) add({ ...base, kind: "district", label: `${location.district}, ${location.state}` });
      if (matches(location.pincode)) add({ ...base, kind: "pincode", label: `${location.pincode} · ${location.district}, ${location.state}` });
      for (const field of ["block", "mauza", "policeStation"] as const) {
        if (matches(location[field])) add({ ...base, kind: "address", label: `${location[field]}, ${location.district}, ${location.state}` });
      }
      if (matches(row.title)) add({ ...base, kind: "address", label: `${row.title}, ${location.district}, ${location.state}` });
    }
    const rank = { state: 0, district: 1, pincode: 2, address: 3 };
    return { data: [...results.values()].sort((a, b) => rank[a.kind] - rank[b.kind] || a.label.localeCompare(b.label)).slice(0, 20) };
  });
}
