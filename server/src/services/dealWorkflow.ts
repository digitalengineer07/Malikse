import { markRegionCountsDirty } from "./regionCountStore";
import { Notification } from "../models/Notification.model";
import { invalidatePublicResponses } from "./publicCacheGeneration";
import mongoose from "mongoose";
import { Deal } from "../models/Deal.model";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { Inquiry } from "../models/Inquiry.model";
import { assignedStaff, offerProperty, OfferError } from "./marketplace";
import { identityApproved } from "./security";
import { sendPush } from "./pushNotifications";

export async function createOffer(
  buyerId: string,
  propertyId: string,
  amount: unknown,
  message?: string,
  requestKey?: string,
) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)
    throw new OfferError(400, "Enter a positive offer amount");
  if (requestKey) {
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))
      throw new OfferError(400, "Invalid request key");
    const previous = await Deal.findOne({ buyerId, requestKey });
    if (previous) {
      if (
        String(previous.propertyId) !== propertyId ||
        previous.offerAmount !== amount
      )
        throw new OfferError(
          409,
          "Request key already used for a different offer",
        );
      return previous;
    }
  }
  const property = await offerProperty(buyerId, propertyId, amount);
  const staff = await assignedStaff(property);
  const session = await mongoose.startSession();
  let deal: any;
  try {
    await session.withTransaction(async () => {
      const available = await Property.updateOne(
        {
          _id: property._id,
          status: "verified",
          reservedDealId: null,
          __v: property.__v,
        },
        { $inc: { __v: 1 } },
        { session },
      );
      if (!available.modifiedCount)
        throw new OfferError(
          409,
          "Property changed; refresh before making an offer",
        );
      [deal] = await Deal.create(
        [
          {
            propertyId,
            requestKey,
            buyerId,
            ownerId: property.ownerId,
            staffId: staff._id,
            offerAmount: amount,
            commissionAmount: amount * 0.0118,
            status: "offered",
            history: [
              { actorId: buyerId, status: "offered", amount, at: new Date() },
            ],
          },
        ],
        { session },
      );
      if (message)
        await Inquiry.create(
          [
            {
              propertyId,
              buyerId,
              staffId: staff._id,
              dealId: deal._id,
              message,
              offerAmount: amount,
              buyerReadAt: new Date(),
            },
          ],
          { session, ordered: true },
        );
      await Notification.create(
        [
          {
            recipient: staff._id,
            title: "New offer",
            body: "A buyer sent an offer on your assigned property.",
            data: { kind: "deal", id: String(deal._id) },
          },
        ],
        { session, ordered: true },
      );
    });
  } finally {
    await session.endSession();
    invalidatePublicResponses();
    await markRegionCountsDirty();
  }
  return deal;
}

export async function changeDeal(
  id: string,
  actor: { id: string; role: string },
  input: any,
) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const deal = await Deal.findById(id).session(session);
      if (!deal) throw new OfferError(404, "Deal not found");
      const property = await Property.findById(deal.propertyId).session(
        session,
      );
      if (!property) throw new OfferError(404, "Property not found");
      const staff = await assignedStaff(property);
      const isStaff = actor.id === String(staff._id);
      const isBuyer = actor.id === String(deal.buyerId);
      const admin = actor.role === "admin";
      if (!isStaff && !isBuyer && !admin)
        throw new OfferError(
          403,
          "Only the buyer and assigned staff can act on this deal",
        );
      const status = input.status;
      if (
        deal.status === "completed" &&
        status === "completed" &&
        (isStaff || admin)
      ) {
        result = deal;
        return;
      }
      const allowed: Record<string, string[]> = {
        offered: ["accepted", "rejected", "countered", "cancelled"],
        countered: ["accepted", "countered", "rejected", "cancelled"],
        accepted: ["completed", "token_paid", "cancelled"],
        token_paid: ["completed", "cancelled"],
      };
      if (!allowed[deal.status]?.includes(status))
        throw new OfferError(409, "Invalid deal transition");
      if (
        !admin &&
        !isStaff &&
        !(
          isBuyer &&
          (status === "cancelled" ||
            (deal.status === "countered" &&
              ["accepted", "rejected", "countered"].includes(status)))
        )
      )
        throw new OfferError(
          403,
          "Only assigned staff can perform this action",
        );
      const proposal = [...deal.history]
        .reverse()
        .find((h) => ["offered", "countered"].includes(h.status));
      if (
        !admin &&
        status === "accepted" &&
        String(proposal?.actorId) === actor.id
      )
        throw new OfferError(
          403,
          "Wait for the other party to accept your proposal",
        );
      if (status === "token_paid" && !admin)
        throw new OfferError(
          403,
          "Payment confirmation requires the existing Admin process",
        );
      if (status === "accepted") {
        const buyer = await User.findById(deal.buyerId).session(session);
        if (
          !buyer ||
          !identityApproved(buyer) ||
          buyer.isSuspended ||
          !buyer.isActive
        )
          throw new OfferError(
            403,
            "Buyer must have approved KYC and an active account",
          );
      }
      const changes: any = { status, staffId: staff._id };
      if (status === "countered") {
        if (
          typeof input.counterAmount !== "number" ||
          !Number.isFinite(input.counterAmount) ||
          input.counterAmount <= 0
        )
          throw new OfferError(400, "Enter a positive counter amount");
        changes.counterAmount = input.counterAmount;
      }
      const filter: any = {
        _id: property._id,
        status: "verified",
        __v: property.__v,
      };
      const propertyChanges: any = {};
      if (status === "accepted") {
        filter.reservedDealId = null;
        propertyChanges.reservedDealId = deal._id;
        changes.commissionAmount =
          (deal.counterAmount || deal.offerAmount) * 0.0118;
      }
      if (status === "completed") {
        filter.reservedDealId = deal._id;
        Object.assign(propertyChanges, {
          status: "sold",
          soldAt: new Date(),
          soldBy: actor.id,
        });
      }
      if (
        status === "cancelled" &&
        String(property.reservedDealId) === String(deal._id)
      )
        propertyChanges.reservedDealId = null;
      const changed = await Property.updateOne(
        filter,
        {
          $inc: { __v: 1 },
          ...(Object.keys(propertyChanges).length
            ? { $set: propertyChanges }
            : {}),
        },
        { session },
      );
      if (!changed.modifiedCount)
        throw new OfferError(
          409,
          "Property is no longer available or changed. Refresh and retry",
        );
      result = await Deal.findOneAndUpdate(
        { _id: deal._id, status: deal.status, __v: deal.__v },
        {
          $set: changes,
          $inc: { __v: 1 },
          $push: {
            history: {
              actorId: actor.id,
              status,
              amount: input.counterAmount,
              terms:
                typeof input.terms === "string"
                  ? input.terms.slice(0, 2000)
                  : undefined,
              at: new Date(),
            },
          },
        },
        { new: true, session },
      );
      if (!result) throw new OfferError(409, "Deal changed; refresh and retry");
      if (["accepted", "countered", "rejected"].includes(status))
        await Inquiry.updateMany(
          { dealId: deal._id },
          { $set: { status } },
          { session },
        );
      await Notification.create(
        [
          {
            recipient: deal.buyerId,
            title: "Deal update",
            body: `Your deal is now ${status}.`,
            data: { kind: "deal", id },
          },
          {
            recipient: staff._id,
            title: "Deal update",
            body: `The deal is now ${status}.`,
            data: { kind: "deal", id },
          },
        ],
        { session, ordered: true },
      );
      if (status === "completed") {
        const others = await Deal.find({
          propertyId: property._id,
          _id: { $ne: deal._id },
          status: { $in: ["offered", "countered", "accepted", "token_paid"] },
        })
          .session(session)
          .select("buyerId");
        if (others.length)
          await Notification.create(
            others.map((other) => ({
              recipient: other.buyerId,
              title: "Property unavailable",
              body: "The property has been sold and your offer is closed.",
              data: { kind: "deal", id: String(other._id) },
            })),
            { session, ordered: true },
          );
        await Deal.updateMany(
          {
            propertyId: property._id,
            _id: { $ne: deal._id },
            status: { $in: ["offered", "countered", "accepted", "token_paid"] },
          },
          {
            $set: { status: "cancelled" },
            $push: {
              history: {
                actorId: actor.id,
                status: "cancelled",
                reason: "Property sold",
                at: new Date(),
              },
            },
          },
          { session },
        );
        await Inquiry.updateMany(
          { propertyId: property._id, dealId: { $ne: deal._id } },
          { $set: { status: "rejected" } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
    invalidatePublicResponses();
    await markRegionCountsDirty();
  }
  return result;
}
