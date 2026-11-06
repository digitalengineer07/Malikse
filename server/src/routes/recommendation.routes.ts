import { SearchPreference } from "../models/SearchPreference.model";
import { authGuard } from "../middleware/auth.middleware";
import { Router } from "express";
import { createHash } from "crypto";
import { isValidObjectId } from "mongoose";
import { authenticateRequest } from "../middleware/auth.middleware";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { Engagement } from "../models/Engagement.model";
import { publishedFilter, enabledOwnerStages } from "../services/marketplace";
import { publicFields } from "../services/propertyWorkflow";
const router = Router();
router.post("/preferences", authGuard, async (req: any, res) => {
  const { district, type, maxPrice } = req.body;
  if (
    typeof district !== "string" ||
    district.length > 100 ||
    typeof type !== "string" ||
    !["", "land", "house", "flat", "office", "shop"].includes(type) ||
    (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0))
  )
    return res.status(400).json({ message: "Invalid preferences" });
  try {
    await SearchPreference.updateOne(
      { userId: req.user.id },
      {
        $push: {
          searches: {
            $each: [{ district, type, maxPrice, at: new Date() }],
            $slice: -30,
          },
        },
      },
      { upsert: true },
    );
    res.sendStatus(204);
  } catch {
    res.sendStatus(503);
  }
});
router.get("/", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const mode = String(req.query.mode || "new");
    if (!["new", "trending", "personalized"].includes(mode))
      return res.status(400).json({ message: "Invalid recommendation mode" });
    const auth = await authenticateRequest(req.headers.authorization);
    const user =
      auth.user &&
      (await User.findById(auth.user.id).select("wishlist").lean());
    const seeds = user
      ? await Property.find({ _id: { $in: user.wishlist.slice(-50) } })
          .select("type location.district price")
          .lean()
      : [];
    const district =
      typeof req.query.district === "string"
        ? req.query.district.slice(0, 100)
        : "";
    const searches = user
      ? (await SearchPreference.findOne({ userId: user._id }).lean())
          ?.searches || []
      : [];
    const districts = [
      ...new Set([
        ...seeds.map((p) => p.location.district),
        ...searches.map((p) => p.district || ""),
        ...(district ? [district] : []),
      ]),
    ];
    const types = [
      ...new Set([
        ...seeds.map((p) => p.type),
        ...searches.map((p) => p.type).filter(Boolean),
      ]),
    ];
    if (
      typeof req.query.type === "string" &&
      ["land", "flat", "house", "shop", "office"].includes(req.query.type)
    )
      types.push(req.query.type as any);
    const requestedBudget = Number(req.query.maxPrice || 0);
    const lastBudget = [...searches]
      .reverse()
      .find((p) => p.maxPrice)?.maxPrice;
    const budget =
      requestedBudget > 0 && Number.isFinite(requestedBudget)
        ? requestedBudget
        : lastBudget ||
          (seeds.length
            ? seeds.reduce((sum, p) => sum + p.price, 0) / seeds.length
            : 0);
    const trending =
      mode === "trending"
        ? await Engagement.aggregate([
            {
              $match: {
                createdAt: { $gte: new Date(Date.now() - 7 * 86400000) },
              },
            },
            {
              $group: {
                _id: "$propertyId",
                score: {
                  $sum: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$kind", "save"] }, then: 5 },
                        { case: { $eq: ["$kind", "search"] }, then: 2 },
                      ],
                      default: 1,
                    },
                  },
                },
              },
            },
            { $sort: { score: -1 } },
            { $limit: 100 },
          ])
        : [];
    const ids = trending.map((p) => p._id);
    const pipeline: any[] = [
      { $match: { ...publishedFilter, reservedDealId: null } },
      ...enabledOwnerStages(),
      {
        $addFields: {
          publishedAt: { $ifNull: ["$firstPublishedAt", "$createdAt"] },
          score:
            mode === "personalized"
              ? {
                  $add: [
                    {
                      $cond: [{ $in: ["$location.district", districts] }, 4, 0],
                    },
                    { $cond: [{ $in: ["$type", types] }, 2, 0] },
                    {
                      $cond: [
                        {
                          $and: [
                            { $gt: [budget, 0] },
                            { $lte: ["$price", budget] },
                            { $gte: ["$price", budget * 0.5] },
                          ],
                        },
                        2,
                        0,
                      ],
                    },
                  ],
                }
              : mode === "trending"
                ? {
                    $cond: [
                      { $in: ["$_id", ids] },
                      { $subtract: [101, { $indexOfArray: [ids, "$_id"] }] },
                      0,
                    ],
                  }
                : 0,
        },
      },
      { $sort: { score: -1, publishedAt: -1, _id: -1 } },
      { $limit: 20 },
      {
        $project: Object.fromEntries(
          publicFields.split(" ").map((f) => [f, 1]),
        ),
      },
    ];
    res.json(await Property.aggregate(pipeline).option({ maxTimeMS: 5000 }));
  } catch {
    res
      .status(503)
      .json({ message: "Recommendations unavailable. Please retry" });
  }
});
router.post("/:propertyId/activity", async (req, res) => {
  try {
    const { kind } = req.body;
    if (
      !isValidObjectId(req.params.propertyId) ||
      !["view", "search", "save"].includes(kind)
    )
      return res.status(400).json({ message: "Invalid activity" });
    const auth = await authenticateRequest(req.headers.authorization);
    if (
      kind === "save" &&
      (!auth.user ||
        !(await User.exists({
          _id: auth.user.id,
          wishlist: req.params.propertyId,
        })))
    )
      return res.status(403).json({ message: "Save the property first" });
    if (
      !(await Property.exists({
        _id: req.params.propertyId,
        ...publishedFilter,
      }))
    )
      return res.sendStatus(404);
    const actor = createHash("sha256")
      .update(auth.user?.id || `${req.ip}:${req.get("user-agent") || ""}`)
      .digest("hex");
    const key = {
      propertyId: req.params.propertyId,
      actor,
      kind,
      day: new Date().toISOString().slice(0, 10),
    };
    await Engagement.updateOne(
      key,
      { $setOnInsert: { ...key, createdAt: new Date() } },
      { upsert: true },
    );
    res.sendStatus(204);
  } catch (e: any) {
    if (e.code === 11000) return res.sendStatus(204);
    res.sendStatus(503);
  }
});
export default router;
