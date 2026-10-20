# Twilio trial phone-number OTP setup

Registration uses Twilio Programmable Messaging with a Twilio sender number. No Verify Service SID or API key is required.

Fill in server/.env (never commit credentials):

- TWILIO_ACCOUNT_SID: Account SID starting with AC, from the Twilio Account Dashboard.
- TWILIO_AUTH_TOKEN: Auth Token from the same account dashboard, not an API key secret.
- TWILIO_PHONE_NUMBER: the SMS-capable Twilio trial sender number, including + and country code. Your personal verified recipient number is not the sender.

Complete the Messaging trial onboarding in Twilio Console and verify the recipient phone number. Trial accounts restrict recipients and may impose template, destination or sender restrictions. Enable the destination country where supported. API acceptance does not guarantee delivery; inspect Twilio Messaging Logs for delivery errors.

Restart the backend after editing .env. Reading process.env on each call picks up in-process changes, but does not reload an edited file automatically.

The backend generates a cryptographically random six-digit OTP, stores only a keyed digest bound to its challenge ID, and sends the code through Twilio SMS. Missing configuration or a failed SMS request never returns mock success. Codes are not logged or returned in API responses.

POST /auth/register accepts name, mobile (10 Indian digits), password and optional email. Returns HTTP 202 with challengeId, expiresInSeconds (120), resendAfterSeconds (100). Resending replaces the old challenge. POST /auth/register/verify accepts mobile, challengeId and code. Accounts and tokens are created only after a correct, unexpired code. Each challenge permits five attempts. MongoDB enforces cooldown and concurrent consumption across processes.

Before production deployment run npm run db:indexes from server, then restart the backend. Pending registration data has a TTL cleanup index; expiry is also enforced explicitly.

Run npm run test:otp for local MongoDB integration tests with mocked Twilio SMS responses. The test uses and removes a unique local test database and sends no live SMS. Live delivery needs valid credentials and a verified trial recipient.

## Trial delivery test mode
Set TWILIO_SMS_TEST_MODE=true and restart the backend. Registration sends the predefined sms_2fa template and returns testOnly: true. The UI shows a test notice, with a 100-second cooldown. No usable OTP challenge, account, or session is created. Set false to restore real OTP behavior (custom SMS requires an eligible account).
