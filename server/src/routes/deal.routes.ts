import { readPage } from "../services/pagination";
import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Deal } from "../models/Deal.model";
import { Property } from "../models/Property.model";
import { publicFields } from "../services/propertyWorkflow";
import { OfferError, assignedStaff } from "../services/marketplace";
import { createOffer, changeDeal } from "../services/dealWorkflow";
import { authGuard, roleGuard } from "../middleware/auth.middleware";
const router = Router();
router.use(authGuard);
router.param("id", (_req, res, next, id) =>
  isValidObjectId(id)
    ? next()
    : res.status(400).json({ message: "Invalid deal ID" }),
);
const failure = (res: any, error: any) =>
  res
    .status(error instanceof OfferError ? error.status : 500)
    .json({
      message:
        error instanceof OfferError
          ? error.message
          : "Could not update the deal. Please retry",
    });
router.get("/", async (req: any, res) => {
  try {
    const assigned = await Property.find({
      $or: [
        { assignedAdvisorId: req.user.id },
        { assignedVerifierId: req.user.id },
      ],
    }).distinct("_id");
    const filter =
      req.user.role === "admin"
        ? {}
        : {
            $or: [{ buyerId: req.user.id }, { propertyId: { $in: assigned } }],
          };
    res.json(
      await readPage(Deal.find(filter)
        .select("-ownerId")
        .sort({ createdAt: -1 })
        .populate({ path: "propertyId", select: publicFields }), req, res),
    );
  } catch (e) {
    failure(res, e);
  }
});
router.post("/:propertyId/offer", roleGuard("user"), async (req: any, res) => {
  try {
    const deal = await createOffer(
      req.user.id,
      req.params.propertyId,
      req.body.amount,
      undefined, req.body.requestKey,
    );
    const dto = deal.toObject();
    delete dto.ownerId;
    res.status(201).json(dto);
  } catch (e) {
    failure(res, e);
  }
});
router.get("/:id", async (req: any, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    const property = await Property.findById(deal.propertyId);
    if (!property)
      return res.status(404).json({ message: "Property not found" });
    const staff = await assignedStaff(property);
    if (
      ![String(deal.buyerId), String(staff._id)].includes(req.user.id) &&
      req.user.role !== "admin"
    )
      return res.status(403).json({ message: "Unauthorized" });
    await deal.populate([
      { path: "propertyId", select: publicFields },
      { path: "buyerId", select: "name" },
    ]);
    const dto: any = deal.toObject();
    if (req.user.role !== "admin") delete dto.ownerId;
    dto.staffId = { _id: staff._id, name: staff.name, role: staff.role };
    res.json(dto);
  } catch (e) {
    failure(res, e);
  }
});
router.patch("/:id/status", async (req: any, res) => {
  try {
    const deal = await changeDeal(req.params.id, req.user, req.body);
    const dto = deal.toObject();
    if (req.user.role !== "admin") delete dto.ownerId;
    res.json(dto);
  } catch (e) {
    failure(res, e);
  }
});
export default router;
