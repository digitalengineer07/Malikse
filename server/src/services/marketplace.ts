import { isValidObjectId, type PipelineStage } from "mongoose";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { accountEnabled, identityApproved } from "./security";

export const publishedFilter = { status: "verified", reservedDealId: null, "badges.fullyVerified": true, $and: [{ $or: [{ "advisorReview.decision": "approve" }, { "verifierReview.decision": "approve" }] }] };
export function enabledOwnerStages(populateOwner = false): PipelineStage[] {
  return [
    { $lookup: { from: User.collection.name, localField: "ownerId", foreignField: "_id", pipeline: [
      { $match: { isSuspended: { $ne: true }, isActive: { $ne: false } } },
      { $project: populateOwner ? { _id: 1, name: 1, mobile: 1 } : { _id: 1 } },
    ], as: "availableOwner" } },
    { $match: { "availableOwner.0": { $exists: true } } },
    ...(populateOwner ? [{ $set: { ownerId: { $arrayElemAt: ["$availableOwner", 0] } } }] : []),
    { $unset: "availableOwner" },
  ];
}
export class OfferError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function offerProperty(actorId: string, propertyId: string, amount?: unknown) {
  const buyer = await User.findById(actorId);
  if (!buyer || buyer.role !== "user" || !accountEnabled(buyer) || !identityApproved(buyer)) throw new OfferError(403, "Complete identity verification before contacting assigned staff or making an offer");
  if (!isValidObjectId(propertyId)) throw new OfferError(400, "Invalid property ID");
  const property = await Property.findById(propertyId);
  if (!property) throw new OfferError(404, "Property not found");
  const seller = await User.findById(property.ownerId);
  if (property.status !== "verified" || !property.badges.fullyVerified || (property.advisorReview?.decision !== "approve" && property.verifierReview?.decision !== "approve") || !seller || !accountEnabled(seller)) throw new OfferError(409, "Offers are available only for fully approved published properties");
  if (property.ownerId.toString() === actorId) throw new OfferError(400, "You cannot make an offer on your own property");
  if (amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)) throw new OfferError(400, "Enter a positive offer amount");
  if (property.reservedDealId) throw new OfferError(409, "This property is reserved");
  await assignedStaff(property);
  return property;
}

export async function assignedStaff(property: any) {
  const id = property.assignedVerifierId || property.assignedAdvisorId;
  const role = property.assignedVerifierId ? "verifier" : "advisor";
  const staff = id && await User.findOne({ _id: id, role, isActive: { $ne: false }, isSuspended: { $ne: true } });
  if (!staff) throw new OfferError(409, "Assigned staff is unavailable. Please try again after reassignment");
  return staff;
}
