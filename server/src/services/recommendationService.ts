import { createHash } from "crypto";
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
  recentDistricts?: string;
  recentTypes?: string;
  refresh?: string | number;
  seed?: string | number;
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

  const recentDistrictsList =
    typeof query.recentDistricts === "string"
      ? query.recentDistricts.split(",").map((d) => d.trim()).filter(Boolean)
      : [];
  const recentTypesList =
    typeof query.recentTypes === "string"
      ? query.recentTypes.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];
  const refreshSeed = String(query.refresh || query.seed || "");

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
    recentDistricts: recentDistrictsList.join(","),
    recentTypes: recentTypesList.join(","),
    refresh: mode === "personalized" ? (refreshSeed || `${Date.now()}_${Math.random()}`) : "",
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

      // Also incorporate recently viewed properties
      try {
        const actor = createHash("sha256").update(authUser.id).digest("hex");
        const recentViews = await Engagement.find({ actor })
          .sort({ createdAt: -1 })
          .limit(20)
          .select("propertyId")
          .lean();
        if (recentViews.length > 0) {
          const viewedIds = recentViews.map((e) => e.propertyId);
          const viewedProps = await Property.find({ _id: { $in: viewedIds } })
            .select("type location.district price")
            .lean();
          seeds.push(...viewedProps);
        }
      } catch {}
    }

    // Combine all user interest signals
    const rawDistricts = [
      ...new Set([
        ...seeds.map((p) => p.location?.district).filter(Boolean),
        ...searches.map((p) => p.district || "").filter(Boolean),
        ...(district ? [district] : []),
        ...recentDistrictsList,
      ]),
    ];

    // Case-insensitive variants so "patna" and "Patna" both match
    const districts = [
      ...new Set(
        rawDistricts.flatMap((d) => [
          d,
          d.toLowerCase(),
          d.charAt(0).toUpperCase() + d.slice(1).toLowerCase(),
        ])
      ),
    ];

    const types = [
      ...new Set([
        ...seeds.map((p) => p.type).filter(Boolean),
        ...searches.map((p) => p.type).filter(Boolean),
        ...(type ? [type] : []),
        ...recentTypesList,
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

    const primaryDistrictVariants = district
      ? [
          district,
          district.toLowerCase(),
          district.charAt(0).toUpperCase() + district.slice(1).toLowerCase(),
        ]
      : [];

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
                    // District match (+8 pts)
                    {
                      $cond: [{ $in: ["$location.district", districts] }, 8, 0],
                    },
                    // Direct primary district bonus (+4 pts)
                    {
                      $cond: [
                        { $in: ["$location.district", primaryDistrictVariants] },
                        4,
                        0,
                      ],
                    },
                    // Type match (+6 pts)
                    { $cond: [{ $in: ["$type", types] }, 6, 0] },
                    // Direct primary type bonus (+3 pts)
                    { $cond: [{ $eq: ["$type", type] }, 3, 0] },
                    // Budget match (+3 pts)
                    {
                      $cond: [
                        {
                          $and: [
                            { $gt: [budget, 0] },
                            { $lte: ["$price", budget * 1.5] },
                            { $gte: ["$price", budget * 0.3] },
                          ],
                        },
                        3,
                        0,
                      ],
                    },
                    // Freshness / recently updated (+2 pts for properties published/updated in the last 30 days)
                    {
                      $cond: [
                        {
                          $gte: [
                            { $ifNull: ["$firstPublishedAt", "$createdAt"] },
                            new Date(Date.now() - 30 * 86400000),
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
      { $limit: mode === "personalized" ? 80 : 30 },
      {
        $project: Object.fromEntries(
          publicFields.split(" ").map((f) => [f, 1])
        ),
      },
    ];

    const results = await Property.aggregate(pipeline).option({
      maxTimeMS: 5000,
    });

    // Helper: Deduplicate listings by normalized title + district + price
    const deduplicate = (list: any[]) => {
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const p of list) {
        if (!p?._id) continue;
        const key = `${(p.title || "").trim().toLowerCase()}|${(p.location?.district || "").trim().toLowerCase()}|${p.price || 0}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(p);
        }
      }
      return deduped;
    };

    if (mode !== "personalized") {
      return { data: deduplicate(results).slice(0, 24) };
    }

    // Personalized Mode:
    // 1. Deduplicate so duplicate cards (like identical "rps" listings) never appear side by side
    const uniqueCandidates = deduplicate(results);

    // 2. Dynamic Rotation ("at every refresh it get changes"):
    // Inject dynamic jitter (0 to 3.8 pts) to rotate and shuffle properties within relevance tiers
    // so properties matching user interest always lead, but the exact lineup rotates on every refresh!
    const rotated = uniqueCandidates.map((p) => {
      const baseScore = Number(p.score || 0);
      const jitter = Math.random() * 3.8;
      return {
        ...p,
        _rankScore: baseScore + jitter,
      };
    });

    rotated.sort((a, b) => b._rankScore - a._rankScore);

    const finalData = rotated.slice(0, 24).map(({ _rankScore, ...rest }) => rest);

    return { data: finalData };
  });
}

