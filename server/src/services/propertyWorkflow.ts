import { Property, IProperty } from "../models/Property.model";
import { User } from "../models/User.model";
import { AssignmentCursor } from "../models/AssignmentCursor.model";

export const editableFields = ["requestedAdvisorId", "title", "description", "type", "location", "parcelPoints", "khata", "khesra", "holdingNumber", "totalArea", "sellableArea", "boundary", "roadWidth", "price", "negotiable", "media", "disclosures"];
export const listingFields = (body: Record<string, unknown>) => Object.fromEntries(Object.entries(body).filter(([key]) => editableFields.includes(key) && key !== "media"));
export const canReadProperty = (property: IProperty, actor: { id: string; role: string }) =>
  actor.role === "admin" || property.ownerId.toString() === actor.id ||
  (actor.role === "advisor" && property.assignedAdvisorId?.toString() === actor.id) ||
  (actor.role === "verifier" && property.assignedVerifierId?.toString() === actor.id);

export function mediaInputError(input: unknown, current?: { photos?: string[]; videos?: string[] }) {
  if (input === undefined) return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Invalid media object";
  for (const [key, urls] of Object.entries(input)) {
    if (!["photos", "videos"].includes(key) || !Array.isArray(urls) || urls.length > (key === "photos" ? 10 : 0) || urls.some(url => typeof url !== "string")) return "Invalid media list";
    const existing = current?.[key as "photos" | "videos"] || [];
    if (JSON.stringify(urls) !== JSON.stringify(existing)) return "Use the property photo upload endpoint";
  }
  return null;
}

export function validateListing(data: any) {
  const object = (v: any) => v && typeof v === "object" && !Array.isArray(v);
  if (!object(data) || !object(data.location)) return "Provide valid listing and location objects";
  for (const key of ["state", "district", "block", "mauza", "address", "pincode"]) {
    const value = data.location[key];
    if (value !== undefined && (typeof value !== "string" || value.length > 500)) return "Invalid location text";
  }
  for (const key of ["title", "description", "khata", "khesra", "holdingNumber"]) {
    if (data[key] !== undefined && (typeof data[key] !== "string" || data[key].length > (key === "description" ? 10000 : 500))) return "Invalid listing text";
  }
  if (!["land", "flat", "house", "shop", "office"].includes(data.type)) return "Invalid property type";
  if (data.negotiable !== undefined && typeof data.negotiable !== "boolean") return "Invalid negotiable flag";
  if (data.boundary !== undefined && (typeof data.boundary !== "string" || data.boundary.length > 2000)) return "Invalid boundary";
  if (data.disclosures !== undefined) {
    if (!object(data.disclosures)) return "Invalid disclosures";
    for (const key of ["hasLoan", "hasDispute"]) if (data.disclosures[key] !== undefined && typeof data.disclosures[key] !== "boolean") return "Invalid disclosures";
    if (data.disclosures.possessionStatus !== undefined && (typeof data.disclosures.possessionStatus !== "string" || data.disclosures.possessionStatus.length > 200)) return "Invalid possession status";
  }
  if (data.media !== undefined && !object(data.media)) return "Invalid media";
  if (data.parcelPoints !== undefined && (!Array.isArray(data.parcelPoints) || data.parcelPoints.length > 500 || data.parcelPoints.some((p: any) => !object(p)))) return "Invalid boundary points";
  if (data.location?.pincode !== undefined && (typeof data.location.pincode !== "string" || (data.location.pincode !== "" && !/^[1-9]\d{5}$/.test(data.location.pincode)))) return "Enter a valid six-digit pincode";
  if (!data.location?.state?.trim() || !data.location?.district?.trim()) return "State and district are required";
  if (!Number.isFinite(data.location.lat) || Math.abs(data.location.lat) > 90 || !Number.isFinite(data.location.lng) || Math.abs(data.location.lng) > 180) return "Provide valid GPS coordinates";
  if (![data.price, data.totalArea, data.sellableArea].every(n => Number.isFinite(n) && n > 0)) return "Price and areas must be positive numbers";
  if (data.sellableArea > data.totalArea) return "Sellable area cannot exceed total area";
  if (data.roadWidth !== undefined && (!Number.isFinite(data.roadWidth) || data.roadWidth < 0)) return "Invalid road width";
  for (const kind of ["photos", "videos"]) {
    const urls = data.media?.[kind];
    if (urls !== undefined && (!Array.isArray(urls) || urls.length > (kind === "photos" ? 10 : 0) || urls.some((url: unknown) => typeof url !== "string" || !/^https?:\/\/\S+$/i.test(url)))) return "Media must contain http or https URLs";
  }
  if (data.parcelPoints?.some((p: any) => !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || !Number.isFinite(p.lng) || Math.abs(p.lng) > 180)) return "Invalid boundary coordinates";
  return null;
}

export const activeStaffFilter = { isActive: { $ne: false }, isSuspended: { $ne: true }, passwordHash: { $exists: true, $nin: [null, ""] } };

export async function availableStaff(role: "advisor" | "verifier", preferred?: unknown) {
  if (preferred && await User.exists({ _id: preferred, role, ...activeStaffFilter })) return preferred;
  const people = await User.find({ role, ...activeStaffFilter }).select("_id").sort({ _id: 1 });
  if (!people.length) return undefined;
  // Initialize separately: concurrent first-use upserts can collide on _id.
  try { await AssignmentCursor.updateOne({ _id: role }, { $setOnInsert: { sequence: 0 } }, { upsert: true }); }
  catch (error: any) { if (error.code !== 11000) throw error; }
  const cursor = await AssignmentCursor.findOneAndUpdate({ _id: role }, { $inc: { sequence: 1 } }, { new: true });
  return people[(cursor!.sequence! - 1) % people.length]._id;
}

export function historyEvent(actor: { id: string; role: string }, from: string, to: string, action: string, extra: object = {}) {
  return { actorId: actor.id, role: actor.role, fromStatus: from, toStatus: to, action, at: new Date(), ...extra };
}

// Version checks prevent simultaneous reviewers or edits from overwriting decisions.
export async function transition(property: IProperty, changes: object, event: object) {
  const updated = await Property.findOneAndUpdate({ _id: property._id, __v: property.__v, status: property.status }, {
    $set: changes, $inc: { __v: 1 }, $push: { verificationHistory: event },
  }, { new: true, runValidators: true });
  return updated;
}

export const publicFields = "title description type location parcelPoints totalArea sellableArea boundary roadWidth price negotiable media disclosures status badges firstPublishedAt createdAt updatedAt";
