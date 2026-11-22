import { User } from "../models/User.model";
import { createHash } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { messaging } from "./messaging.routes";
import express from "express";
import { Inquiry } from "../models/Inquiry.model";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";
import {
  OfferError,
  offerProperty,
  assignedStaff,
} from "../services/marketplace";
import mongoose, { isValidObjectId, Types, PipelineStage } from "mongoose";
import { pageInput, cursorFor } from "../services/pagination";
import { replicaReadPreference } from "../services/readReplica";
import { sendPush } from "../services/pushNotifications";

import { Property } from "../models/Property.model";
import { createOffer, changeDeal } from "../services/dealWorkflow";
const router = express.Router();
router.use(authGuard);
const chatReadLimit = rateLimit({
  windowMs: 60_000, limit: 180,
  keyGenerator: (req: AuthRequest) => req.user!.id,
  skip: req => req.method !== "GET" && !(req.method === "POST" && req.path.endsWith("/read")),
  standardHeaders: "draft-8", legacyHeaders: false,
  handler(req: AuthRequest, res) {
    console.warn(JSON.stringify({event:"chat_rate_limit",requestId:res.locals.requestId,
      key:createHash("sha256").update(req.user!.id).digest("hex").slice(0,16)}));
    res.status(429).json({message:"Chat refresh limit reached"});
  },
});
router.use(chatReadLimit);
// Old owner conversations remain archived; never reinterpret their participants.
router.use("/:id", async (req: any, res, next) => {
  try {
    if (["sent", "received"].includes(req.params.id)) return next();
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ error: "Invalid inquiry ID" });
    // Message sends authorize against the same snapshot that they update.
    if (req.method === "POST" && /^\/message\/?$/i.test(req.path)) return next();
    const inquiry = await Inquiry.findOne({
      _id: req.params.id,
      staffId: { $exists: true },
    }).select("buyerId staffId propertyId").lean();
    if (!inquiry)
      return res.status(404).json({ error: "Conversation not found" });
    const property = await Property.findById(inquiry.propertyId)
      .select("status assignedAdvisorId assignedVerifierId").lean();
    if (!property) return res.status(404).json({ error: "Property not found" });
    const staff = await assignedStaff(property);
    if (![String(inquiry.buyerId), String(staff._id)].includes(req.user.id))
      return res.status(403).json({ error: "Not a conversation participant" });
    if (
      req.method !== "GET" &&
      req.path !== "/read" &&
      property.status === "sold"
    )
      return res
        .status(409)
        .json({
          error: "This property has been sold. Conversation is read-only",
        });
    if (String(inquiry.staffId) !== String(staff._id))
      await Inquiry.updateOne(
        { _id: inquiry._id },
        { $set: { staffId: staff._id }, $unset: { staffReadAt: 1 } },
      );
    res.locals.inquiryBuyer = String(inquiry.buyerId) === req.user.id;
    next();
  } catch (e: any) {
    res
      .status(e instanceof OfferError ? e.status : 500)
      .json({ error: e.message });
  }
});
router.param("id", (_req, res, next, id) =>
  ["sent", "received"].includes(id) || isValidObjectId(id)
    ? next()
    : res.status(400).json({ error: "Invalid inquiry ID" }),
);

// Submit an offer or contact the assigned staff member
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { propertyId, message, offerAmount } = req.body;

    const property = await offerProperty(req.user!.id, propertyId, offerAmount);
    if (typeof message !== "string" || !message.trim() || message.length > 5000)
      return res
        .status(400)
        .json({ error: "Enter a message between 1 and 5000 characters" });

    const staff = await assignedStaff(property);
    if (offerAmount !== undefined) {
      const deal = await createOffer(
        req.user!.id,
        propertyId,
        offerAmount,
        message.trim(),
        req.body.requestKey,
      );
      const inquiry = await Inquiry.findOne({ dealId: deal._id });
      if (!inquiry)
        return res
          .status(409)
          .json({ error: "This request key belongs to a standalone offer" });
      return res.status(201).json(inquiry);
    }
    const inquiry = await Inquiry.create({
      propertyId,
      buyerId: req.user?.id,
      staffId: staff._id,
      message: message.trim(),
      offerAmount,
      buyerReadAt: new Date(),
    });

    const current = await Property.findById(property._id);
    if (
      !current ||
      current.status !== "verified" ||
      String((await assignedStaff(current))._id) !== String(staff._id)
    ) {
      await Inquiry.deleteOne({ _id: inquiry._id });
      return res
        .status(409)
        .json({ error: "Property changed; refresh and retry" });
    }
    res.status(201).json(inquiry);
    sendPush(
      String(staff._id),
      "New property inquiry",
      "Someone sent an inquiry about your property.",
      { kind: "inquiry", id: inquiry._id.toString() },
    );
  } catch (err) {
    res
      .status(err instanceof OfferError ? err.status : 500)
      .json({
        error: err instanceof OfferError ? err.message : "Server error",
      });
  }
});

// Lists include one preview message; full history is fetched only for an open chat.
for (const [route, party, other] of [
  ["/", "both", "both"],
  ["/sent", "buyerId", "staffId"],
  ["/received", "staffId", "buyerId"],
]) {
  router.get(route, async (req: AuthRequest, res) => {
    try {
      const sortField = req.query.sort === "activity" ? "updatedAt" : "createdAt";
      const sort = { [sortField]: -1, _id: -1 } as const;
      const { limit, filter } = pageInput(req.query, sortField);
      const actor = new Types.ObjectId(req.user!.id);
      const assigned = await Property.find({
        $or: [{ assignedAdvisorId: actor }, { assignedVerifierId: actor }],
      }).distinct("_id");
      const staffMembership = { propertyId: { $in: assigned } };
      const membership = {
        staffId: { $exists: true },
        ...(party === "both"
          ? { $or: [{ buyerId: actor }, staffMembership] }
          : party === "staffId"
            ? staffMembership
            : { buyerId: actor }),
      };
      // The first six conversations are always read from the primary. The
      // boundary comes from the primary too, so a secondary never serves them.
      const splitReads = replicaReadPreference() === "secondary";
      const newest = splitReads ? await Inquiry.find(membership)
        .select(`_id ${sortField}`)
        .sort(sort)
        .limit(6)
        .lean() : [];
      const primaryIds = newest.map((row) => row._id);
      const pipeline = (match: object, count: number): PipelineStage[] => [
        { $match: match },
        { $sort: sort },
        { $limit: count },
        {
          $addFields: {
            unreadCount: {
              $let: {
                vars: {
                  readAt: {
                    $ifNull: [
                      { $cond: [{ $eq: ["$buyerId", actor] }, "$buyerReadAt", "$staffReadAt"] },
                      new Date(0),
                    ]
                  }
                },
                in: {
                  $add: [
                    { $cond: [{ $and: [{ $eq: ["$staffId", actor] }, { $gt: ["$createdAt", "$$readAt"] }] }, 1, 0] },
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ["$messages", []] },
                          as: "message",
                          cond: {
                            $and: [
                              { $ne: ["$$message.senderId", actor] },
                              { $gt: ["$$message.createdAt", "$$readAt"] },
                            ]
                          },
                        }
                      }
                    },
                  ]
                },
              },
            },
          },
        },
        { $set: { unread: { $gt: ["$unreadCount", 0] }, messages: { $slice: [{ $ifNull: ["$messages", []] }, -1] } } },
      ];
      const primaryRows = await Inquiry.aggregate(
        pipeline(
          { $and: [membership, filter, ...(splitReads ? [{ _id: { $in: primaryIds } }] : [])] },
          limit + 1,
        ),
      ).option({ maxTimeMS: 5000 });
      let rows = primaryRows;
      if (newest.length === 6 && rows.length <= limit) {
        const boundary = newest[5];
        const older = {
          $or: [
            { [sortField]: { $lt: boundary[sortField] } },
            { [sortField]: boundary[sortField], _id: { $lt: boundary._id } },
          ],
        };
        const replicaRows = await Inquiry.aggregate(
          pipeline(
            { $and: [membership, filter, older] },
            limit + 1 - rows.length,
          ),
        )
          .read(replicaReadPreference())
          .option({ maxTimeMS: 5000 });
        rows = [...rows, ...replicaRows];
      }
      res.setHeader(
        "X-Next-Cursor",
        rows.length > limit ? cursorFor(rows[limit - 1], sortField) : "",
      );
      const items = rows.slice(0, limit);
      const populate = (
        subset: any[],
        readPreference: "primary" | "secondary",
      ) =>
        Inquiry.populate(subset, [
          {
            path: "propertyId",
            select: "title price status location",
            options: { readPreference },
          },
          { path: "buyerId", select: "name", options: { readPreference } },
          { path: "staffId", select: "name role", options: { readPreference } },
        ]);
      await populate(
        items.slice(0, Math.min(primaryRows.length, limit)),
        "primary",
      );
      await populate(items.slice(primaryRows.length), replicaReadPreference());
      res.json(items);
    } catch {
      res.status(500).json({ error: "Could not load conversations" });
    }
  });
}

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    console.log(`[SERVER INQUIRY] GET /inquiries/${req.params.id} | User: ${req.user!.id}`);
    const inquiry = await Inquiry.findOne({
      _id: req.params.id,
      $or: [{ buyerId: req.user!.id }, { staffId: req.user!.id }],
    })
      .select({ messages: { $slice: -1 } })
      .populate([
        { path: "propertyId", select: "title price status location" },
        { path: "buyerId", select: "name" },
        { path: "staffId", select: "name" },
      ])
      .lean();
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    res.json(inquiry);
  } catch {
    res.status(500).json({ error: "Could not load inquiry" });
  }
});

// Reply/update inquiry status (Seller view)
router.put("/:id/status", async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "accepted", "rejected", "countered"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const existing = await Inquiry.findOne({
      _id: req.params.id,
      staffId: req.user?.id,
    });
    if (!existing)
      return res.status(403).json({ error: "Only assigned staff can respond" });
    if (existing.dealId)
      await changeDeal(String(existing.dealId), req.user!, {
        status,
        counterAmount: req.body.counterAmount,
      });
    else if (status !== "pending")
      return res
        .status(400)
        .json({
          error: "Submit a structured offer before changing negotiation status",
        });
    const inquiry = await Inquiry.findOneAndUpdate(
      { _id: req.params.id, staffId: req.user?.id },
      { $set: { status } },
      { new: true },
    )
      .select({ messages: { $slice: -1 } })
      .lean();

    if (!inquiry)
      return res
        .status(404)
        .json({ error: "Inquiry not found or unauthorized" });
    res.json(inquiry);
    sendPush(
      inquiry.buyerId.toString(),
      "Inquiry update",
      `Your inquiry was ${status}.`,
      { kind: "inquiry", id: inquiry._id.toString() },
    );
  } catch (err) {
    res
      .status(err instanceof OfferError ? err.status : 500)
      .json({
        error: err instanceof OfferError ? err.message : "Server error",
      });
  }
});

router.use(messaging);

export default router;
