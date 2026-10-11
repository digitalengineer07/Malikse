import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { authGuard } from "../middleware/auth.middleware";
import { User } from "../models/User.model";

import { REFRESH_SECRET, accountEnabled, generateTokens, publicUser, tokenDigest } from "../services/security";

const router = Router();
const mobilePattern = /^[0-9]{10}$/;

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, mobile, email, password } = req.body;
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanMobile = typeof mobile === "string" ? mobile.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (cleanName.length < 2 || !mobilePattern.test(cleanMobile)) {
      return res.status(400).json({ message: "Enter your name and a 10-digit mobile number" });
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password is required (min 6 characters)" });
    }
    let user = await User.findOne({ mobile: cleanMobile });
    if (user) {
      return res.status(409).json({ message: "Mobile number already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    user = new User({ role: "user", name: cleanName, mobile: cleanMobile, email: cleanEmail || undefined, passwordHash });
    await user.save();
    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshTokenHash = tokenDigest(refreshToken);
    await user.save();
    res.status(201).json({ accessToken, refreshToken, user: publicUser(user) });
  } catch (error: any) {
    if (error.code === 11000) return res.status(409).json({ message: "Mobile number already registered" });
    res.status(500).json({ message: error.message });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (typeof mobile !== "string" || !mobilePattern.test(mobile.trim()) || typeof password !== "string") {
      return res.status(400).json({ message: "Enter a 10-digit mobile number and password" });
    }
    const user = await User.findOne({ mobile: mobile.trim() });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid mobile number or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid mobile number or password" });
    }

    if (!accountEnabled(user)) return res.status(403).json({ message: "This account is suspended or inactive" });

    // Existing buyer/owner accounts now share the User role.
    if (["buyer", "owner"].includes(user.role as string)) user.role = "user";

    const { accessToken, refreshToken } = generateTokens(user);

    user.refreshTokenHash = tokenDigest(refreshToken);
    await user.save();

    res.json({
      accessToken,
      refreshToken,
      user: publicUser(user)
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /auth/kyc/demo — a UI prototype toggle, not identity verification.
router.post("/kyc/demo", authGuard, async (req: any, res) => {
  if (req.user.role !== "user") return res.status(403).json({ message: "User role required" });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.demoKycComplete = true;
  await user.save();
  res.json({ demoKycComplete: true, demoOnly: true });
});

// POST /auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (typeof refreshToken !== "string" || !refreshToken) {
      return res.status(401).json({ message: "Refresh token is required" });
    }

    // Verify token signature
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { id: string; role: string };
    const user = await User.findById(decoded.id);

    if (!user || !accountEnabled(user)) return res.status(401).json({ message: "Invalid refresh token" });
    const tokens = generateTokens(user);
    // Compare and replace in one write: only one concurrent refresh may win.
    const rotated = await User.updateOne({ _id: user._id, refreshTokenHash: tokenDigest(refreshToken), isSuspended: { $ne: true }, isActive: { $ne: false } }, { $set: { refreshTokenHash: tokenDigest(tokens.refreshToken) } });
    if (!rotated.modifiedCount) return res.status(401).json({ message: "Refresh token mismatch or expired. Please sign in again" });
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: publicUser(user) });
  } catch (error: any) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// POST /auth/logout
router.post("/logout", authGuard, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshTokenHash = undefined;
      await user.save();
    }
    res.json({ message: "Logged out successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /auth/me
router.get("/me", authGuard, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash -refreshTokenHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(publicUser(user));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
