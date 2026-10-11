import { createHash } from "crypto";
import { SearchCache } from "../models/SearchCache.model";
import { Property } from "../models/Property.model";
import { publicPropertyFilter } from "./marketplace";
import { publicFields } from "./propertyWorkflow";

const inFlight = new Map<string, Promise<string[]>>();
const ttlMs = 15_000;

function scalar(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 200) throw new Error(`Invalid ${name}`);
  return value.trim();
}

export async function searchProperties(input: Record<string, unknown>) {
  const location = scalar(input.location, "location");
  const type = scalar(input.type, "property type");
  if (type && !["land", "flat", "house", "shop", "office"].includes(type)) throw new Error("Invalid property type");
  const min = scalar(input.minPrice ?? input.budgetMin, "minimum price");
  const max = scalar(input.maxPrice ?? input.budgetMax, "maximum price");
  if ([min, max].some(v => v !== undefined && (!v || !Number.isFinite(Number(v)) || Number(v) < 0))) throw new Error("Invalid price filter");
  if (min !== undefined && max !== undefined && Number(min) > Number(max)) throw new Error("Minimum price exceeds maximum price");
  const page = Number(scalar(input.page, "page") ?? 1);
  const limit = Number(scalar(input.limit, "limit") ?? 100);
  if (!Number.isInteger(page) || page < 1 || page > 100 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Page must be 1–100 and limit 1–100");
  const filters: any = {
    ...(location ? { $text: { $search: location } } : {}),
    ...(type ? { type } : {}),
    ...(min !== undefined || max !== undefined ? { price: { ...(min !== undefined ? { $gte: Number(min) } : {}), ...(max !== undefined ? { $lte: Number(max) } : {}) } } : {}),
  };
  // Canonical parsed filters make aliases and numeric spellings share a SHA-256 key.
  const key = createHash("sha256").update(JSON.stringify({ version: 1, filters, page, limit })).digest("hex");
  const visibility = await publicPropertyFilter();
  const query = { ...visibility, ...filters };
  const cached = await SearchCache.findOne({ _id: key, expiresAt: { $gt: new Date() } }).lean().catch(() => null);
  let ids: string[];
  if (cached) ids = cached.ids.map(String);
  else {
    let work = inFlight.get(key);
    if (!work) {
      if (inFlight.size >= 50) throw new Error("Search is busy. Please try again shortly.");
      work = (async () => {
        const found = await Property.find(query).select("_id").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean();
        const values = found.map(p => String(p._id));
        await SearchCache.updateOne({ _id: key }, { $set: { ids: values, expiresAt: new Date(Date.now() + ttlMs) } }, { upsert: true }).catch(() => undefined);
        return values;
      })().finally(() => { inFlight.delete(key); });
      inFlight.set(key, work);
    }
    ids = await work;
  }
  // Cache only candidate IDs. Always recheck visibility and filters and fetch
  // current public fields: cache hits cannot reveal suspended/private listings.
  const results = await Property.find({ ...query, _id: { $in: ids } }).select(publicFields).sort({ createdAt: -1, _id: -1 }).lean();
  return { results, cacheHit: !!cached };
}
