import { readPage, listFields, pageInput, cursorFor } from "../services/pagination";
import express from "express";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";
import { isValidObjectId, Types } from "mongoose";
import { publicUser } from "../services/security";
import { publicFields } from "../services/propertyWorkflow";
import { publicPropertyFilter } from "../services/marketplace";

const router = express.Router();

// Get User Profile
router.get("/profile", authGuard, async (req: AuthRequest, res) => {
  try {
    res.json(req.account);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update User Profile
router.put("/profile", authGuard, async (req: AuthRequest, res) => {
  try {
    const { name, email } = req.body;
    const changes: { name?: string; email?: string } = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 200) return res.status(400).json({ message: "Enter a name between 2 and 200 characters" });
      changes.name = name.trim();
    }
    if (email !== undefined) {
      if (typeof email !== "string" || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) return res.status(400).json({ message: "Enter a valid email address or leave it empty" });
      changes.email = email.trim().toLowerCase();
    }
    if (!Object.keys(changes).length) return res.status(400).json({ message: "Provide a name or email to update" });
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { $set: changes },
      { new: true, runValidators: true }
    ).select("-passwordHash -refreshTokenHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get User's Listed Properties
router.get("/my-properties", authGuard, async (req: AuthRequest, res) => {
  try {
    const properties = await readPage(Property.find({ ownerId: req.user?.id }).select(listFields), req, res);
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get Wishlist
router.get("/wishlist", authGuard, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id).select("wishlist");
    if (!user) return res.status(404).json({ error: "User not found" });
    const { limit } = pageInput(req.query);
    const order = user.wishlist.map(String).reverse();
    const anchor = req.query.cursor ? JSON.parse(Buffer.from(String(req.query.cursor), "base64url").toString())[1] : undefined;
    const index = anchor ? order.indexOf(anchor) : -1;
    if (anchor && index < 0) return res.status(400).json({ error: "Saved list changed. Refresh to continue." });
    const ids = order.slice(index + 1, index + 1 + limit);
    const found = await Property.find({ ...await publicPropertyFilter(), _id: { $in: ids } }).select(publicFields).lean().maxTimeMS(5000);
    const byId = new Map(found.map(row => [String(row._id), row]));
    const properties = ids.map(id => byId.get(id)).filter(Boolean);
    res.setHeader("X-Next-Cursor", index + 1 + limit < order.length ? cursorFor({ _id: ids.at(-1), createdAt: new Date(0) }) : "");
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle Wishlist Item
router.get("/wishlist/:propertyId", authGuard, async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.propertyId)) return res.status(400).json({ error: "Invalid property ID" });
  try { res.json({ isWishlisted: !!await User.exists({ _id: req.user!.id, wishlist: req.params.propertyId }) }); }
  catch { res.status(503).json({ error: "Could not check saved property" }); }
});
router.post("/wishlist/:propertyId", authGuard, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const propId = req.params.propertyId;
    if (!isValidObjectId(propId)) return res.status(400).json({ error: "Invalid property ID" });
    const isWishlisted = user.wishlist.some(id => id.toString() === propId.toString());

    if (!isWishlisted && !await Property.exists({ ...await publicPropertyFilter(), _id: propId })) return res.status(404).json({ error: "Published property not found" });
    const objectId = new Types.ObjectId(propId);
    const updated = await User.findOneAndUpdate({ _id: user._id, $or: [{ wishlist: objectId }, { $expr: { $lt: [{ $size: "$wishlist" }, 1000] } }] }, [
      { $set: { wishlist: { $cond: [{ $in: [objectId, "$wishlist"] }, { $filter: { input: "$wishlist", as: "id", cond: { $ne: ["$$id", objectId] } } }, { $concatArrays: ["$wishlist", [objectId]] }] } } },
    ], { new: true }).select("wishlist").lean();
    if (!updated) return res.status(409).json({ error: "Your saved list is full. Remove a property before adding another." });
    res.json({ success: true, isWishlisted: updated.wishlist.some(id => String(id) === String(objectId)) });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
