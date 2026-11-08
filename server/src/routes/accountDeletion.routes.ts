import { Router } from "express";
import { timingSafeEqual } from "crypto";
import { rateLimit } from "express-rate-limit";
import { User } from "../models/User.model";
import { AccountDeletion } from "../models/AccountDeletion.model";
import passwords from "../services/passwords";
import { deletionReceipt, deletionSummary, requestAccountDeletion } from "../services/accountDeletion";

const router = Router();
const requestLimit = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Too many attempts. Please wait a minute and retry." }, validate: { xForwardedForHeader: false, default: true } });
const statusLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Please wait before checking again." }, validate: { xForwardedForHeader: false, default: true } });
// Reauthentication works from a browser even for a suspended account. No userId
// supplied by the caller is used, and no existing session is sufficient alone.
router.post("/", requestLimit, async (req, res) => {
  const { identifier, password, confirmation } = req.body || {};
  if (typeof identifier !== "string" || identifier.length > 254 || typeof password !== "string" || !password || password.length > 1024 || confirmation !== "DELETE") {
    return res.status(400).json({ message: "Enter your email or mobile number, password, and DELETE to confirm." });
  }
  const input = identifier.trim().toLowerCase();
  const mobile = input.replace(/\D/g, "");
  const filter = input.includes("@") ? { email: input } : /^\d{10}$/.test(mobile) ? { mobile } : null;
  if (!filter) return res.status(400).json({ message: "Enter your registered email or 10-digit mobile number." });
  try {
    const user = await User.findOne(filter);
    if (!user?.passwordHash || !await passwords.compare(password, user.passwordHash)) return res.status(401).json({ message: "Account details or password are incorrect." });
    if (user.role !== "user") return res.status(403).json({ message: "Staff accounts are managed by your administrator. Request reassignment and account removal through your administrator." });
    const summary = await requestAccountDeletion(user);
    res.setHeader("Cache-Control", "no-store");
    return res.status(202).json(summary);
  } catch { return res.status(503).json({ message: "Could not confirm the request. Retry with the same account details; duplicate requests are safe." }); }
});
router.post("/status", statusLimit, async (req, res) => {
  const { reference, receipt } = req.body || {};
  if (typeof reference !== "string" || !/^[a-f0-9-]{36}$/i.test(reference) || typeof receipt !== "string" || !/^[a-f0-9]{64}$/i.test(receipt)) return res.status(404).json({ message: "Deletion receipt not found." });
  if (!timingSafeEqual(Buffer.from(receipt, "hex"), Buffer.from(deletionReceipt(reference), "hex"))) return res.status(404).json({ message: "Deletion receipt not found." });
  try {
    const job = await AccountDeletion.findById(reference).lean();
    if (!job) return res.status(404).json({ message: "Deletion receipt not found or expired." });
    res.setHeader("Cache-Control", "no-store");
    return res.json(deletionSummary(job));
  } catch { return res.status(503).json({ message: "Status unavailable. Please retry." }); }
});
export default router;
