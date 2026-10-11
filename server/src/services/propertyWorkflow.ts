import { Property, IProperty } from "../models/Property.model";
import { User } from "../models/User.model";
import { SearchCache } from "../models/SearchCache.model";
import { AssignmentCursor } from "../models/AssignmentCursor.model";

export const editableFields = ["title", "description", "type", "location", "parcelPoints", "khata", "khesra", "holdingNumber", "totalArea", "sellableArea", "boundary", "roadWidth", "price", "negotiable", "media", "disclosures"];
export const listingFields = (body: Record<string, unknown>) => Object.fromEntries(Object.entries(body).filter(([key]) => editableFields.includes(key)));
export const canReadProperty = (property: IProperty, actor: { id: string; role: string }) =>
  actor.role === "admin" || property.ownerId.toString() === actor.id ||
  (actor.role === "advisor" && property.assignedAdvisorId?.toString() === actor.id) ||
  (actor.role === "verifier" && property.assignedVerifierId?.toString() === actor.id);

export function validateListing(data: any) {
  if (!data.location?.state?.trim() || !data.location?.district?.trim()) return "State and district are required";
  if (!Number.isFinite(data.location.lat) || Math.abs(data.location.lat) > 90 || !Number.isFinite(data.location.lng) || Math.abs(data.location.lng) > 180) return "Provide valid GPS coordinates";
  if (![data.price, data.totalArea, data.sellableArea].every(n => Number.isFinite(n) && n > 0)) return "Price and areas must be positive numbers";
  if (data.sellableArea > data.totalArea) return "Sellable area cannot exceed total area";
  if (data.roadWidth !== undefined && (!Number.isFinite(data.roadWidth) || data.roadWidth < 0)) return "Invalid road width";
  for (const kind of ["photos", "videos"]) {
    const urls = data.media?.[kind];
    if (urls !== undefined && (!Array.isArray(urls) || urls.some((url: unknown) => typeof url !== "string" || !/^https?:\/\/\S+$/i.test(url)))) return "Media must contain http or https URLs";
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
  if (updated && (property.status === "verified" || updated.status === "verified")) {
    await SearchCache.deleteMany({}).catch(() => undefined);
  }
  return updated;
}

export const publicFields = "title description type location parcelPoints totalArea sellableArea boundary roadWidth price negotiable media disclosures status badges createdAt updatedAt";
