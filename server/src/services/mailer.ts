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
    console.warn("[Mailer] SMTP is not configured; OTP withheld from logs");
    if (process.env.NODE_ENV === "production" || !(process.env.ALLOW_DEV_OTP === "true" || (process.env.NODE_ENV === "test" && process.env.OTP_STUB_CODE))) {
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
    console.log("[Mailer] OTP dispatched");
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Mailer] OTP delivery failed");
    throw Object.assign(
      new Error("Email OTP unavailable. Retry or contact support."),
      { status: 503 }
    );
  }
}

export async function sendPasswordChangeConfirmationEmail(
  to: string,
  userName?: string,
  metadata?: { time?: string; ip?: string; userAgent?: string }
): Promise<{ success: boolean; messageId?: string }> {
  const cleanEmail = to.trim().toLowerCase();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false };
  }

  const configured = isSmtpConfigured();
  if (!configured) {
    console.warn("[Mailer] SMTP is not configured; password change confirmation skipped");
    return { success: false };
  }

  const subject = "Security Alert: Your MalikSe password was successfully changed";
  const title = "Password Changed Successfully";
  const formattedTime = metadata?.time || new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const displayName = userName?.trim() || "MalikSe User";
  const senderUser = process.env.SMTP_USER?.trim() || process.env.EMAIL_USER?.trim() || "noreply@malikse.devoxa.in";
  const fromHeader =
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    `"MalikSe Security" <${senderUser}>`;

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
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #03456C; padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">MalikSe</h1>
              <p style="margin: 6px 0 0 0; color: #93C5FD; font-size: 13px; font-weight: 500; letter-spacing: 0.5px;">BIHAR'S VERIFIED PROPERTY PLATFORM · SECURITY ALERT</p>
            </td>
          </tr>

          <!-- Security Badge Row -->
          <tr>
            <td style="padding: 24px 32px 0 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 20px; padding: 6px 14px; display: inline-table;">
                <tr>
                  <td style="font-size: 13px; font-weight: 700; color: #059669;">
                    ✓ Security Notification
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 32px 32px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0F172A; font-size: 20px; font-weight: 700;">Password Changed Successfully</h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 24px;">
                Hello <strong>${displayName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 24px;">
                This email confirms that the password for your MalikSe account associated with <strong style="color: #0A45B5;">${cleanEmail}</strong> was successfully updated.
              </p>

              <!-- Activity Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13px; font-weight: 600; color: #64748B; width: 35%;">Action</td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 14px; font-weight: 700; color: #0F172A;">Password Change</td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 13px; font-weight: 600; color: #64748B;">Date & Time</td>
                  <td style="padding: 12px 18px; border-bottom: 1px solid #E2E8F0; font-size: 14px; font-weight: 600; color: #0F172A;">${formattedTime} IST</td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #64748B;">Status</td>
                  <td style="padding: 12px 18px; font-size: 14px; font-weight: 700; color: #059669;">Completed & Verified</td>
                </tr>
              </table>

              <!-- Safety Notice -->
              <div style="background-color: #EFF6FF; border-left: 4px solid #0A45B5; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #1E3A8A;">
                  <strong>Did you make this change?</strong><br>
                  If yes, no further action is required. Your new password is now active and stale sessions on other browsers have been safely revoked.
                </p>
              </div>

              <!-- Warning Notice -->
              <div style="background-color: #FFF1F2; border-left: 4px solid #E11D48; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #9F1239;">
                  <strong>Did not make this change?</strong><br>
                  If you did not change your password, please take immediate action. Your account may have been accessed without permission. Reset your password immediately via the Forgot Password screen or contact our dedicated support team at <a href="mailto:support@malikse.in" style="color: #E11D48; font-weight: 700; text-decoration: underline;">support@malikse.in</a>.
                </p>
              </div>

              <p style="margin: 0; color: #64748B; font-size: 13px; line-height: 20px;">
                Thank you for helping us keep your MalikSe account safe and secure.
              </p>
              <p style="margin: 12px 0 0 0; color: #0F172A; font-size: 14px; font-weight: 700;">
                — The MalikSe Security Team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #64748B; font-size: 12px; font-weight: 600;">
                MalikSe · Bihar Revenue & Property Integrity Assurance
              </p>
              <p style="margin: 0 0 10px 0; color: #94A3B8; font-size: 11px;">
                4th Floor, Om Ganga Complex, Saguna Danapur Station Road, Patna 801503
              </p>
              <p style="margin: 0; color: #94A3B8; font-size: 11px;">
                © ${new Date().getFullYear()} MalikSe (Devoxa Technologies). All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Security Alert: Your MalikSe password was successfully changed\n\nHello ${displayName},\n\nThis email confirms that your MalikSe account password (${cleanEmail}) was successfully updated on ${formattedTime} IST.\n\nIf you made this change, no further action is required.\n\nIF YOU DID NOT MAKE THIS CHANGE:\nPlease immediately reset your password or contact our security team at support@malikse.in.\n\n— The MalikSe Security Team`;

  const transporter = getMailTransporter();

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to: cleanEmail,
      subject,
      text,
      html,
    });
    console.log("[Mailer] Password change confirmation email dispatched to", cleanEmail);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Mailer] Password change confirmation email delivery failed:", error?.message || error);
    return { success: false };
  }
}
