/** Credentials are read per call; restart the process after editing .env. */
export function normalizePhone(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
  if (/^\d{10}$/.test(cleaned)) return "+91" + cleaned;
  if (/^91\d{10}$/.test(cleaned)) return "+" + cleaned;
  return null;
}

export function hasDedicatedTwilioPhone(): boolean {
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  return Boolean(from && /^\+[1-9]\d{7,14}$/.test(from));
}

/**
 * Dispatch an OTP via Twilio Verify Service (No Twilio Phone Number Needed)
 */
export async function sendTwilioVerification(to: string): Promise<{ success: boolean; sid?: string }> {
  const account = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim() || "VAcea54a6e3b984055fd96bb8f37f73454";

  if (!account || !token) {
    throw Object.assign(new Error("Twilio credentials are not configured on server. Please use Email Registration."), { status: 503 });
  }

  const normalized = normalizePhone(to);
  if (!normalized) throw Object.assign(new Error("Invalid SMS recipient number"), { status: 400 });

  try {
    const postData = new URLSearchParams({ To: normalized, Channel: "sms" }).toString();
    const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(account + ":" + token).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(Buffer.byteLength(postData)),
      },
      body: postData,
      signal: AbortSignal.timeout(10000),
    });

    const result = (await response.json()) as { sid?: string; code?: number; message?: string; status?: string };
    if (!response.ok || !result.sid) {
      console.error("[Twilio Verify] Request failed:", { status: response.status, code: result.code, msg: result.message });
      if (result.code === 21608) {
        throw new Error("Twilio Trial account can only send SMS to numbers verified in Twilio Console. Please use Email Registration or verify your number.");
      }
      if (result.code === 21408) {
        throw new Error("SMS geo-permission for India (+91) is not enabled in Twilio Console. Please use Email Registration.");
      }
      if (result.code === 20003) {
        throw new Error("Twilio authentication failed. Please verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
      }
      throw new Error(result.message || "Twilio Verify service error. Please use Email Registration.");
    }

    return { success: true, sid: result.sid };
  } catch (error: any) {
    throw Object.assign(
      new Error(error instanceof Error ? error.message : "Unable to send verification SMS. Please try again or use Email Registration."),
      { status: 503 }
    );
  }
}

/**
 * Check an OTP code against Twilio Verify Service
 */
export async function checkTwilioVerification(to: string, code: string): Promise<boolean> {
  const account = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim() || "VAcea54a6e3b984055fd96bb8f37f73454";

  if (!account || !token) return false;

  const normalized = normalizePhone(to);
  if (!normalized) return false;

  try {
    const postData = new URLSearchParams({ To: normalized, Code: code }).toString();
    const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(account + ":" + token).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(Buffer.byteLength(postData)),
      },
      body: postData,
      signal: AbortSignal.timeout(10000),
    });

    const result = (await response.json()) as { status?: string; valid?: boolean };
    return result.status === "approved" || result.valid === true;
  } catch (error) {
    console.error("[Twilio Verify] Check error:", error);
    return false;
  }
}

/**
 * Programmable Messaging SMS (when dedicated TWILIO_PHONE_NUMBER is configured, else fallback to Twilio Verify)
 */
export async function sendSMS(to: string, message: string): Promise<void> {
  const account = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();

  // If dedicated sender number is not configured or invalid, fallback to Twilio Verify Service
  if (!from || !/^\+[1-9]\d{7,14}$/.test(from)) {
    if (account && token) {
      await sendTwilioVerification(to);
      return;
    }
    throw Object.assign(new Error("SMS is not configured. Please use Email Registration or configure Twilio on the server."), { status: 503 });
  }

  if (!account || !/^AC[0-9a-f]{32}$/i.test(account) || !token || token.includes("your_")) {
    throw Object.assign(new Error("Twilio account credentials are not configured."), { status: 503 });
  }
  const normalized = normalizePhone(to);
  if (!normalized) throw Object.assign(new Error("Invalid SMS recipient number"), { status: 503 });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
      method: "POST", headers: { Authorization: "Basic " + Buffer.from(account + ":" + token).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: normalized, From: from, Body: message }), signal: AbortSignal.timeout(10000),
    });
    const result = await response.json() as { sid?: string; code?: number; status?: string; message?: string };
    if (!response.ok || !result.sid || ["failed", "undelivered"].includes(result.status || "")) {
      console.error("[Twilio SMS] Request rejected", { status: response.status, code: result.code, msg: result.message });
      if (result.code === 21608) {
        throw new Error("Twilio Trial account can send SMS only to numbers verified in Twilio Console. Please use Email Registration.");
      }
      if (result.code === 21408) {
        throw new Error("SMS geo-permission for India (+91) is not enabled in Twilio Console. Please use Email Registration.");
      }
      throw new Error(result.message || "SMS delivery request failed.");
    }
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error && error.message.startsWith("Twilio") ? error.message : "Unable to send SMS. Check Twilio configuration or register using Email."), { status: 503 });
  }
}
