import express from "express";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";

const router = express.Router();

// Get User Profile
router.get("/profile", authGuard, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id).select("-passwordHash -refreshTokenHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update User Profile
router.put("/profile", authGuard, async (req: AuthRequest, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { $set: { name, email } },
      { new: true }
    ).select("-passwordHash -refreshTokenHash");
    res.json(user);
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
    const user = await User.findById(req.user?.id).populate("wishlist");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.wishlist);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle Wishlist Item
router.post("/wishlist/:propertyId", authGuard, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const propId = req.params.propertyId as any;
    const isWishlisted = user.wishlist.some(id => id.toString() === propId.toString());

    if (isWishlisted) {
      user.wishlist = user.wishlist.filter((id) => id.toString() !== propId.toString());
    } else {
      user.wishlist.push(propId);
    }
    
    await user.save();
    res.json({ success: true, isWishlisted: !isWishlisted });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
