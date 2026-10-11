import { isValidObjectId } from "mongoose";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { accountEnabled } from "./security";

export const publishedFilter = { status: "verified", "badges.fullyVerified": true, "advisorReview.decision": "approve", "verifierReview.decision": "approve" };
export async function publicPropertyFilter() {
  const unavailable = await User.find({ $or: [{ isSuspended: true }, { isActive: false }] }).select("_id");
  return { ...publishedFilter, ownerId: { $nin: unavailable.map(user => user._id) } };
}
export class OfferError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function offerProperty(actorId: string, propertyId: string, amount?: unknown) {
  const buyer = await User.findById(actorId);
  if (!buyer || buyer.role !== "user" || !accountEnabled(buyer) || !buyer.demoKycComplete) throw new OfferError(403, "Complete the demo KYC step as a User before contacting a seller or making an offer");
  if (!isValidObjectId(propertyId)) throw new OfferError(400, "Invalid property ID");
  const property = await Property.findById(propertyId);
  if (!property) throw new OfferError(404, "Property not found");
  const seller = await User.findById(property.ownerId);
  if (property.status !== "verified" || !property.badges.fullyVerified || property.advisorReview?.decision !== "approve" || property.verifierReview?.decision !== "approve" || !seller || !accountEnabled(seller)) throw new OfferError(409, "Offers are available only for fully approved published properties");
  if (property.ownerId.toString() === actorId) throw new OfferError(400, "You cannot make an offer on your own property");
  if (amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)) throw new OfferError(400, "Enter a positive offer amount");
  return property;
}
