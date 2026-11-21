import { Router } from "express";
import { timingSafeEqual } from "crypto";
import { rateLimit } from "express-rate-limit";
import { User } from "../models/User.model";
import { AccountDeletion } from "../models/AccountDeletion.model";
import { authGuard, type AuthRequest } from "../middleware/auth.middleware";
import passwords from "../services/passwords";
import { deletionReceipt, deletionReferencePattern, deletionSummary, hashDeletionReceipt, privateReceiptPattern, requestAccountDeletion } from "../services/accountDeletion";

const router = Router();
const requestLimit = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Too many attempts. Please wait a minute and retry." }, validate: { xForwardedForHeader: false, default: true } });
const statusLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Please wait before checking again." }, validate: { xForwardedForHeader: false, default: true } });
router.post("/", requestLimit, authGuard, async (req: AuthRequest, res) => {
  const { identifier, password, confirmation } = req.body || {};
  if (typeof identifier !== "string" || identifier.length > 254 || typeof password !== "string" || !password || password.length > 1024 || confirmation !== "DELETE") {
    return res.status(400).json({ message: "Enter your email or mobile number, password, and DELETE to confirm." });
  }
  const input = identifier.trim().toLowerCase();
  const mobile = input.replace(/\D/g, "");
  const filter = input.includes("@") ? { email: input } : /^\d{10}$/.test(mobile) ? { mobile } : null;
  if (!filter) return res.status(400).json({ message: "Enter your registered email or 10-digit mobile number." });
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(401).json({ message: "Please sign in again." });
    if ("email" in filter ? user.email?.toLowerCase() !== filter.email : user.mobile !== filter.mobile) {
      return res.status(403).json({ message: "You can only delete the account you are signed in to." });
    }
    if (!user?.passwordHash || !await passwords.compare(password, user.passwordHash)) return res.status(401).json({ message: "Account details or password are incorrect." });
    if (user.role !== "user") return res.status(403).json({ message: "Staff accounts are managed by your administrator. Request reassignment and account removal through your administrator." });
    const summary = await requestAccountDeletion(user);
    res.setHeader("Cache-Control", "no-store");
    return res.status(202).json(summary);
  } catch { return res.status(503).json({ message: "Could not confirm the request. Retry with the same account details; duplicate requests are safe." }); }
});
router.post("/status", statusLimit, async (req, res) => {
  const input = req.body || {};
  const reference = typeof input.reference === "string" ? input.reference.trim().toUpperCase() : "";
  const receipt = typeof input.receipt === "string" ? input.receipt.trim().toUpperCase() : "";
  const legacy = /^[A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12}$/.test(reference);
  const notFound = () => res.status(404).json({ message: "Deletion receipt not found or expired." });
  if (legacy ? !/^[A-F0-9]{64}$/.test(receipt) : !deletionReferencePattern.test(reference) || !privateReceiptPattern.test(receipt)) return notFound();
  try {
    const job = await AccountDeletion.findById(legacy ? reference.toLowerCase() : reference).lean();
    const canonicalReceipt = legacy ? receipt.toLowerCase() : receipt;
    const expectedHash = legacy ? hashDeletionReceipt(deletionReceipt(reference.toLowerCase())) : job?.receiptHash;
    if (!job || (job.expiresAt && job.expiresAt <= new Date()) || !expectedHash
      || !timingSafeEqual(Buffer.from(hashDeletionReceipt(canonicalReceipt), "hex"), Buffer.from(expectedHash, "hex"))) return notFound();
    res.setHeader("Cache-Control", "no-store");
    return res.json(deletionSummary(job, canonicalReceipt));
  } catch { return res.status(503).json({ message: "Status unavailable. Please retry." }); }
});
export default router;
