import express from "express";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";
import { isValidObjectId } from "mongoose";
import { publicUser } from "../services/security";
import { publicFields } from "../services/propertyWorkflow";
import { publicPropertyFilter } from "../services/marketplace";

const router = express.Router();

// Get User Profile
router.get("/profile", authGuard, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id).select("-passwordHash -refreshTokenHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(publicUser(user));
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
    const properties = await Property.find({ ownerId: req.user?.id }).sort({ createdAt: -1 });
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
    const properties = await Property.find({ ...await publicPropertyFilter(), _id: { $in: user.wishlist } }).select(publicFields);
    const order = user.wishlist.map(String).reverse();
    properties.sort((a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)));
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle Wishlist Item
router.post("/wishlist/:propertyId", authGuard, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const propId = req.params.propertyId;
    if (!isValidObjectId(propId)) return res.status(400).json({ error: "Invalid property ID" });
    const isWishlisted = user.wishlist.some(id => id.toString() === propId.toString());

    if (isWishlisted) {
      await User.updateOne({ _id: user._id }, { $pull: { wishlist: propId } });
    } else {
      if (!await Property.exists({ ...await publicPropertyFilter(), _id: propId })) return res.status(404).json({ error: "Published property not found" });
      await User.updateOne({ _id: user._id }, { $addToSet: { wishlist: propId } });
    }
    res.json({ success: true, isWishlisted: !isWishlisted });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
