import { User } from "../models/User.model";
import { Notification } from "../models/Notification.model";
import { identityApproved } from "../services/security";
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
import { chatNotificationTitle } from "../services/notificationMessage";

import { Property } from "../models/Property.model";
import { createOffer, changeDeal } from "../services/dealWorkflow";
const router = express.Router();
router.use(authGuard);
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
      const newest = await Inquiry.find(membership)
        .select(`_id ${sortField}`)
        .sort(sort)
        .limit(6)
        .lean();
      const primaryIds = newest.map((row) => row._id);
      const pipeline = (match: object, count: number): PipelineStage[] => [
        { $match: match },
        { $sort: sort },
        { $limit: count },
        {
          $addFields: {
            unreadCount: {
              $let: {
                vars: { readAt: { $ifNull: [
                  { $cond: [{ $eq: ["$buyerId", actor] }, "$buyerReadAt", "$staffReadAt"] },
                  new Date(0),
                ] } },
                in: { $add: [
                  { $cond: [{ $and: [{ $eq: ["$staffId", actor] }, { $gt: ["$createdAt", "$$readAt"] }] }, 1, 0] },
                  { $size: { $filter: {
                    input: { $ifNull: ["$messages", []] },
                    as: "message",
                    cond: { $and: [
                      { $ne: ["$$message.senderId", actor] },
                      { $gt: ["$$message.createdAt", "$$readAt"] },
                    ] },
                  } } },
                ] },
              },
            },
          },
        },
        { $set: { unread: { $gt: ["$unreadCount", 0] }, messages: { $slice: [{ $ifNull: ["$messages", []] }, -1] } } },
      ];
      const primaryRows = await Inquiry.aggregate(
        pipeline(
          { $and: [membership, filter, { _id: { $in: primaryIds } }] },
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

router.get("/:id/messages", async (req: AuthRequest, res) => {
  try {
    const before =
      req.query.before === undefined ? undefined : Number(req.query.before);
    if (before !== undefined && (!Number.isInteger(before) || before < 0))
      return res.status(400).json({ error: "Invalid message cursor" });
    const filter = {
      _id: new Types.ObjectId(req.params.id),
      $or: [
        { buyerId: new Types.ObjectId(req.user!.id) },
        { staffId: new Types.ObjectId(req.user!.id) },
      ],
    };
    // Count and latest six come from the primary, so a newly sent message is
    // visible immediately. Older pages are served from a secondary.
    const latest = await Inquiry.aggregate([
      { $match: filter },
      {
        $project: {
          total: { $size: "$messages" },
          messages: { $slice: ["$messages", -6] },
          buyerId: 1,
          buyerReadAt: 1,
          staffReadAt: 1,
        },
      },
    ]).option({ maxTimeMS: 5000 });
    if (!latest.length)
      return res.status(404).json({ error: "Inquiry not found" });
    const total = latest[0].total as number;
    if (before === undefined) {
      const viewingAsBuyer = String(latest[0].buyerId) === req.user!.id;
      return res.json({
        messages: latest[0].messages,
        nextBefore: total > 6 ? total - 6 : null,
        recipientReadAt: (viewingAsBuyer ? latest[0].staffReadAt : latest[0].buyerReadAt) ?? null,
        ownReadAt: (viewingAsBuyer ? latest[0].buyerReadAt : latest[0].staffReadAt) ?? null,
      });
    }
    const end = Math.min(before, Math.max(0, total - 6));
    const start = Math.max(0, end - 50);
    const rows = await Inquiry.aggregate([
      { $match: filter },
      {
        $project: {
          messages: {
            $cond: [
              { $gt: [end, 0] },
              { $slice: ["$messages", start, end - start] },
              [],
            ],
          },
        },
      },
    ])
      .read(replicaReadPreference())
      .option({ maxTimeMS: 5000 });
    if (!rows.length || rows[0].messages.length !== end - start) {
      res.setHeader("Retry-After", "1");
      return res
        .status(503)
        .json({ error: "Messages are still syncing. Please try again." });
    }
    res.json({
      messages: rows[0]?.messages || [],
      nextBefore: start > 0 ? start : null,
    });
  } catch {
    res.status(500).json({ error: "Could not load messages" });
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

// Send a message on an inquiry
router.post("/:id/message", async (req: AuthRequest, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== "string" || !text.trim() || text.length > 5000)
      return res
        .status(400)
        .json({ error: "Enter a message between 1 and 5000 characters" });

    const session = await mongoose.startSession();
    let inquiry: any;
    try {
      await session.withTransaction(async () => {
        const current = await Inquiry.findOne({ _id: req.params.id, staffId: { $exists: true } })
          .select("propertyId buyerId staffId").session(session).lean();
        if (!current) throw new OfferError(404, "Conversation not found");
        const property = await Property.findById(current.propertyId)
          .select("status assignedAdvisorId assignedVerifierId").session(session).lean();
        if (!property || property.status !== "verified")
          throw new OfferError(
            409,
            "Property unavailable. Conversation is read-only",
          );
        const staff = await assignedStaff(property, session);
        const buyer = String(current.buyerId) === req.user!.id;
        if (!buyer && String(staff._id) !== req.user!.id)
          throw new OfferError(403, "Not assigned to this property");
        if (buyer) {
          const account = await User.findById(req.user!.id)
            .select("isVerifiedIdentity demoKycComplete").session(session).lean();
          if (!account || !identityApproved(account))
            throw new OfferError(
              403,
              "Approved KYC is required to send messages",
            );
        }
        const messageId = new Types.ObjectId();
        inquiry = await Inquiry.findOneAndUpdate(
          { _id: current._id, "messages.999": { $exists: false } },
          {
            $set: { staffId: staff._id },
            ...(String(current.staffId) !== String(staff._id) ? { $unset: { staffReadAt: 1 } } : {}),
            $push: {
              messages: {
                _id: messageId,
                senderId: req.user!.id,
                text: text.trim(),
                createdAt: new Date(),
              },
            },
          },
          { new: true, runValidators: true, session },
        )
          .select({ messages: { $slice: -1 } })
          .lean();
        if (!inquiry)
          throw new OfferError(409, "Conversation message limit reached");
        await Notification.create(
          [
            {
              recipient: buyer ? staff._id : current.buyerId,
              title: chatNotificationTitle(req.account?.name),
              body: "You have a new property message.",
              messageId,
              data: { kind: "inquiry", id: String(current._id) },
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    res.json(inquiry);
  } catch (err) {
    res
      .status(err instanceof OfferError ? err.status : 500)
      .json({
        error: err instanceof OfferError ? err.message : "Server error",
      });
  }
});

// A client acknowledges only the activity it has actually displayed.
router.post("/:id/read", async (req: AuthRequest, res) => {
  try {
    const through = new Date(req.body.through);
    if (
      typeof req.body.through !== "string" ||
      !Number.isFinite(through.getTime()) ||
      through.getTime() > Date.now()
    )
      return res.status(400).json({ error: "Invalid read timestamp" });
    const inquiry = await Inquiry.findOne({
      _id: req.params.id,
      $or: [{ buyerId: req.user!.id }, { staffId: req.user!.id }],
    })
      .select("buyerId staffId")
      .lean();
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
    const field =
      inquiry.buyerId.toString() === req.user!.id
        ? "buyerReadAt"
        : "staffReadAt";
    await Inquiry.updateOne(
      { _id: inquiry._id },
      { $max: { [field]: through } },
      { timestamps: false },
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not mark messages as read" });
  }
});

export default router;
