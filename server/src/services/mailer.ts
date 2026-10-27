import nodemailer from "nodemailer";

export function isSmtpConfigured(): boolean {
  const user = process.env.SMTP_USER?.trim() || process.env.EMAIL_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim() || process.env.EMAIL_PASS?.trim() || process.env.SMTP_PASSWORD?.trim();
  return Boolean(user && pass);
}

function getMailTransporter() {
  const host = process.env.SMTP_HOST?.trim() || "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT?.trim() || 465);
  const user = process.env.SMTP_USER?.trim() || process.env.EMAIL_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || process.env.EMAIL_PASS?.trim() || process.env.SMTP_PASSWORD?.trim() || "";
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendEmailOtp(
  to: string,
  code: string,
  type: "register" | "forgot" = "register"
): Promise<{ success: boolean; messageId?: string }> {
  const cleanEmail = to.trim().toLowerCase();
  const cleanCode = code.replace(/\D/g, "").slice(0, 6);

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw Object.assign(new Error("Invalid email address"), { status: 400 });
  }

  const configured = isSmtpConfigured();
  if (!configured) {
    console.warn(`[Mailer] Hostinger SMTP not configured. Email OTP for ${cleanEmail} is: ${cleanCode}`);
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_OTP !== "true") {
      throw Object.assign(
        new Error("Email service is not configured on the server. Please set SMTP_USER and SMTP_PASS in server settings."),
        { status: 503 }
      );
    }
    return { success: true };
  }

  const subject =
    type === "register"
      ? `${cleanCode} is your MalikSe verification code`
      : `${cleanCode} is your MalikSe password reset code`;

  const title =
    type === "register" ? "Verify Your Email Address" : "Reset Your MalikSe Password";

  const description =
    type === "register"
      ? "Thank you for creating an account with MalikSe. Enter the 6-digit verification code below to verify your email address:"
      : "We received a request to reset your password on MalikSe. Enter the 6-digit code below to proceed:";

  const senderUser = process.env.SMTP_USER?.trim() || process.env.EMAIL_USER?.trim() || "noreply@malikse.devoxa.in";
  const fromHeader =
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    `"MalikSe" <${senderUser}>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #03456C; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">MalikSe</h1>
              <p style="margin: 4px 0 0 0; color: #93C5FD; font-size: 13px; font-weight: 500;">Bihar's Verified Property Platform</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0F172A; font-size: 20px; font-weight: 700;">${title}</h2>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 22px;">${description}</p>

              <!-- OTP Code Display -->
              <div style="background-color: #F0F9FF; border: 1.5px solid #BAE6FD; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #03456C; display: inline-block; padding-left: 10px;">${cleanCode}</span>
                <p style="margin: 8px 0 0 0; font-size: 12px; font-weight: 600; color: #0284C7;">Valid for 2 minutes (120 seconds)</p>
              </div>

              <!-- Security Notice -->
              <p style="margin: 20px 0 0 0; color: #64748B; font-size: 13px; line-height: 18px;">
                Never share this verification code with anyone. MalikSe employees will never ask for your code.
              </p>
              <p style="margin: 12px 0 0 0; color: #94A3B8; font-size: 12px; line-height: 16px;">
                If you did not request this verification code, please ignore this email or contact support.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 18px 32px; text-align: center;">
              <p style="margin: 0; color: #94A3B8; font-size: 12px;">© ${new Date().getFullYear()} MalikSe (Devoxa Technologies). All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `${title}\n\n${description}\n\nYour 6-Digit Code: ${cleanCode}\n\nThis code expires in 2 minutes. Do not share this code with anyone.\n\nMalikSe Team`;

  const transporter = getMailTransporter();

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to: cleanEmail,
      subject,
      text,
      html,
    });
    console.log(`[Mailer] OTP email dispatched to ${cleanEmail} (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Mailer] Failed to send email to ${cleanEmail}:`, error?.message || error);
    throw Object.assign(
      new Error(`Failed to send email OTP (${error?.message || "SMTP error"}). Please check your email address or server SMTP settings.`),
      { status: 503 }
    );
  }
}
