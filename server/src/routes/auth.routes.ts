import { randomUUID, randomInt, createHmac, timingSafeEqual } from "crypto";
import { rateLimit } from "express-rate-limit";
import { Registration } from "../models/Registration.model";
import { PasswordReset } from "../models/PasswordReset.model";
import { sendSMS, sendTwilioVerification, checkTwilioVerification } from "../services/twilioSms";
import bcrypt from "../services/passwords";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { authGuard } from "../middleware/auth.middleware";
import { User } from "../models/User.model";

import { REFRESH_SECRET, accountEnabled, generateTokens, publicUser, tokenDigest } from "../services/security";

const router = Router();
const otpDigest = (id: string, code: string) => createHmac("sha256", REFRESH_SECRET).update("registration-otp:" + id + ":" + code).digest("hex");
const resetOtpDigest = (id: string, code: string) => createHmac("sha256", REFRESH_SECRET).update("password-reset-otp:" + id + ":" + code).digest("hex");
const mobilePattern = /^[0-9]{10}$/;

function maskMobile(mobile: string): string {
  if (mobile.length >= 10) {
    return "+91 ******" + mobile.slice(-4);
  }
  return mobile;
}

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return name[0] + "***@" + domain;
  return name.slice(0, 2) + "***@" + domain;
}

const BLOCKED_SUBSTRINGS = ["password", "qwerty", "admin", "welcome", "malikse", "bihar", "patna"];

function isWeakPassword(password: string, context?: { name?: string; mobile?: string }): string | null {
  const clean = password.trim().toLowerCase();
  
  // Check for repeated characters (e.g. 000000, 111111)
  if (/^(.)\1+$/.test(clean)) {
    return "Password is too simple. Please avoid repeated characters.";
  }

  // Check for sequential numbers (e.g. 123456, 654321)
  if ("01234567890123456789".includes(clean) || "98765432109876543210".includes(clean)) {
    return "Password is too simple. Please avoid sequential numbers.";
  }

  // Check for common blocked terms
  if (BLOCKED_SUBSTRINGS.some((term) => clean.includes(term))) {
    return "Password is too common. Please avoid common words like 'password' or 'admin'.";
  }

  const cleanMobile = context?.mobile?.replace(/\D/g, "");
  if (cleanMobile && (clean.includes(cleanMobile) || (cleanMobile.includes(clean) && clean.length >= 6))) {
    return "Password cannot match or contain your mobile number.";
  }

  if (context?.name) {
    const parts = context.name.trim().toLowerCase().split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3 && clean.includes(part)) {
        return "Password cannot contain your personal name.";
      }
    }
  }

  return null;
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, fullName, mobile, email, password } = req.body;
    const rawName = name || fullName;
    const cleanName = typeof rawName === "string" ? rawName.trim() : "";
    const cleanMobile = typeof mobile === "string" ? mobile.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (cleanName.length < 2 || cleanName.length > 200 || !mobilePattern.test(cleanMobile)) {
      return res.status(400).json({ message: "Enter your name and a 10-digit mobile number" });
    }
    if (cleanEmail.length > 254 || (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (typeof password !== "string" || password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ message: "Password must contain at least 6 characters and at most 72 UTF-8 bytes" });
    }
    const weakReason = isWeakPassword(password, { name: cleanName, mobile: cleanMobile });
    if (weakReason) {
      return res.status(400).json({ message: weakReason });
    }
    let user = await User.findOne({ mobile: cleanMobile });
    if (user) {
      return res.status(409).json({ message: "Mobile number already registered" });
    }

    const now = new Date();
    // Insert separately so a concurrent first request cannot bypass the cooldown.
    await Registration.updateOne({ _id: cleanMobile }, { $setOnInsert: { deleteAt: new Date(Date.now() + 86400000) } }, { upsert: true });
    const challengeId = randomUUID();
    const pending = await Registration.findOneAndUpdate({ _id: cleanMobile,
      $and: [{ $or: [{ resendAt: { $lte: now } }, { resendAt: { $exists: false } }] },
        { $or: [{ lockUntil: { $lte: now } }, { lockUntil: { $exists: false } }] }],
    }, { $set: { challengeId, lockUntil: new Date(Date.now() + 30000), resendAt: new Date(Date.now() + 100000), expiresAt: now, attempts: 0 } }, { new: true });
    if (!pending) return res.status(429).json({ message: "Please wait before requesting another OTP", retryAfterSeconds: 100 });
    try {
      if (process.env.TWILIO_SMS_TEST_MODE === "true") {
        await sendSMS(cleanMobile, "sms_2fa");
        await Registration.updateOne({ _id: cleanMobile, challengeId }, {
          $set: { expiresAt: new Date(0), lockUntil: new Date(0), resendAt: new Date(Date.now() + 100000) },
          $unset: { otpHash: 1, passwordHash: 1, name: 1, email: 1 },
        });
        return res.status(202).json({ testOnly: true, resendAfterSeconds: 100,
          message: "Trial test SMS requested. This sample code cannot verify registration. No account was created." });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const stubCode = process.env.OTP_STUB_CODE?.trim();
      const code = stubCode || randomInt(0, 1000000).toString().padStart(6, "0");
      let smsDelivered = false;
      try {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
          if (process.env.TWILIO_PHONE_NUMBER) {
            await sendSMS(cleanMobile, `Your MalikSe verification code is ${code}. It expires in 2 minutes. Do not share this code.`);
          } else {
            // Uses Twilio Verify Service (no Twilio phone number required)
            await sendTwilioVerification(cleanMobile);
          }
          smsDelivered = true;
        }
      } catch (smsErr: any) {
        if (stubCode || !process.env.TWILIO_ACCOUNT_SID || process.env.NODE_ENV !== "production") {
          console.log(`[AUTH] SMS delivery note (${smsErr.message}). Verification OTP for ${cleanMobile} is: ${code}`);
        } else {
          throw smsErr;
        }
      }
      const expiresAt = new Date(Date.now() + 120000);
      const resendAt = new Date(Date.now() + 100000);
      await Registration.updateOne({ _id: cleanMobile, challengeId }, { $set: {
        name: cleanName, email: cleanEmail, passwordHash, otpHash: otpDigest(challengeId, code),
        expiresAt, resendAt, lockUntil: new Date(0), deleteAt: new Date(Date.now() + 86400000),
      } });
      return res.status(202).json({
        challengeId,
        expiresInSeconds: 120,
        resendAfterSeconds: 100,
        stubCode: (!smsDelivered || stubCode) ? code : undefined,
      });
    } catch (error) {
      await Registration.updateOne({ _id: cleanMobile, challengeId }, { $set: { lockUntil: new Date(0), expiresAt: new Date(0) } });
      throw error;
    }
  } catch (error: any) {
    if (error.code === 11000) return res.status(409).json({ message: "Mobile number already registered" });
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// Only a matching, unexpired, single-use SMS code can create an account.
router.post("/register/verify", rateLimit({ windowMs: 60000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }), async (req, res) => {
  const { mobile, challengeId, code } = req.body;
  if (typeof mobile !== "string" || !mobilePattern.test(mobile) || typeof challengeId !== "string" || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Enter the six-digit OTP sent to your mobile" });
  }
  let locked = false;
  try {
    const pending = await Registration.findOneAndUpdate({ _id: mobile, challengeId,
      expiresAt: { $gt: new Date() }, lockUntil: { $lte: new Date() }, attempts: { $lt: 5 },
    }, { $inc: { attempts: 1 }, $set: { lockUntil: new Date(Date.now() + 30000) } }, { new: true });
    if (!pending || !pending.otpHash) return res.status(400).json({ message: "OTP expired, busy, or attempts exhausted. Please resend when available." });
    locked = true;
    let codeValid = false;

    // Check against Twilio Verify API if configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !process.env.TWILIO_PHONE_NUMBER) {
      try {
        codeValid = await checkTwilioVerification(mobile, code);
      } catch {}
    }

    // Fallback to local cryptographic digest verification
    if (!codeValid) {
      const actual = Buffer.from(otpDigest(challengeId, code), "hex");
      const expected = Buffer.from(pending.otpHash, "hex");
      if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
        codeValid = true;
      }
    }

    if (!codeValid) return res.status(400).json({ message: "Incorrect OTP. Please try again." });
    // Recheck expiry and consume atomically before creating the account.
    const consumed = await Registration.findOneAndUpdate({ _id: mobile, challengeId, expiresAt: { $gt: new Date() } }, { $set: { expiresAt: new Date(0) } });
    if (!consumed) return res.status(400).json({ message: "OTP expired. Please resend OTP." });
    const user = new User({ role: "user", name: pending.name, mobile, email: pending.email || undefined, passwordHash: pending.passwordHash, mobileVerifiedAt: new Date() });
    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshTokenHash = tokenDigest(refreshToken);
    await user.save();
    await Registration.deleteOne({ _id: mobile, challengeId });
    return res.status(201).json({ accessToken, refreshToken, user: publicUser(user) });
  } catch (error: any) {
    if (error.code === 11000) return res.status(409).json({ message: "Mobile number already registered. Please sign in." });
    return res.status(error.status || 503).json({ message: error.status ? error.message : "Verification unavailable. Please try again later." });
  } finally {
    if (locked) await Registration.updateOne({ _id: mobile, challengeId }, { $set: { lockUntil: new Date(0) } }).catch(() => {});
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const rawInput = req.body.mobile || req.body.identifier || req.body.email;
    const { password } = req.body;
    if (typeof rawInput !== "string" || !rawInput.trim() || typeof password !== "string" || password.length > 1024) {
      return res.status(400).json({ message: "Enter your mobile number or email and password" });
    }
    const input = rawInput.trim();
    const cleanMobile = input.replace(/\D/g, "");
    const isMobile = /^[0-9]{10}$/.test(cleanMobile);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.toLowerCase());

    if (!isMobile && !isEmail) {
      return res.status(400).json({ message: "Enter a valid 10-digit mobile number or email address" });
    }

    const query = isMobile
      ? { $or: [{ mobile: cleanMobile }, { email: input.toLowerCase() }] }
      : { email: input.toLowerCase() };

    const user = await User.findOne(query);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid mobile number/email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid mobile number/email or password" });
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
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// POST /auth/kyc/demo — a UI prototype toggle, not identity verification.
router.post("/kyc/demo", authGuard, async (req: any, res) => {
  try {
  if (req.user.role !== "user") return res.status(403).json({ message: "User role required" });
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.demoKycComplete = true;
  await user.save();
  res.json({ demoKycComplete: true, demoOnly: true });
  } catch { res.status(503).json({ message: "Account service is temporarily unavailable" }); }
});

// POST /auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (typeof refreshToken !== "string" || !refreshToken) {
      return res.status(401).json({ message: "Refresh token is required" });
    }

    // Verify token signature
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET, { algorithms: ["HS256"] }) as { id: string; role: string };
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
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// GET /auth/me
router.get("/me", authGuard, async (req: any, res) => {
  try {
    res.json(req.account);
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// POST /auth/forgot-password
router.post(
  "/forgot-password",
  rateLimit({ windowMs: 60000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false }),
  async (req, res) => {
    try {
      const rawInput = req.body.identifier || req.body.mobile || req.body.email;
      if (typeof rawInput !== "string" || !rawInput.trim()) {
        return res.status(400).json({ message: "Enter your registered mobile number or email" });
      }

      const input = rawInput.trim();
      const cleanMobile = input.replace(/\D/g, "");
      const isMobile = mobilePattern.test(cleanMobile);
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.toLowerCase());

      if (!isMobile && !isEmail) {
        return res.status(400).json({ message: "Enter a valid 10-digit mobile number or email address" });
      }

      const user = await User.findOne(
        isMobile
          ? { $or: [{ mobile: cleanMobile }, { email: input.toLowerCase() }] }
          : { email: input.toLowerCase() }
      );

      if (!user) {
        return res.status(404).json({ message: "No registered account found with this mobile number or email" });
      }

      if (!accountEnabled(user)) {
        return res.status(403).json({ message: "This account is suspended or inactive. Please contact support." });
      }

      const now = new Date();
      const resetKey = String(user._id);

      await PasswordReset.updateOne(
        { _id: resetKey },
        { $setOnInsert: { deleteAt: new Date(Date.now() + 86400000) } },
        { upsert: true }
      );

      const challengeId = randomUUID();
      const pending = await PasswordReset.findOneAndUpdate(
        {
          _id: resetKey,
          $and: [
            { $or: [{ resendAt: { $lte: now } }, { resendAt: { $exists: false } }] },
            { $or: [{ lockUntil: { $lte: now } }, { lockUntil: { $exists: false } }] },
          ],
        },
        {
          $set: {
            challengeId,
            userId: user._id,
            identifier: input,
            mobile: user.mobile,
            email: user.email || undefined,
            lockUntil: new Date(Date.now() + 30000),
            resendAt: new Date(Date.now() + 60000),
            expiresAt: now,
            attempts: 0,
          },
        },
        { new: true }
      );

      if (!pending) {
        return res.status(429).json({ message: "Please wait before requesting another OTP", retryAfterSeconds: 60 });
      }

      const stubCode = process.env.OTP_STUB_CODE?.trim();
      const code = stubCode || randomInt(0, 1000000).toString().padStart(6, "0");
      let smsDelivered = false;

      try {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
          if (process.env.TWILIO_PHONE_NUMBER) {
            await sendSMS(
              user.mobile,
              `Your MalikSe password reset OTP is ${code}. It expires in 2 minutes. Do not share this code.`
            );
          } else {
            await sendTwilioVerification(user.mobile);
          }
          smsDelivered = true;
        }
      } catch (smsErr: any) {
        if (stubCode || !process.env.TWILIO_ACCOUNT_SID || process.env.NODE_ENV !== "production") {
          console.log(`[AUTH] SMS delivery note (${smsErr.message}). Password reset OTP for ${user.mobile} is: ${code}`);
        } else {
          throw smsErr;
        }
      }

      const expiresAt = new Date(Date.now() + 120000);
      const resendAt = new Date(Date.now() + 60000);

      await PasswordReset.updateOne(
        { _id: resetKey, challengeId },
        {
          $set: {
            otpHash: resetOtpDigest(challengeId, code),
            expiresAt,
            resendAt,
            lockUntil: new Date(0),
            deleteAt: new Date(Date.now() + 86400000),
          },
        }
      );

      const maskedMobileText = maskMobile(user.mobile);
      const maskedEmailText = user.email ? maskEmail(user.email) : undefined;
      const destination = user.email ? `${maskedMobileText} & ${maskedEmailText}` : maskedMobileText;

      return res.status(200).json({
        challengeId,
        expiresInSeconds: 120,
        resendAfterSeconds: 60,
        destination,
        maskedMobile: maskedMobileText,
        maskedEmail: maskedEmailText,
        stubCode: (!smsDelivered || stubCode) ? code : undefined,
      });
    } catch (error: any) {
      res
        .status(error?.status === 503 ? 503 : 500)
        .json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
    }
  }
);

// POST /auth/forgot-password/resend
router.post(
  "/forgot-password/resend",
  rateLimit({ windowMs: 60000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false }),
  async (req, res) => {
    try {
      const { challengeId } = req.body;
      if (typeof challengeId !== "string" || !challengeId.trim()) {
        return res.status(400).json({ message: "Challenge ID is required to resend OTP" });
      }

      const now = new Date();
      const existing = await PasswordReset.findOne({ challengeId: challengeId.trim() });
      if (!existing) {
        return res.status(404).json({ message: "Password reset session not found or expired. Please start over." });
      }

      if (existing.resendAt && existing.resendAt > now) {
        const waitSeconds = Math.ceil((existing.resendAt.getTime() - now.getTime()) / 1000);
        return res
          .status(429)
          .json({ message: `Please wait ${waitSeconds}s before requesting another OTP`, retryAfterSeconds: waitSeconds });
      }

      const user = await User.findById(existing.userId);
      if (!user || !accountEnabled(user)) {
        return res.status(403).json({ message: "Account is not active or suspended" });
      }

      const newChallengeId = randomUUID();
      const stubCode = process.env.OTP_STUB_CODE?.trim();
      const code = stubCode || randomInt(0, 1000000).toString().padStart(6, "0");
      let smsDelivered = false;

      try {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
          if (process.env.TWILIO_PHONE_NUMBER) {
            await sendSMS(
              user.mobile,
              `Your MalikSe password reset OTP is ${code}. It expires in 2 minutes. Do not share this code.`
            );
          } else {
            await sendTwilioVerification(user.mobile);
          }
          smsDelivered = true;
        }
      } catch (smsErr: any) {
        if (stubCode || !process.env.TWILIO_ACCOUNT_SID || process.env.NODE_ENV !== "production") {
          console.log(`[AUTH] Resend SMS note (${smsErr.message}). Password reset OTP for ${user.mobile} is: ${code}`);
        } else {
          throw smsErr;
        }
      }

      const expiresAt = new Date(Date.now() + 120000);
      const resendAt = new Date(Date.now() + 60000);

      await PasswordReset.updateOne(
        { _id: existing._id },
        {
          $set: {
            challengeId: newChallengeId,
            otpHash: resetOtpDigest(newChallengeId, code),
            expiresAt,
            resendAt,
            lockUntil: new Date(0),
            attempts: 0,
          },
        }
      );

      return res.status(200).json({
        challengeId: newChallengeId,
        expiresInSeconds: 120,
        resendAfterSeconds: 60,
        stubCode: (!smsDelivered || stubCode) ? code : undefined,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to resend verification OTP" });
    }
  }
);

// POST /auth/reset-password
router.post(
  "/reset-password",
  rateLimit({ windowMs: 60000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false }),
  async (req, res) => {
    const { challengeId, code, newPassword } = req.body;

    if (
      typeof challengeId !== "string" ||
      !challengeId.trim() ||
      typeof code !== "string" ||
      !/^\d{6}$/.test(code.trim())
    ) {
      return res.status(400).json({ message: "Enter the 6-digit verification code sent to your registered mobile/email" });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6 || Buffer.byteLength(newPassword, "utf8") > 72) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters and at most 72 UTF-8 bytes" });
    }

    const commonWeak = isWeakPassword(newPassword);
    if (commonWeak) {
      return res.status(400).json({ message: commonWeak });
    }

    const cleanCode = code.trim();
    let locked = false;
    let resetRecordId = "";

    try {
      const pending = await PasswordReset.findOneAndUpdate(
        {
          challengeId: challengeId.trim(),
          expiresAt: { $gt: new Date() },
          lockUntil: { $lte: new Date() },
          attempts: { $lt: 5 },
        },
        {
          $inc: { attempts: 1 },
          $set: { lockUntil: new Date(Date.now() + 30000) },
        },
        { new: true }
      );

      if (!pending || !pending.otpHash) {
        return res
          .status(400)
          .json({ message: "OTP expired, invalid session, or maximum attempts exceeded. Please request a new OTP." });
      }

      const mobileWeak = isWeakPassword(newPassword, { mobile: pending.mobile });
      if (mobileWeak) {
        return res.status(400).json({ message: mobileWeak });
      }

      resetRecordId = pending._id;
      locked = true;
      let codeValid = false;

      // Check against Twilio Verify API if configured without phone number
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !process.env.TWILIO_PHONE_NUMBER) {
        try {
          codeValid = await checkTwilioVerification(pending.mobile, cleanCode);
        } catch {}
      }

      // Fallback to local cryptographic digest verification
      if (!codeValid) {
        const actual = Buffer.from(resetOtpDigest(challengeId.trim(), cleanCode), "hex");
        const expected = Buffer.from(pending.otpHash, "hex");
        if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
          codeValid = true;
        }
      }

      if (!codeValid) {
        return res.status(400).json({ message: "Incorrect verification code. Please try again." });
      }

      // Consume challenge atomically
      const consumed = await PasswordReset.findOneAndUpdate(
        { challengeId: challengeId.trim(), expiresAt: { $gt: new Date() } },
        { $set: { expiresAt: new Date(0) } }
      );
      if (!consumed) {
        return res.status(400).json({ message: "OTP expired. Please request a new code." });
      }

      // Find user
      const user = await User.findById(pending.userId);
      if (!user) {
        return res.status(404).json({ message: "User account not found." });
      }
      if (!accountEnabled(user)) {
        return res.status(403).json({ message: "This account is suspended or inactive." });
      }

      // Hash new password and save
      const passwordHash = await bcrypt.hash(newPassword, 10);
      user.passwordHash = passwordHash;

      // Invalidate old refresh tokens and issue fresh login tokens
      const { accessToken, refreshToken } = generateTokens(user);
      user.refreshTokenHash = tokenDigest(refreshToken);
      await user.save();

      // Delete password reset record
      await PasswordReset.deleteOne({ _id: pending._id });

      return res.status(200).json({
        message: "Password reset successfully.",
        accessToken,
        refreshToken,
        user: publicUser(user),
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Password reset service temporarily unavailable. Please try again." });
    } finally {
      if (locked && resetRecordId) {
        await PasswordReset.updateOne({ _id: resetRecordId }, { $set: { lockUntil: new Date(0) } }).catch(() => {});
      }
    }
  }
);

export default router;
