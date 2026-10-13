import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { publishedFilter } from "./marketplace";
import { publicFields } from "./propertyWorkflow";
import { pageInput, cursorFor } from "./pagination";
import { publicResponse, PublicResponse } from "./publicResponseCache";
import { publicBusy } from "./publicCacheGeneration";

function scalar(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 200) throw new Error(`Invalid ${name}`);
  return value.trim();
}
export const addressPattern = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
export function addressFields(pattern: RegExp) {
  return ["location.state", "location.district", "location.pincode", "location.block", "location.mauza", "location.policeStation", "title"].map(field => ({ [field]: pattern }));
}
export function normalizeSearch(input: Record<string, unknown>) {
  const location = scalar(input.location, "location");
  const type = scalar(input.type, "property type");
  if (type && !["land", "flat", "house", "shop", "office"].includes(type)) throw new Error("Invalid property type");
  const min = scalar(input.minPrice ?? input.budgetMin, "minimum price");
  const max = scalar(input.maxPrice ?? input.budgetMax, "maximum price");
  if ([min, max].some(v => v !== undefined && (!v || !Number.isFinite(Number(v)) || Number(v) < 0))) throw new Error("Invalid price filter");
  if (min !== undefined && max !== undefined && Number(min) > Number(max)) throw new Error("Minimum price exceeds maximum price");
  const page = Number(scalar(input.page, "page") ?? 1);
  const limit = Number(scalar(input.limit, "limit") ?? 100);
  const view = scalar(input.view, "view") ?? "full";
  if (!["cards", "full"].includes(view)) throw new Error("Invalid property view");
  if (!Number.isInteger(page) || page < 1 || page > 100 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Page must be 1–100 and limit 1–100");
  const filters: any = {
    ...(location ? { $text: { $search: location } } : {}),
    ...(type ? { type } : {}),
    ...(min !== undefined || max !== undefined ? { price: { ...(min !== undefined ? { $gte: Number(min) } : {}), ...(max !== undefined ? { $lte: Number(max) } : {}) } } : {}),
  };
  for (const field of ["district", "state"] as const) {
    const value = scalar(input[field], field);
    if (value) filters[`location.${field}`] = value;
  }
  const pincode = scalar(input.pincode, "pincode");
  if (pincode) {
    if (pincode !== "__missing__" && !/^[1-9]\d{5}$/.test(pincode)) throw new Error("Invalid pincode");
    filters["location.pincode"] = pincode === "__missing__" ? { $in: [null, ""] } : pincode;
  }
  const address = scalar(input.address, "address");
  if (address) {
    if (address.length < 2) throw new Error("Enter at least two characters");
    filters.$or = addressFields(addressPattern(address));
  }
  const cursor = pageInput(input).filter;
  if (input.cursor && page !== 1) throw new Error("Use a cursor or a page, not both");
  return { filters, cursor, page, limit, view, address: address?.toLowerCase() || "" };
}
export function getPublicSearchResponse(input: Record<string, unknown>): Promise<PublicResponse> {
  const parsed = normalizeSearch(input);
  return publicResponse({ db: Property.db.name, kind: "search", ...parsed }, async () => {
    const { filters, page, limit, view } = parsed;
    const fields = view === "cards" ? "title type location totalArea sellableArea price negotiable media status badges createdAt updatedAt" : publicFields;
    const skip = (page - 1) * limit;
    const visible: any[] = [];
    let cursor = parsed.cursor, scanned = 0, eligible = 0;
    const deadline = Date.now() + 3000;
    while (visible.length <= limit) {
      if (scanned >= 15000 || Date.now() >= deadline) throw publicBusy();
      // Bound both the property page and owner set; never enumerate all disabled owners.
      const batch: any[] = await Property.find({ ...publishedFilter, ...filters, ...cursor })
        .select(fields + " ownerId").sort({ createdAt: -1, _id: -1 }).limit(100).maxTimeMS(1500).lean();
      if (!batch.length) break;
      scanned += batch.length;
      const owners = await User.find({ _id: { $in: batch.map(row => row.ownerId) }, isSuspended: { $ne: true }, isActive: { $ne: false } }).select("_id").maxTimeMS(1000).lean();
      const enabled = new Set(owners.map(owner => String(owner._id)));
      for (const row of batch) {
        if (!enabled.has(String(row.ownerId))) continue;
        if (eligible++ < skip) continue;
        const { ownerId: _owner, ...dto } = row;
        if (view === "cards") dto.media = { photos: (dto.media?.photos || []).slice(0, 1) };
        visible.push(dto);
        if (visible.length > limit) break;
      }
      if (batch.length < 100) break;
      cursor = pageInput({ cursor: cursorFor(batch[batch.length - 1]) }).filter;
    }
    return { data: visible.slice(0, limit), nextCursor: visible.length > limit ? cursorFor(visible[limit - 1]) : "" };
  });
}
// HTTP routes send cached buffers; callers retain the existing service contract.
export async function searchProperties(input: Record<string, unknown>) {
  const value = await getPublicSearchResponse(input);
  return { results: JSON.parse(value.entry.body.toString()) as any[], nextCursor: value.entry.nextCursor, cacheHit: value.cacheHit };
}
