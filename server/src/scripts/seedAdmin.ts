import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { User } from "../models/User.model";

dotenv.config();

async function seedAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const mobile = process.env.ADMIN_MOBILE?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/malikse";

  if (!name || name.length < 2 || !mobile || !/^[0-9]{10}$/.test(mobile) || !password || password.length < 6) {
    throw new Error("Set ADMIN_NAME, ADMIN_MOBILE (10 digits), and ADMIN_PASSWORD (at least 6 characters) in server/.env");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }

  await mongoose.connect(mongoUri);
  try {
    const existing = await User.findOne({ mobile });
    if (existing) {
      if (existing.role !== "admin") throw new Error("ADMIN_MOBILE belongs to a non-admin account");
      if (existing.passwordHash) {
        console.log("Admin already exists for ADMIN_MOBILE; no changes made.");
        return;
      }
      if (await User.exists({ role: "admin", passwordHash: { $exists: true, $nin: [null, ""] }, _id: { $ne: existing._id } })) {
        throw new Error("A password-protected Admin already exists. Use its account to manage staff.");
      }
      existing.name = name;
      existing.email = email || undefined;
      existing.passwordHash = await bcrypt.hash(password, 12);
      await existing.save();
      console.log("Existing passwordless Admin account secured. Sign in with ADMIN_MOBILE and ADMIN_PASSWORD.");
      return;
    }
    if (await User.exists({ role: "admin", passwordHash: { $exists: true, $nin: [null, ""] } })) {
      throw new Error("A password-protected Admin already exists. Use its account to manage staff.");
    }
    await User.create({
      role: "admin", name, mobile, email: email || undefined,
      passwordHash: await bcrypt.hash(password, 12),
    });
    console.log("Admin account created. Sign in with ADMIN_MOBILE and ADMIN_PASSWORD.");
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin().catch((error) => {
  console.error("Admin seed failed:", error.message);
  process.exitCode = 1;
});
