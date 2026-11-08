# Production audit remediation — 8 November 2026

This report follows `PRODUCTION_AUDIT_2026-11-07.md`. That report remains the historical baseline. Changes are on `production`; most fixes were already committed in `d5061a9`, with the final profile, release-input and verification fixes accompanying this report. No live deployment or production database migration was performed.

The requested code remediation is implemented except **P2-01, explicitly deferred by the owner**. This is not unconditional production sign-off: the deployment steps below are required. KYC remains a demo feature; this work does not claim real identity verification.

## Finding-by-finding disposition

| Finding | Disposition and implementation |
|---|---|
| P1-01 dependencies | Updated vulnerable dependencies/lockfiles, removed unused georaster dependencies, upgraded Multer to 2.x and added scoped mobile overrides. npm audit reports zero known vulnerabilities in server, website and app; JSON evidence is attached. Registry audits cannot establish absence of unknown vulnerabilities. |
| P1-02 contact recovery | Email replacement requires current password, OTP from the existing verified contact and OTP from the new email. No verified contact or unavailable OTP requires support; direct profile email mutation/removal is blocked. Challenges expire, cap attempts, enforce resend cooldown and reject replay. Password recovery uses verified contacts only. Both ordinary and role-specific profile screens use the verified flow. |
| P1-03 session revocation | JWTs carry a persisted session version. Logout/password reset increments it, invalidating old access and refresh credentials. Legacy tokens without a version are rejected on rollout. |
| P1-04 missing indexes | Explicit migration creates and verifies indexes for all active indexed models, including deletion, contact verification, notifications and cleanup. |
| P1-05 destructive startup | Startup no longer drops uniqueness constraints. Production verifies required indexes before readiness and fails closed. Index creation is an explicit additive migration; conflicting existing indexes need operator review. |
| P1-06 KYC admission | Real KYC uploads are disabled in production by default. If explicitly enabled, upload admission, multipart limits and scan checks apply. Demo KYC is not a substitute for verification. |
| P1-07 local documents | New property documents use shared MongoDB GridFS. Client compression and upload queue are retained. Local disk is temporary multipart storage. Added retryable cleanup and legacy document migration; legacy files require migration before retiring their volume. |
| P1-08 mobile lint | Fixed syntax, hook/dependency and unused-code issues. Clean-source verification also exposed ignored Bihar district data; the runtime module is now tracked. |
| P2-01 proxy/rate topology | **Deferred, unchanged at user request.** Confirm proxy hops, client IP isolation and rate-limit behavior for the real deployment before public traffic. |
| P2-02 reset enumeration | Absent, inactive, unverified, cooldown and provider-failure requests return a generic recovery response. No account status/destination is disclosed. SMTP-dependent timing has not been proven indistinguishable. |
| P2-03 empty email | General profile updates cannot clear or replace email. Verified replacement is the only supported email-change path. |
| P2-04 document policy | PDF/JPEG/PNG signature checks; 20 MB/file, 20 documents and conservative 200 MB/property admission; per-property upload lease; mandatory production scanner. Download responses are authenticated/ticketed attachments with nosniff. Scan provider must be configured. |
| P2-05 listing validation | Added nested location/disclosure/parcel/media type, range and length validation. Direct arbitrary photo/video URL attachment is rejected; photos are attached through authorized upload endpoints. Existing compression remains intact. New video uploads are unsupported. |
| P2-06 browser credentials | Browser refresh credentials use HttpOnly cookies with Secure in production and SameSite Strict, allowed-Origin checks and rotation. Access token is held in sessionStorage, legacy localStorage credentials are removed. Native credentials remain in SecureStore. Website server adds CSP/HSTS/frame/content-type/referrer/permissions headers. Access tokens remain accessible to same-origin JavaScript; preventing XSS remains necessary. |
| P2-07 canonical API | Mobile, EAS production and website builds use `https://malikseserver.devoxa.in`. Production configuration checks reject conflicting remote API configuration. Website is `https://malikse.devoxa.in`. |
| P2-08 notification failures | HTTP 200 tickets are inspected per device. Retry only failed devices, with bounded attempts/backoff. Failed deliveries surface in the admin dashboard and structured logs. Receipt errors and receipts missing after 24 hours return to retry handling. Delivery is at least once; a timeout can produce duplicates, and provider acceptance is not proof of device display. |
| P2-09 KYC file retention | Retryable GridFS cleanup removes replaced/unreferenced identity files when real KYC is enabled. Active references are preserved. Dummy status is explicitly retained. |
| P2-10 deletion/privacy | Existing deletion implementation retained and retested, including GridFS documents, transactional deal deferral, authentication, private status receipts, retries and shared-file preservation. Added reachable deletion/privacy links to the ordinary profile. Legal name is Malikse powered by AgHomesIndia; support address remains the user-requested placeholder. |
| P2-11 clean checkout/CI | Added GitHub workflow for dependency audit, builds, lint, client regressions, Android export, standalone Mongo and replica-set server regressions. Tested a source-only copy with fresh dependencies; found and fixed missing tracked district data. Hosted CI results are separate from local results. |
| P3-01 hardening | Minimum secret length and independent signing secrets; identifier/provider log redaction; deal pagination; persisted administrative actor/time/reason history; nonoverlapping periodic workers with shutdown waits; explicit stale-secondary-read opt-in. Process-local public cache still requires a single-writer deployment. |

## Verification and coverage

Observed passing checks during remediation:

- Server TypeScript build; audit remediation regression (indexes/fail-closed checks, dual OTP, replay, verified recovery, revocation, cookie rotation/Origin rejection, nested/media validation, push ticket/receipt retries, scanner verdicts and outages).
- Document/photo concurrency, lost-response replay, signature rejection and GridFS download regression after the Multer upgrade.
- Account deletion on a replica set, including legacy local files and GridFS document metadata/chunk removal; password reset; registration OTP; hosting startup/readiness.
- Assigned workflow: 54 HTTP checks plus transaction/assignment/privacy/reservation/sale assertions. Fastify GET/HEAD parity and authorization. Public cache pagination, invalidation, compression, Redis failure and race/admission assertions.
- Website type checking, four navigation tests and production build. Browser inspection of the ordinary profile confirmed the email OTP form, privacy link and deletion link using a synthetic local account.
- Mobile type checking and lint; recommendation, startup-cache, resume and region-boundary regressions. Android export and clean-source checks are recorded in `remediation-2026-11-07/validation.json`.
- npm audit: zero known vulnerabilities in all three lockfile dependency trees on 8 November 2026.

The refreshed syntax inventory lists every detected function body and literal route registration in tracked/nonignored source. It is **not** a claim that every function was individually executed or formally verified. See `remediation-2026-11-07/FUNCTION_INVENTORY.md` and its JSON companion. Generated bundles, declarations, secrets and ignored local import/seed utilities are excluded.

Live SMTP/Twilio delivery, scanner-provider integration, physical-device push behavior, real reverse-proxy configuration, sustained production load and backup restoration were not validated. Automated tests use disposable local databases and mocked external providers. Android export is a bundle check, not an installed-device or Play Store release test.

## Required deployment steps

1. Provision independent high-entropy JWT secrets (at least 32 bytes), canonical PUBLIC_API_URL and website CORS origin. Deploy clients/server together; existing users must sign in again because legacy sessions are invalidated. Ensure the proxy forwards Origin/cookie headers and HTTPS correctly.
2. Back up MongoDB, run `npm run build` and `npm run db:indexes:prod` with the deployment environment before routing traffic. Resolve any uniqueness conflicts manually; do not drop uniqueness indexes blindly. Use a replica set for the transactional deal workflow.
3. Configure DOCUMENT_SCAN_URL as an HTTPS raw-byte scan service returning JSON `{ "clean": true }` only for accepted content, plus DOCUMENT_SCAN_TOKEN if required. Production document uploads return 503 without a scanner. Confirm its timeout, privacy obligations and capacity. Keep KYC_UPLOADS_ENABLED disabled while KYC is dummy.
4. Run `npm run db:migrate-documents` on the host containing legacy uploads. Verify downloads through another instance. Original files are retained for rollback and need an explicit retention/deletion procedure; do not retire the source volume prematurely.
5. Serve the website through its hardened server or configure equivalent headers and SPA deep links at the actual host. Verify `/privacy-policy`, `/delete-account`, cookie login/refresh and maps under the production CSP. Replace `support@malikse.example` with a monitored mailbox before accepting support-dependent account recovery. Confirm backup-retention wording with the operator.
6. Verify GitHub checks for the pushed commit. Review admin failed-notification alerts and cleanup failures operationally. Keep PUBLIC_CACHE_SINGLE_WRITER off for multiple independent writers; enable stale replica reads only with an accepted staleness policy.
7. Resolve or explicitly accept deferred P2-01 against the real hosting topology before release. This report does not remove that release decision.

## Repository cleanup

Seeding and bulk property import/upload utilities remain local-only and ignored. Runtime upload services, cleanup workers, migrations and regression tests remain tracked because production depends on them. The mobile Bihar district module is runtime application data and is intentionally tracked. Removing files from the current tree does not purge previous Git history.

## Follow-up: existing inquiry index compatibility

A startup report exposed a legacy-schema migration case absent from the fresh-database test: `inquiry_seller_newest` (and its cursor counterpart) existed with `sellerId` keys, while the newer schema requested `staffId` under the same names. The staff indexes now use distinct `inquiry_staff_*` names. The additive migration retains seller indexes, and accepts old-name staff indexes only when keys and constraints match. Automatic Mongoose index creation is disabled so startup uses the controlled migration/verification path. Regression coverage includes legacy seller definitions, existing staff aliases and repeat migration. Production still requires `npm run db:indexes:prod` before restart; development creates required indexes at startup. No existing indexes or user data are deleted by this fix.
