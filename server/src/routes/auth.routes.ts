import { cookieSession, trustedCookieOrigin, sessionPayload, refreshFromRequest, clearCookieSession } from "../services/browserSession";
import { randomUUID, randomInt, randomBytes, createHash, createHmac, timingSafeEqual } from "crypto";
import { rateLimit } from "express-rate-limit";
import { Registration } from "../models/Registration.model";
import { PasswordReset } from "../models/PasswordReset.model";
import { sendSMS, sendTwilioVerification, checkTwilioVerification, hasDedicatedTwilioPhone } from "../services/twilioSms";
import bcrypt from "../services/passwords";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { authGuard } from "../middleware/auth.middleware";
import { User } from "../models/User.model";

import { REFRESH_SECRET, accountEnabled, generateTokens, publicUser, tokenDigest, refreshExpiry } from "../services/security";
import { sendEmailOtp, sendPasswordChangeConfirmationEmail } from "../services/mailer";

const router = Router();
router.use((req, res, next) => {
  if (cookieSession(req) && !trustedCookieOrigin(req)) return res.status(403).json({ message: "Browser session origin denied" });
  next();
});
const resetResponse = (challengeId = randomUUID(), stubCode?: string) => ({ challengeId, expiresInSeconds: 120, resendAfterSeconds: 60, destination: "your verified contact", message: "If this account has an eligible verified contact, a code will arrive. Otherwise contact support.", ...(process.env.NODE_ENV === "test" && stubCode ? { stubCode } : {}) });


// Requests and resends share delivery rules; verification uses the saved provider.
async function deliverResetOtp(user: { mobile?: string; email?: string; mobileVerifiedAt?: Date; emailVerifiedAt?: Date }, channel: "email" | "mobile", code: string) {
  if (!(channel === "email" ? user.emailVerifiedAt : user.mobileVerifiedAt)) throw Object.assign(new Error("Contact support to recover an account without a verified contact."), { status: 503 });
  const destination = channel === "email" ? user.email : user.mobile;
  if (!destination) throw Object.assign(new Error("No registered destination for this reset method"), { status: 503 });
  if (process.env.NODE_ENV === "test" && process.env.OTP_STUB_CODE) {
    return { provider: "local", channel, destination: channel === "email" ? maskEmail(destination) : maskMobile(destination) };
  }
  let provider = "local";
  if (channel === "email") {
    await sendEmailOtp(destination, code, "forgot");
  } else if (hasDedicatedTwilioPhone()) {
    await sendSMS(destination, `Your MalikSe password reset OTP is ${code}. It expires in 2 minutes. Do not share this code.`);
  } else {
    await sendTwilioVerification(destination);
    provider = "twilio-verify";
  }
  return { provider, channel, destination: channel === "email" ? maskEmail(destination) : maskMobile(destination) };
}

function timingSafeMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufB.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Challenge-bound keyed digests prevent offline OTP guessing from a database-only leak.
const otpDigest = (id: string, code: string) =>
  createHmac("sha256", REFRESH_SECRET).update("registration-otp:" + id + ":" + String(code).replace(/\D/g, "").slice(0, 6)).digest("hex");

const resetOtpDigest = (id: string, code: string) =>
  createHmac("sha256", REFRESH_SECRET).update("password-reset-otp:" + id + ":" + String(code).replace(/\D/g, "").slice(0, 6)).digest("hex");

function verifyRegistrationOtp(challengeId: string, inputCode: string, storedHash: string): boolean {
  const clean = String(inputCode || "").replace(/\D/g, "").slice(0, 6);
  if (!clean || !storedHash) return false;

  // Legacy in-flight challenges expire after two minutes.
  const sha = createHash("sha256").update("registration-otp:" + challengeId + ":" + clean).digest("hex");
  if (timingSafeMatch(sha, storedHash)) return true;

  // 2. Legacy HMAC with REFRESH_SECRET (for any in-flight registrations)
  try {
    const hmac = createHmac("sha256", REFRESH_SECRET).update("registration-otp:" + challengeId + ":" + clean).digest("hex");
    if (timingSafeMatch(hmac, storedHash)) return true;
  } catch {}


  return false;
}

function verifyPasswordResetOtp(challengeId: string, inputCode: string, storedHash: string): boolean {
  return /^\d{6}$/.test(inputCode) && timingSafeMatch(resetOtpDigest(challengeId, inputCode), storedHash);
}


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

function isWeakPassword(password: string, context?: { name?: string; mobile?: string; email?: string }): string | null {
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

  if (context?.email) {
    const emailPrefix = context.email.split("@")[0]?.trim().toLowerCase();
    if (emailPrefix && emailPrefix.length >= 3 && clean.includes(emailPrefix)) {
      return "Password cannot contain your email username.";
    }
  }

  return null;
}

// POST /auth/register
router.post("/register", rateLimit({ windowMs: 60000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false, default: true } }), async (req, res) => {
  try {
    const { name, fullName, mobile, email, password, method } = req.body;
    const rawName = name || fullName;
    const cleanName = typeof rawName === "string" ? rawName.trim() : "";
    const cleanMobile = typeof mobile === "string" ? mobile.replace(/\D/g, "").slice(0, 10) : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const channel = method === "email" || (!cleanMobile && cleanEmail) ? "email" : "mobile";

    if (cleanName.length < 2 || cleanName.length > 200) {
      return res.status(400).json({ message: "Enter your full name (at least 2 characters)" });
    }

    if (channel === "mobile") {
      if (!mobilePattern.test(cleanMobile)) {
        return res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
      }
      if (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
        return res.status(400).json({ message: "Enter a valid email address or leave blank" });
      }
    } else {
      if (!cleanEmail || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ message: "Enter a valid email address" });
      }
      if (cleanMobile && !mobilePattern.test(cleanMobile)) {
        return res.status(400).json({ message: "Enter a valid 10-digit mobile number or leave blank" });
      }
    }

    if (typeof password !== "string" || password.length < 6 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ message: "Password must contain at least 6 characters and at most 72 UTF-8 bytes" });
    }

    const weakReason = isWeakPassword(password, { name: cleanName, mobile: cleanMobile, email: cleanEmail });
    if (weakReason) {
      return res.status(400).json({ message: weakReason });
    }

    if (cleanMobile) {
      const existingUser = await User.findOne({ mobile: cleanMobile });
      if (existingUser) {
        return res.status(409).json({ message: "Mobile number already registered" });
      }
    }

    if (cleanEmail) {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(409).json({ message: "Email address already registered" });
      }
    }

    const challengeKey = channel === "email" ? cleanEmail : cleanMobile;
    const now = new Date();
    // Insert separately so a concurrent first request cannot bypass the cooldown.
    await Registration.updateOne({ _id: challengeKey }, { $setOnInsert: { deleteAt: new Date(Date.now() + 86400000) } }, { upsert: true });
    const challengeId = randomUUID();
    const pending = await Registration.findOneAndUpdate({
      _id: challengeKey,
      $and: [{ $or: [{ resendAt: { $lte: now } }, { resendAt: { $exists: false } }] },
        { $or: [{ lockUntil: { $lte: now } }, { lockUntil: { $exists: false } }] }],
    }, { $set: { challengeId, lockUntil: new Date(Date.now() + 30000), resendAt: new Date(Date.now() + 60000), expiresAt: now, attempts: 0 } }, { new: true });
    if (!pending) {
      const existing = await Registration.findById(challengeKey).lean();
      const retryAfterSeconds = Math.max(1, Math.ceil(
        (Math.max(existing?.resendAt?.getTime() ?? 0, existing?.lockUntil?.getTime() ?? 0) - Date.now()) / 1000,
      ));
      // A reload can lose the response after delivery. Resume only the same registration.
      if (existing?.challengeId && existing.otpHash && existing.passwordHash
        && existing.channel === channel && existing.name === cleanName
        && (existing.mobile || "") === cleanMobile && (existing.email || "") === cleanEmail
        && (existing.attempts ?? 0) < 5 && (existing.lockUntil?.getTime() ?? 0) <= Date.now()
        && existing.expiresAt && existing.expiresAt.getTime() > Date.now()
        && await bcrypt.compare(password, existing.passwordHash)) {
        const expiresInSeconds = Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000);
        if (expiresInSeconds > 0) {
          return res.status(202).json({
            challengeId: existing.challengeId,
            channel,
            expiresInSeconds,
            resendAfterSeconds: Math.max(0, Math.ceil(((existing.resendAt?.getTime() ?? 0) - Date.now()) / 1000)),
            resumed: true,
          });
        }
      }
      return res.status(429).json({ message: "Please wait before requesting another OTP", retryAfterSeconds });
    }

    try {
      if (channel === "mobile" && process.env.TWILIO_SMS_TEST_MODE === "true" && process.env.NODE_ENV === "test") {
        await sendSMS(cleanMobile, "sms_2fa");
        await Registration.updateOne({ _id: challengeKey, challengeId }, {
          $set: { expiresAt: new Date(0), lockUntil: new Date(0), resendAt: new Date(Date.now() + 60000) },
          $unset: { otpHash: 1, passwordHash: 1, name: 1, email: 1, mobile: 1 },
        });
        return res.status(202).json({ testOnly: true, resendAfterSeconds: 60,
          message: "Trial test SMS requested. This sample code cannot verify registration. No account was created." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const stubCode = process.env.NODE_ENV === "test" ? process.env.OTP_STUB_CODE?.trim() : undefined;
      const code = stubCode || randomInt(0, 1000000).toString().padStart(6, "0");
      let delivered = false;

      if (channel === "mobile") {
        try {
          if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            if (hasDedicatedTwilioPhone()) {
              await sendSMS(cleanMobile, `Your MalikSe verification code is ${code}. It expires in 2 minutes. Do not share this code.`);
            } else {
              // Uses Twilio Verify Service (no Twilio phone number required)
              await sendTwilioVerification(cleanMobile);
            }
            delivered = true;
          } else {
            console.warn("[AUTH] OTP delivery unavailable; code withheld from logs");
          }
        } catch (smsErr: any) {
          console.warn("[AUTH] OTP delivery unavailable; code withheld from logs");
          const allowDevOtp = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_OTP === "true";
          if (stubCode || allowDevOtp) {
            // Explicit non-production test mode only.
          } else {
            throw Object.assign(
              new Error(`${smsErr.message || "Failed to send SMS OTP"}. Alternatively, you can register instantly using Email Address.`),
              { status: 503 }
            );
          }
        }
      } else {
        // Email channel via Hostinger SMTP
        try {
          await sendEmailOtp(cleanEmail, code, "register");
          delivered = true;
        } catch (mailErr: any) {
          console.warn("[AUTH] OTP delivery unavailable; code withheld from logs");
          const allowDevOtp = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_OTP === "true";
          if (!allowDevOtp) {
            throw mailErr;
          }
        }
      }

      if (!delivered && !stubCode && !(process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_OTP === "true")) throw Object.assign(new Error("OTP delivery is unavailable"), { status: 503 });
      const expiresAt = new Date(Date.now() + 120000);
      const resendAt = new Date(Date.now() + 60000);
      await Registration.updateOne({ _id: challengeKey, challengeId }, { $set: {
        channel,
        name: cleanName,
        mobile: cleanMobile,
        email: cleanEmail,
        passwordHash,
        otpHash: otpDigest(challengeId, code),
        expiresAt,
        resendAt,
        lockUntil: new Date(0),
        deleteAt: new Date(Date.now() + 86400000),
      } });

      const showStubCode = process.env.NODE_ENV === "test" && Boolean(stubCode);
      return res.status(202).json({
        challengeId,
        channel,
        expiresInSeconds: 120,
        resendAfterSeconds: 60,
        stubCode: showStubCode ? code : undefined,
      });
    } catch (error) {
      await Registration.updateOne({ _id: challengeKey, challengeId }, { $set: { lockUntil: new Date(0), expiresAt: new Date(0) } });
      throw error;
    }
  } catch (error: any) {
    if (error.code === 11000) {
      if (error.keyPattern?.mobile) {
        return res.status(409).json({ message: "Mobile number already registered" });
      }
      if (error.keyPattern?.email) {
        return res.status(409).json({ message: "Email address already registered" });
      }
      return res.status(409).json({ message: "Mobile number or email already registered" });
    }
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// Only a matching, unexpired, single-use code can create an account.
router.post("/register/resend", rateLimit({ windowMs: 60000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false, default: true } }), async (req, res) => {
  const challengeId = req.body?.challengeId;
  if (typeof challengeId !== "string" || challengeId.length > 100) return res.status(400).json({ message: "Challenge ID is required" });
  const now = new Date();
  let locked: any;
  try {
    locked = await Registration.findOneAndUpdate({ challengeId, deleteAt: { $gt: now }, passwordHash: { $exists: true },
      resendAt: { $lte: now }, lockUntil: { $lte: now },
    }, { $set: { lockUntil: new Date(Date.now() + 30000), resendAt: new Date(Date.now() + 60000), expiresAt: now } }, { new: true });
    if (!locked) return res.status(429).json({ message: "Registration expired or resend is not available yet. Please wait or start again.", retryAfterSeconds: 60 });
    const nextChallenge = randomUUID();
    const stub = process.env.NODE_ENV === "test" ? process.env.OTP_STUB_CODE?.trim() : undefined;
    const code = stub || randomInt(0, 1000000).toString().padStart(6, "0");
    if (!stub) {
      if (locked.channel === "email") await sendEmailOtp(locked.email, code, "register");
      else if (hasDedicatedTwilioPhone()) await sendSMS(locked.mobile, `Your MalikSe verification code is ${code}. It expires in 2 minutes. Do not share this code.`);
      else await sendTwilioVerification(locked.mobile);
    }
    const updated = await Registration.updateOne({ _id: locked._id, challengeId }, { $set: {
      challengeId: nextChallenge, otpHash: otpDigest(nextChallenge, code), attempts: 0,
      expiresAt: new Date(Date.now() + 120000), resendAt: new Date(Date.now() + 60000), lockUntil: new Date(0),
    } });
    if (!updated.modifiedCount) return res.status(409).json({ message: "Registration changed. Please start again." });
    return res.status(202).json({ challengeId: nextChallenge, channel: locked.channel, expiresInSeconds: 120, resendAfterSeconds: 60, ...(stub ? { stubCode: stub } : {}) });
  } catch {
    if (locked) await Registration.updateOne({ _id: locked._id, challengeId }, { $set: { lockUntil: new Date(0), expiresAt: new Date(0) } }).catch(() => {});
    return res.status(503).json({ message: "Could not resend verification code. Please try again." });
  }
});

router.post("/register/verify", rateLimit({ windowMs: 60000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false, default: true } }), async (req, res) => {
  const rawIdentifier = String(req.body.identifier || req.body.mobile || req.body.email || "").trim();
  const rawChallengeId = String(req.body.challengeId || "").trim();
  const cleanCode = String(req.body.code ?? "").replace(/\D/g, "").slice(0, 6);

  if (!rawIdentifier) {
    return res.status(400).json({ message: "Mobile number or email identifier is missing. Please restart registration." });
  }

  if (!rawChallengeId) {
    return res.status(400).json({ message: "Verification session has expired or is invalid. Please request a new OTP." });
  }

  if (cleanCode.length !== 6) {
    return res.status(400).json({ message: "Enter the six-digit verification code (OTP)" });
  }

  const cleanMobile = rawIdentifier.replace(/\D/g, "").slice(0, 10);
  const cleanEmail = rawIdentifier.toLowerCase();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const isMobile = !rawIdentifier.includes("@") && mobilePattern.test(cleanMobile);

  if (!isMobile && !isEmail) {
    return res.status(400).json({ message: "Enter a valid 10-digit mobile number or email address" });
  }

  const registrationKey = isMobile ? cleanMobile : cleanEmail;
  let locked = false;
  try {
    const pending = await Registration.findOneAndUpdate({
      _id: registrationKey,
      challengeId: rawChallengeId,
      expiresAt: { $gt: new Date() },
      lockUntil: { $lte: new Date() },
      attempts: { $lt: 5 },
    }, {
      $inc: { attempts: 1 },
      $set: { lockUntil: new Date(Date.now() + 5000) }
    }, { new: true });

    if (!pending || !pending.otpHash) {
      return res.status(400).json({ message: "OTP expired, busy, or attempts exhausted. Please resend when available." });
    }
    locked = true;
    let codeValid = false;

    // Check against Twilio Verify API if configured and channel was mobile
    if (pending.channel === "mobile" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !hasDedicatedTwilioPhone()) {
      try {
        console.log("[Twilio Verify] Checking OTP");
        codeValid = await checkTwilioVerification(registrationKey, cleanCode);
        console.log("[Twilio Verify] Check completed");
      } catch (err: any) {
        console.error("[Twilio Verify] Check error:", err?.message);
      }
    }

    // Fallback to local cryptographic digest verification
    if (!codeValid) {
      codeValid = verifyRegistrationOtp(rawChallengeId, cleanCode, pending.otpHash);
    }

    if (!codeValid) {
      await Registration.updateOne({ _id: registrationKey, challengeId: rawChallengeId }, { $set: { lockUntil: new Date(0) } });
      locked = false;
      return res.status(400).json({ message: "Incorrect OTP. Please enter the latest 6-digit code received or click Resend." });
    }

    // Recheck expiry and consume atomically before creating the account.
    const consumed = await Registration.findOneAndUpdate(
      { _id: registrationKey, challengeId: rawChallengeId, expiresAt: { $gt: new Date() } },
      { $set: { expiresAt: new Date(0) } }
    );
    if (!consumed) return res.status(400).json({ message: "OTP expired. Please resend OTP." });
    const userCleanMobile = (pending.mobile || (isMobile ? registrationKey : "")).trim();
    const userCleanEmail = (pending.email || (isEmail ? registrationKey : "")).trim().toLowerCase();

    const userPayload: any = {
      role: "user",
      name: pending.name,
      passwordHash: pending.passwordHash,
    };
    if (userCleanMobile) {
      userPayload.mobile = userCleanMobile;
      userPayload.mobileVerifiedAt = (pending.channel === "mobile" || isMobile) ? new Date() : undefined;
    }
    if (userCleanEmail) {
      userPayload.email = userCleanEmail;
      userPayload.emailVerifiedAt = (pending.channel === "email" || isEmail) ? new Date() : undefined;
    }

    const user = new User(userPayload);
    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshTokenHash = tokenDigest(refreshToken);
    user.refreshTokenExpiresAt = refreshExpiry(refreshToken);
    await user.save();
    await Registration.deleteOne({ _id: registrationKey, challengeId: rawChallengeId });
    return res.status(201).json(sessionPayload(req, res, { accessToken, refreshToken }, user));
  } catch (error: any) {
    if (error.code === 11000) {
      if (error.keyPattern?.mobile) {
        return res.status(409).json({ message: "Mobile number already registered. Please sign in." });
      }
      if (error.keyPattern?.email) {
        return res.status(409).json({ message: "Email address already registered. Please sign in." });
      }
      return res.status(409).json({ message: "Mobile number or email already registered. Please sign in." });
    }
    return res.status(error.status || 503).json({ message: error.status ? error.message : "Verification unavailable. Please try again later." });
  } finally {
    if (locked) await Registration.updateOne({ _id: registrationKey, challengeId: rawChallengeId }, { $set: { lockUntil: new Date(0) } }).catch(() => {});
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
    const isMobile = !input.includes("@") && /^[0-9]{10}$/.test(cleanMobile);
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
    user.refreshTokenExpiresAt = refreshExpiry(refreshToken);
    await user.save();

    res.json(sessionPayload(req, res, { accessToken, refreshToken }, user));
  } catch (error: any) {
    res.status(error?.status === 503 ? 503 : 500).json({ message: error?.status === 503 ? error.message : "An unexpected server error occurred" });
  }
});

// POST /auth/google
router.post("/google", async (req, res) => {
  try {
    const { credential, idToken, email: bodyEmail, name: bodyName, googleId: bodyGoogleId } = req.body;
    let email = bodyEmail;
    let name = bodyName;
    let googleId = bodyGoogleId;

    // Verify token with Google public endpoint if credential or idToken is passed
    const token = credential || idToken;
    if (token && typeof token === "string") {
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
        if (verifyRes.ok) {
          const payload = (await verifyRes.json()) as any;
          if (payload.email) {
            email = payload.email.toLowerCase();
            name = payload.name || name || email.split("@")[0];
            googleId = payload.sub || googleId;
          }
        }
      } catch (e) {
        console.warn("Google token verification error:", e);
      }
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Google authentication failed: Email address is required" });
    }

    email = email.trim().toLowerCase();
    name = (name || email.split("@")[0]).trim();

    // Check if user exists by email or googleId
    let user = await User.findOne({
      $or: [
        { email },
        ...(googleId ? [{ googleId }] : [])
      ]
    });

    if (user) {
      if (!accountEnabled(user)) {
        return res.status(403).json({ message: "This account is suspended or inactive" });
      }
      if (googleId && !user.googleId) {
        user.googleId = googleId;
      }
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
      }
    } else {
      user = new User({
        name,
        email,
        googleId,
        role: "user",
        isVerifiedIdentity: false,
        demoKycComplete: false,
        emailVerifiedAt: new Date(),
        sessionVersion: 0,
        wishlist: [],
        isActive: true,
        isSuspended: false,
      });
    }

    if (["buyer", "owner"].includes(user.role as string)) user.role = "user";

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshTokenHash = tokenDigest(refreshToken);
    user.refreshTokenExpiresAt = refreshExpiry(refreshToken);
    await user.save();

    res.json(sessionPayload(req, res, { accessToken, refreshToken }, user));
  } catch (error: any) {
    res.status(500).json({ message: error?.message || "An unexpected error occurred during Google sign in" });
  }
});

// POST /auth/kyc/demo — a UI prototype toggle, not identity verification.
router.post("/kyc/demo", authGuard, async (req: any, res) => {
  if (process.env.NODE_ENV === "production") return res.status(403).json({ message: "Identity verification requires staff review" });
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
    const refreshToken = refreshFromRequest(req);
    if (typeof refreshToken !== "string" || !refreshToken) {
      return res.status(401).json({ message: "Refresh token is required" });
    }

    // Verify token signature
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET, { algorithms: ["HS256"] }) as { id: string; role: string };
    const user = await User.findById(decoded.id);

    if (!user || !accountEnabled(user)) return res.status(401).json({ message: "Invalid refresh token" });
    const tokens = generateTokens(user);
    // Compare and replace in one write: only one concurrent refresh may win.
    const rotated = await User.updateOne({ _id: user._id, refreshTokenHash: tokenDigest(refreshToken), $or: [{ refreshTokenExpiresAt: { $gt: new Date() } }, { refreshTokenExpiresAt: { $exists: false } }], isSuspended: { $ne: true }, isActive: { $ne: false } }, { $set: { refreshTokenHash: tokenDigest(tokens.refreshToken), refreshTokenExpiresAt: refreshExpiry(tokens.refreshToken) } });
    if (!rotated.modifiedCount) return res.status(401).json({ message: "Refresh token mismatch or expired. Please sign in again" });
    res.json(sessionPayload(req, res, tokens, user));
  } catch (error: any) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// POST /auth/logout
router.post("/logout", authGuard, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 }, $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } });
    }
    clearCookieSession(res);
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

// POST /auth/change-password
router.post(
  "/change-password",
  authGuard,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: true },
  }),
  async (req: any, res) => {
    try {
      const { oldPassword, newPassword, confirmPassword } = req.body;

      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User account not found" });
      }

      if (user.isSuspended) {
        return res.status(403).json({ message: "Your account has been suspended by the administrator." });
      }
      if (user.isActive === false) {
        return res.status(403).json({ message: "Your staff account has been deactivated." });
      }

      // If user has a real current password, oldPassword is required and verified
      const hasRealPassword = Boolean(
        user.passwordHash &&
        typeof user.passwordHash === "string" &&
        !user.passwordHash.startsWith("google_oauth") &&
        /^\$2[aby]\$/.test(user.passwordHash)
      );

      if (hasRealPassword) {
        if (!oldPassword || typeof oldPassword !== "string") {
          return res.status(400).json({ message: "Please enter your current password." });
        }
        const isMatch = await bcrypt.compare(oldPassword, user.passwordHash!);
        if (!isMatch) {
          return res.status(400).json({ message: "The current password you entered is incorrect." });
        }
      }

      // Validate new password format and length
      if (typeof newPassword !== "string" || newPassword.length < 6 || Buffer.byteLength(newPassword, "utf8") > 72) {
        return res.status(400).json({ message: "New password must contain at least 6 characters and at most 72 UTF-8 bytes." });
      }

      // Check confirm password if provided
      if (confirmPassword !== undefined && confirmPassword !== newPassword) {
        return res.status(400).json({ message: "New password and confirm password do not match." });
      }

      // If user had an existing password, ensure new password is not identical to current password
      if (hasRealPassword) {
        const isSame = await bcrypt.compare(newPassword, user.passwordHash!);
        if (isSame) {
          return res.status(400).json({ message: "New password must be different from your current password." });
        }
      }

      // Weak password checks (common strings, sequential digits, personal info)
      const weakReason = isWeakPassword(newPassword, {
        name: user.name,
        mobile: user.mobile,
        email: user.email,
      });
      if (weakReason) {
        return res.status(400).json({ message: weakReason });
      }

      // Hash new password and update user
      const passwordHash = await bcrypt.hash(newPassword, 10);
      user.passwordHash = passwordHash;
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;

      // Invalidate old refresh tokens and issue fresh login tokens
      const { accessToken, refreshToken } = generateTokens(user);
      user.refreshTokenHash = tokenDigest(refreshToken);
      user.refreshTokenExpiresAt = refreshExpiry(refreshToken);
      await user.save();

      // Dispatch confirmation email if user has a registered email address
      let emailSent = false;
      const targetEmail = user.email?.trim().toLowerCase();
      if (targetEmail) {
        try {
          const mailResult = await sendPasswordChangeConfirmationEmail(
            targetEmail,
            user.name
          );
          emailSent = Boolean(mailResult.success);
        } catch (mailError: any) {
          console.error("[Auth] Confirmation email delivery failed:", mailError?.message || mailError);
        }
      }

      return res.status(200).json({
        message: "Password changed successfully.",
        emailSent,
        email: targetEmail || null,
        ...sessionPayload(req, res, { accessToken, refreshToken }, user),
      });
    } catch (error: any) {
      console.error("[Auth] Change password failed:", error?.message || error);
      res.status(error?.status === 503 ? 503 : 500).json({
        message: error?.status === 503 ? error.message : "Password change service temporarily unavailable. Please try again.",
      });
    }
  }
);

// POST /auth/forgot-password
router.post(
  "/forgot-password",
  rateLimit({ windowMs: 60000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false, default: true } }),
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

      const user = await User.findOne(isEmail ? { email: input.toLowerCase() } : { mobile: cleanMobile });
      const contact = isEmail ? "email address" : "mobile number";
      if (!user) {
        return res.status(404).json({
          code: "RECOVERY_CONTACT_NOT_REGISTERED",
          message: `No account is registered with this ${contact}.`,
        });
      }
      if (!accountEnabled(user) || !(isEmail ? user.emailVerifiedAt : user.mobileVerifiedAt)) {
        return res.status(404).json({
          code: "RECOVERY_CONTACT_UNAVAILABLE",
          message: `This ${contact} is registered but can't be used for recovery.`,
        });
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
          $unset: { resetGrantHash: "" },
        },
        { new: true }
      );

      if (!pending) {
        return res.json(resetResponse());
      }

      const stubCode = process.env.NODE_ENV === "test" ? process.env.OTP_STUB_CODE?.trim() : undefined;
      const code = stubCode || randomInt(0, 1000000).toString().padStart(6, "0");
      const delivery = await deliverResetOtp(user, isEmail ? "email" : "mobile", code);

      const expiresAt = new Date(Date.now() + 120000);
      const resendAt = new Date(Date.now() + 60000);

      await PasswordReset.updateOne(
        { _id: resetKey, challengeId },
        {
          $set: {
            otpHash: resetOtpDigest(challengeId, code),
            provider: delivery.provider,
            expiresAt,
            resendAt,
            lockUntil: new Date(0),
            deleteAt: new Date(Date.now() + 86400000),
          },
        }
      );

      return res.json(resetResponse(challengeId, stubCode ? code : undefined));
    } catch {
      // Provider failure does not reveal account existence to an unauthenticated caller.
      console.warn("[Recovery] Delivery unavailable");
      res.json(resetResponse());
    }
  }
);

// POST /auth/forgot-password/resend
router.post(
  "/forgot-password/resend",
  rateLimit({ windowMs: 60000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false, default: true } }),
  async (req, res) => {
    try {
      const { challengeId } = req.body;
      if (typeof challengeId !== "string" || !challengeId.trim()) {
        return res.status(400).json({ message: "Challenge ID is required to resend OTP" });
      }

      const now = new Date();
      const existing = await PasswordReset.findOne({ challengeId: challengeId.trim() });
      if (!existing) {
        return res.json(resetResponse());
      }

      if (existing.resendAt && existing.resendAt > now) {
        return res.json(resetResponse());
      }

      const user = await User.findById(existing.userId);
      if (!user || !accountEnabled(user)) {
        return res.json(resetResponse());
      }

      const newChallengeId = randomUUID();
      const stubCode = process.env.NODE_ENV === "test" ? process.env.OTP_STUB_CODE?.trim() : undefined;
      const code = stubCode || randomInt(0, 1000000).toString().padStart(6, "0");
      const claimed = await PasswordReset.findOneAndUpdate(
        { _id: existing._id, challengeId: existing.challengeId, resendAt: { $lte: now }, lockUntil: { $lte: now } },
        { $set: { challengeId: newChallengeId, expiresAt: now, lockUntil: new Date(Date.now() + 30000), resendAt: new Date(Date.now() + 60000) }, $unset: { resetGrantHash: "" } },
        { new: true }
      );
      if (!claimed) return res.json(resetResponse());
      const delivery = await deliverResetOtp(user, existing.identifier.includes("@") ? "email" : "mobile", code);

      const expiresAt = new Date(Date.now() + 120000);
      const resendAt = new Date(Date.now() + 60000);

      await PasswordReset.updateOne(
        { _id: existing._id, challengeId: newChallengeId },
        {
          $set: {
            challengeId: newChallengeId,
            otpHash: resetOtpDigest(newChallengeId, code),
            provider: delivery.provider,
            expiresAt,
            resendAt,
            lockUntil: new Date(0),
            attempts: 0,
          },
        }
      );

      return res.json(resetResponse(newChallengeId, stubCode ? code : undefined));
    } catch (error: any) {
      res.json(resetResponse());
    }
  }
);

const resetGrantDigest = (grant: string) => createHash("sha256").update(grant).digest("hex");

router.post(
  "/forgot-password/verify",
  rateLimit({ windowMs: 60000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false, default: true } }),
  async (req, res) => {
    const challengeId = typeof req.body?.challengeId === "string" ? req.body.challengeId.trim() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!challengeId || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Enter the 6-digit verification code." });
    }
    const now = new Date();
    const lockUntil = new Date(now.getTime() + 30000);
    let locked = false;
    try {
      const pending = await PasswordReset.findOneAndUpdate(
        { challengeId, expiresAt: { $gt: now }, lockUntil: { $lte: now }, attempts: { $lt: 5 }, resetGrantHash: { $exists: false } },
        { $inc: { attempts: 1 }, $set: { lockUntil } },
        { new: true },
      );
      if (!pending) return res.status(400).json({ message: "Code expired or maximum attempts reached. Request a new code." });
      locked = true;
      const valid = pending.provider === "twilio-verify" && pending.mobile
        ? await checkTwilioVerification(pending.mobile, code)
        : pending.provider === "local" && verifyPasswordResetOtp(challengeId, code, pending.otpHash);
      if (!valid) return res.status(400).json({ code: "INCORRECT_RESET_CODE", message: "Incorrect code. Please try again." });

      const resetToken = randomBytes(32).toString("base64url");
      const expiresInSeconds = 300;
      const update = await PasswordReset.updateOne(
        { challengeId, lockUntil, expiresAt: { $gt: new Date() } },
        { $set: { resetGrantHash: resetGrantDigest(resetToken), expiresAt: new Date(Date.now() + expiresInSeconds * 1000), lockUntil: new Date(0) } },
      );
      if (!update.matchedCount) return res.status(400).json({ message: "Code expired. Request a new code." });
      res.setHeader("Cache-Control", "no-store");
      return res.json({ resetToken, expiresInSeconds });
    } catch {
      return res.status(500).json({ message: "Could not verify the code. Please try again." });
    } finally {
      if (locked) await PasswordReset.updateOne({ challengeId, lockUntil }, { $set: { lockUntil: new Date(0) } }).catch(() => {});
    }
  },
);

// POST /auth/reset-password
router.post(
  "/reset-password",
  rateLimit({ windowMs: 60000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false, default: true } }),
  async (req, res) => {
    const rawChallengeId = String(req.body.challengeId || "").trim();
    const cleanCode = String(req.body.code ?? "").trim();
    const { newPassword, resetToken } = req.body;
    const usingGrant = typeof resetToken === "string" && /^[A-Za-z0-9_-]{43}$/.test(resetToken);

    if (!rawChallengeId || (resetToken !== undefined ? !usingGrant : !/^\d{6}$/.test(cleanCode))) {
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

    let locked = false;
    const lockUntil = new Date(Date.now() + 30000);
    const credential = usingGrant ? { resetGrantHash: resetGrantDigest(resetToken) } : { resetGrantHash: { $exists: false } };

    try {
      const pending = await PasswordReset.findOneAndUpdate(
        {
          challengeId: rawChallengeId,
          expiresAt: { $gt: new Date() },
          lockUntil: { $lte: new Date() },
          ...credential,
          ...(!usingGrant && { attempts: { $lt: 5 } }),
        },
        {
          ...(!usingGrant && { $inc: { attempts: 1 } }),
          $set: { lockUntil },
        },
        { new: true }
      );

      if (!pending || !pending.otpHash) {
        return res
          .status(400)
          .json({ message: "OTP expired, invalid session, or maximum attempts exceeded. Please request a new OTP." });
      }
      locked = true;

      const mobileWeak = isWeakPassword(newPassword, { mobile: pending.mobile || undefined });
      if (mobileWeak) {
        return res.status(400).json({ message: mobileWeak });
      }

      let codeValid = usingGrant;

      if (!usingGrant && pending.provider === "twilio-verify" && pending.mobile) {
        codeValid = await checkTwilioVerification(pending.mobile, cleanCode);
      } else if (!usingGrant && pending.provider === "local") {
        codeValid = verifyPasswordResetOtp(rawChallengeId, cleanCode, pending.otpHash);
      }

      if (!codeValid) {
        return res.status(400).json({ message: "Incorrect verification code. Please try again." });
      }

      // Consume challenge atomically
      const consumed = await PasswordReset.findOneAndUpdate(
        { challengeId: rawChallengeId, lockUntil, expiresAt: { $gt: new Date() }, ...credential },
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

      if ((pending.identifier.includes("@") ? user.email !== pending.email || !user.emailVerifiedAt : user.mobile !== pending.mobile || !user.mobileVerifiedAt)) return res.status(400).json({ message: "Recovery contact changed. Start again or contact support." });

      // Hash new password and save
      const passwordHash = await bcrypt.hash(newPassword, 10);
      user.passwordHash = passwordHash;
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;

      // Invalidate old refresh tokens and issue fresh login tokens
      const { accessToken, refreshToken } = generateTokens(user);
      user.refreshTokenHash = tokenDigest(refreshToken);
    user.refreshTokenExpiresAt = refreshExpiry(refreshToken);
      await user.save();

      // Delete password reset record
      await PasswordReset.deleteOne({ _id: pending._id });

      return res.status(200).json({
        message: "Password reset successfully.",
        ...sessionPayload(req, res, { accessToken, refreshToken }, user),
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Password reset service temporarily unavailable. Please try again." });
    } finally {
      if (locked) {
        await PasswordReset.updateOne({ challengeId: rawChallengeId, lockUntil }, { $set: { lockUntil: new Date(0) } }).catch(() => {});
      }
    }
  }
);

export default router;
