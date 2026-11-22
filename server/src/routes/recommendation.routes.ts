import { SearchPreference } from "../models/SearchPreference.model";
import { authGuard } from "../middleware/auth.middleware";
import { Router } from "express";
import { createHash } from "crypto";
import { isValidObjectId } from "mongoose";
import { authenticateRequest } from "../middleware/auth.middleware";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { Engagement } from "../models/Engagement.model";
import { publishedFilter } from "../services/marketplace";
import { getRecommendationsResponse } from "../services/recommendationService";
import { sendPublicResponse } from "../services/publicResponseCache";
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
    const response = await getRecommendationsResponse(
      req.query as any,
      req.headers.authorization
    );
    sendPublicResponse(req, res, response);
  } catch (error: any) {
    const status = error.status || (error.code === 400 ? 400 : 503);
    if (status === 503) res.setHeader("Retry-After", "1");
    res.status(status).json({
      message: error.message || "Recommendations unavailable. Please retry",
    });
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
