import { Router } from "express";
import { randomInt, randomUUID, createHmac, timingSafeEqual } from "crypto";
import { rateLimit } from "express-rate-limit";
import { authGuard } from "../middleware/auth.middleware";
import { User } from "../models/User.model";
import { ContactChange } from "../models/ContactChange.model";
import passwords from "../services/passwords";
import { REFRESH_SECRET, publicUser } from "../services/security";
import { sendEmailOtp } from "../services/mailer";
import { sendSMS, sendTwilioVerification, checkTwilioVerification, hasDedicatedTwilioPhone } from "../services/twilioSms";
const router = Router();
router.use(authGuard, rateLimit({ windowMs: 60000, limit: 10 }));
const digest = (id: string, kind: string, code: string) => createHmac("sha256", REFRESH_SECRET).update(`contact:${id}:${kind}:${code}`).digest("hex");
const code = () => process.env.NODE_ENV === "test" && process.env.OTP_STUB_CODE || randomInt(0, 1000000).toString().padStart(6, "0");
router.post("/", async (req: any, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || password.length > 1024) return res.status(400).json({ message: "Enter the new email and current password" });
    const user = await User.findById(req.user.id);
    if (!user?.passwordHash || !await passwords.compare(password, user.passwordHash)) return res.status(401).json({ message: "Current password is incorrect" });
    const oldChannel = user.email && user.emailVerifiedAt ? "email" : user.mobile && user.mobileVerifiedAt ? "mobile" : null;
    if (!oldChannel) return res.status(409).json({ message: "Contact support to verify your identity. No verified contact is available; email cannot be changed here." });
    const newEmail = email.trim().toLowerCase();
    if (await User.exists({ email: newEmail, _id: { $ne: user._id } })) return res.status(409).json({ message: "Email is unavailable" });
    const challenge = randomUUID(), oldCode = code(), newCode = code();
    const claimed = await ContactChange.findOneAndUpdate({ _id: req.user.id, $or: [{ resendAt: { $lte: new Date() } }, { resendAt: { $exists: false } }] }, { $set: { challenge, email: newEmail, previousEmail: user.email, previousMobile: user.mobile, sessionVersion: user.sessionVersion ?? 0, oldChannel, oldProvider: "local", oldHash: digest(challenge, "old", oldCode), newHash: digest(challenge, "new", newCode), attempts: 0, ready: false, expiresAt: new Date(Date.now() + 120000), resendAt: new Date(Date.now() + 60000) } }, { upsert: true, new: true });
    if (!claimed) return res.status(429).json({ message: "Wait one minute before retrying" });
    if (!(process.env.NODE_ENV === "test" && process.env.OTP_STUB_CODE)) {
      if (oldChannel === "email") await sendEmailOtp(user.email!, oldCode);
      else if (hasDedicatedTwilioPhone()) await sendSMS(user.mobile!, `MalikSe email change code: ${oldCode}. Expires in 2 minutes. If you did not request this, secure your account.`);
      else { await sendTwilioVerification(user.mobile!); await ContactChange.updateOne({ _id: req.user.id, challenge }, { $set: { oldProvider: "twilio-verify" } }); }
      await sendEmailOtp(newEmail, newCode);
    }
    await ContactChange.updateOne({ _id: req.user.id, challenge }, { $set: { ready: true } });
    res.json({ challenge, oldChannel, message: "Enter the codes sent to your existing verified contact and new email. If either code is unavailable, contact support." });
  } catch (e: any) { res.status(e.code === 11000 ? 429 : 503).json({ message: "Codes unavailable or request too recent. Wait a minute, retry, or contact support." }); }
});
router.post("/verify", async (req: any, res) => {
  try {
    const { challenge, oldCode, newCode } = req.body;
    if (typeof challenge !== "string" || !/^\d{6}$/.test(oldCode) || !/^\d{6}$/.test(newCode)) return res.status(400).json({ message: "Enter both six-digit codes" });
    const pending = await ContactChange.findOneAndUpdate({ _id: req.user.id, challenge, ready: true, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
    if (!pending) return res.status(400).json({ message: "Codes expired or attempt limit reached. Request new codes or contact support." });
    const same = (a: string, b: string) => timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
    const oldValid = pending.oldProvider === "twilio-verify" ? await checkTwilioVerification(pending.previousMobile!, oldCode) : same(pending.oldHash!, digest(challenge, "old", oldCode));
    if (!oldValid || !same(pending.newHash!, digest(challenge, "new", newCode))) return res.status(400).json({ message: "Incorrect verification code" });
    const claimed = await ContactChange.findOneAndDelete({ _id: req.user.id, challenge, ready: true, expiresAt: { $gt: new Date() } });
    if (!claimed) return res.status(409).json({ message: "Request already used" });
    const user = await User.findOneAndUpdate({ _id: req.user.id, email: pending.previousEmail ?? { $exists: false }, mobile: pending.previousMobile ?? { $exists: false }, sessionVersion: pending.sessionVersion === 0 ? { $in: [0, null] } : pending.sessionVersion, isActive: { $ne: false }, isSuspended: { $ne: true } }, { $set: { email: pending.email, emailVerifiedAt: new Date() } }, { new: true });
    if (!user) return res.status(409).json({ message: "Account changed. Start again." });
    res.json(publicUser(user));
  } catch { res.status(409).json({ message: "Could not change email. Start again or contact support." }); }
});
export default router;
