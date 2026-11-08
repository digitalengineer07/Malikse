# Temporary KYC demo mode

Set `KYC_DEMO_MODE=true` on the server and restart after deploying this change. No app rebuild is required for the current upload/status API flow. `KYC_UPLOADS_ENABLED` may stay false: demo mode overrides that switch only for demo submissions. No scanner is needed for demo KYC because files are validated in memory and discarded; property document scanning remains unchanged.

Valid PDF/JPEG/PNG uploads (up to three files, 5 MB each) set `demoKycComplete=true`. The database `isVerifiedIdentity` and real review status remain unchanged. For compatibility with the installed app, KYC status and public account responses expose the existing approved flag while demo mode is active. The response includes `demoOnly`/demo mode metadata and a visible review note saying identity was not verified. Existing app headings/buttons still use their original review/Approved wording; changing those static labels requires a client update.

The existing app refreshes KYC status after upload and refreshes the account on Continue. If an older screen has cached the account, reopen it or sign in again. Staff/admin data continues to show the separate real-verification and demo fields.

Set `KYC_DEMO_MODE=false` and restart to restore production verification requirements. Existing demo markers do not become real approvals. To then accept real documents, set `KYC_UPLOADS_ENABLED=true` and configure the scanner. Previously stored real documents and pending reviews are not deleted or auto-approved by demo mode.

Validation: server build, production-mode demo integration test and audit regressions pass. The test covers invalid/empty uploads, existing-client status fields, absence of stored files/chunks, preserved real verification and disabling demo eligibility. Run `node load/test-kyc-demo.cjs` after building against a local disposable MongoDB service.
