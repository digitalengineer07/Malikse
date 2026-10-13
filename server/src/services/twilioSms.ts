/** Credentials are read per call; restart the process after editing .env. */
export function normalizePhone(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
  if (/^\d{10}$/.test(cleaned)) return "+91" + cleaned;
  if (/^91\d{10}$/.test(cleaned)) return "+" + cleaned;
  return null;
}
export async function sendSMS(to: string, message: string): Promise<void> {
  const account = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!account || !/^AC[0-9a-f]{32}$/i.test(account) || !token || token.includes("your_") || !from || !/^\+[1-9]\d{7,14}$/.test(from)) {
    throw Object.assign(new Error("SMS is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER on the server."), { status: 503 });
  }
  const normalized = normalizePhone(to);
  if (!normalized) throw Object.assign(new Error("Invalid SMS recipient number"), { status: 503 });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
      method: "POST", headers: { Authorization: "Basic " + Buffer.from(account + ":" + token).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: normalized, From: from, Body: message }), signal: AbortSignal.timeout(10000),
    });
    const result = await response.json() as { sid?: string; code?: number; status?: string };
    if (!response.ok || !result.sid || ["failed", "undelivered"].includes(result.status || "")) {
      console.error("[Twilio SMS] Request rejected", { status: response.status, code: result.code });
      throw new Error(result.code === 21608 ? "Trial accounts can send SMS only to numbers verified in Twilio." : "SMS delivery request failed. Check Twilio credentials, sender number and trial recipient permissions.");
    }
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error && error.message.startsWith("Trial accounts") ? error.message : "Unable to send SMS. Check Twilio configuration or try again later."), { status: 503 });
  }
}
