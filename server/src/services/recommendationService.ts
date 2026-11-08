import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { Engagement } from "../models/Engagement.model";
import { SearchPreference } from "../models/SearchPreference.model";
import { publishedFilter, enabledOwnerStages } from "./marketplace";
import { publicFields } from "./propertyWorkflow";
import { authenticateRequest } from "../middleware/auth.middleware";
import { publicResponse, PublicResponse } from "./publicResponseCache";

export interface RecommendationQuery {
  mode?: string;
  district?: string;
  type?: string;
  maxPrice?: string | number;
}

export async function getRecommendationsResponse(
  query: RecommendationQuery,
  authHeader?: string
): Promise<PublicResponse> {
  const mode = String(query.mode || "new");
  if (!["new", "trending", "personalized"].includes(mode)) {
    const error: any = new Error("Invalid recommendation mode");
    error.status = 400;
    throw error;
  }

  // mode=new and mode=trending are universal for all viewers.
  // mode=personalized uses user history if logged in, or filter params if guest.
  let authUser: { id: string } | null = null;
  if (mode === "personalized" && authHeader?.startsWith("Bearer ")) {
    const auth = await authenticateRequest(authHeader);
    if (auth.user) {
      authUser = auth.user;
    }
  }

  const district =
    typeof query.district === "string" ? query.district.slice(0, 100) : "";
  const type =
    typeof query.type === "string" &&
    ["land", "flat", "house", "shop", "office"].includes(query.type)
      ? query.type
      : "";
  const requestedBudget = Number(query.maxPrice || 0);

  const cacheKey = {
    db: Property.db.name,
    kind: "recommendations",
    mode,
    userId: authUser ? authUser.id : "public",
    district,
    type,
    maxPrice:
      Number.isFinite(requestedBudget) && requestedBudget > 0
        ? requestedBudget
        : 0,
  };

  return publicResponse(cacheKey, async () => {
    let seeds: any[] = [];
    let searches: any[] = [];

    if (authUser) {
      const userDoc = await User.findById(authUser.id)
        .select("wishlist")
        .lean();
      if (userDoc?.wishlist?.length) {
        seeds = await Property.find({
          _id: { $in: userDoc.wishlist.slice(-50) },
        })
          .select("type location.district price")
          .lean();
      }
      const searchDoc = await SearchPreference.findOne({
        userId: authUser.id,
      }).lean();
      searches = searchDoc?.searches || [];
    }

    const districts = [
      ...new Set([
        ...seeds.map((p) => p.location?.district).filter(Boolean),
        ...searches.map((p) => p.district || "").filter(Boolean),
        ...(district ? [district] : []),
      ]),
    ];

    const types = [
      ...new Set([
        ...seeds.map((p) => p.type).filter(Boolean),
        ...searches.map((p) => p.type).filter(Boolean),
        ...(type ? [type] : []),
      ]),
    ];

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
      {
        $sort:
          mode === "new"
            ? { publishedAt: -1, _id: -1 }
            : { score: -1, publishedAt: -1, _id: -1 },
      },
      { $limit: 20 },
      {
        $project: Object.fromEntries(
          publicFields.split(" ").map((f) => [f, 1])
        ),
      },
    ];

    const results = await Property.aggregate(pipeline).option({
      maxTimeMS: 5000,
    });
    return { data: results };
  });
}

