# Account deletion — publication copy and implementation contract

Status: draft. No functional account-deletion flow was found during this review. Do not publish the instructions below until their paths work.

## Public page copy

### Delete your MalikSe account

You can request deletion of your MalikSe account and associated personal data without reinstalling the app.

**Using the app:** Open [IMPLEMENTED_IN_APP_DELETION_PATH], review the information shown, and confirm your request.

**Without the app:** Use the request option on this page at [DELETION_URL], or contact [PRIVACY_EMAIL] from the email associated with your account, using the subject “MalikSe account deletion”. If your account uses a mobile number only, use [VERIFIED_MOBILE_ACCOUNT_REQUEST_METHOD].

We verify account ownership before processing a request. Never send a password, OTP, or KYC document by ordinary email. You will receive a request reference and an update when processing is complete.

Deletion removes your account access and eligible account data, including profile details, saved properties, search preferences, notification tokens and uploaded identity documents. Listings will be removed from public discovery. Associated property files, offers and messages will be deleted or anonymized according to the retention rules below. Deletion does not reverse a completed property transaction or cancel an obligation outside the app.

Requests are completed within [DELETION_COMPLETION_PERIOD] after verification. [RETAINED_CATEGORIES_REASONS_AND_DURATIONS]. Backup copies expire within [BACKUP_RETENTION_PERIOD]. If a specific record must be retained, access is restricted and it is not used to continue personalizing your account.

Contact: [PRIVACY_EMAIL]. Operator: [LEGAL_ENTITY].

## Suggested UI copy

- Menu: Delete account
- Heading: Delete your MalikSe account?
- Explanation: “This removes your account access and starts deletion of your associated data. Your listings will no longer appear publicly. Some records may be retained for the reasons and periods described in our deletion policy.”
- Primary action: Continue to verification
- Final action: Request account deletion
- Secondary action: Keep my account
- Success: “Your deletion request has been received. Reference: {requestId}. We will notify you at your verified contact address.”

## Required backend and UI work

1. Add a discoverable in-app entry and a public web request page. The web route must work without reinstalling the app and explain ownership verification.
2. Authenticate/re-authenticate the requester. A public request must not delete an account merely because someone knows its email or phone number. Rate-limit verification and issue expiring challenges.
3. Record request status and a non-sensitive audit reference. Make retries idempotent. Do not treat suspension or deactivation as completed deletion.
4. Revoke sessions and push tokens; remove listings from public discovery; invalidate search, recommendation and regional-count caches.
5. Cover User, SearchPreference, Engagement actor links, Inquiry/messages, Deal, Notification, PushDevice, PushReceipt, Registration and PasswordReset data, document download tokens, property media and document files, and KYC GridFS files/chunks. Check processor-held data and Firebase identity only if used for the account.
6. Preserve other parties' legitimate records only under a documented retention basis. Remove unnecessary identity links and text containing personal information; deleting only a foreign key does not anonymize message content.
7. Define how pending offers, active deals and staff assignments are handled. Do not silently delete other users' transactions or invent an indefinite retention exception.
8. Implement retryable deletion jobs, backup expiry and a completion notice. Prevent backup restoration from restoring deleted active accounts without replaying deletion records.
9. Test authorization, duplicate requests, partial failures, token revocation, file removal, caches, retained exceptions and the public request route.

Google requires account-deletion initiation both in-app and outside the app for apps offering in-app account creation: https://support.google.com/googleplay/android-developer/answer/13327111
