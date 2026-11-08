# Production readiness audit — 7 November 2026

## Decision

**NOT READY FOR PRODUCTION SIGN-OFF.** The application builds and the targeted regressions listed below pass, but dependency findings, account recovery/session weaknesses, missing production indexes and upload controls remain. Creating/pushing the `production` branch is source delivery, not deployment approval.

Scope: backend (`server`), Expo application (`app`), Vite website (`website`), tracked operational scripts, configuration and repository artifacts. Baseline commit: `5b25f39dbc85d8f87ac769a2130258ac7a3b0676`, plus the existing uncommitted password-reset work and this cleanup. Environment: Windows, Node 24.20.0, npm 11.19.0. Dates use Asia/Calcutta.

This is a repository audit, not a live infrastructure penetration test. Production credentials, TLS, DNS, cloud permissions, backups and real SMS/email delivery were not inspected. No production database was modified. No claim is made that every function is correct: the companion inventory enumerates every included function body, while behavioral evidence is limited to the tests actually run. UI components and callbacks without dedicated tests still require device/browser acceptance testing.

## Deliverables and coverage

- [Function-by-function inventory](production-2026-11-07/FUNCTION_INVENTORY.md): source locations, named functions and anonymous callbacks, database/network/storage/timer/script-sink signals, and literal backend route registrations.
- [Machine-readable inventory](production-2026-11-07/function-inventory.json): includes every inventoried module, line counts and function counts, including files with no function bodies.
- Reproduce inventory with `node audit/inventory-functions.cjs`. It uses the TypeScript parser, not regex-based function discovery. It covers the current index and nonignored untracked JavaScript/TypeScript, excluding generated bundles and declarations; ignored seed/import utilities are intentionally outside the production source inventory.
- Registry responses: [server](production-2026-11-07/dependencies-server.json), [app](production-2026-11-07/dependencies-app.json), [website](production-2026-11-07/dependencies-website.json). Advisory URLs, affected versions and remediation metadata are preserved there.

### Functional review matrix

| Area | Functions/flows examined | Evidence and remaining work |
|---|---|---|
| Startup and routing | `createApp`, `createFastifyApp`, readiness, Express handoff, shutdown | Hosting regression passes; index migration and shutdown of background notification work need attention. |
| Authentication | `authenticateRequest`, `authGuard`, `roleGuard`, `generateTokens`, login/refresh/logout/me | DB-backed account/role checks and atomic refresh replacement present; access-token revocation missing. |
| Registration/recovery | OTP digests, provider calls, register/resend/verify, forgot/resend/reset | Targeted OTP/reset tests pass with test providers. Recovery destinations and account enumeration remain findings. |
| Profile, KYC, admin | profile updates, KYC upload/download, identity review, suspend, staff creation/status/assignment | Authorization is present; recovery-address changes, buffering, retention and audit-history gaps remain. |
| Listings | `listingFields`, `validateListing`, `transition`, create/edit/submit, workspace/mine/detail | Field allowlist, ownership checks and version comparisons present; nested input validation and media limits need strengthening. |
| Assignment/submission | `availableStaff`, `enqueueSubmission`, `processNextSubmission`, `startSubmissionWorker`, claim/report | Atomic job claim, lease token and bounded retries present. Verify worker outage recovery and staff reassignment on staging. |
| Photos/documents | upload handlers, `storePropertyPhoto`, `discardPropertyPhoto`, `restoreUploadedPhoto`, download tickets | Concurrent upload/replay regression passes. Document storage and content policy remain blockers for some deployment topologies. |
| Deals/inquiries | `offerProperty`, `assignedStaff`, `createOffer`, `changeDeal`, messaging/read acknowledgements | Transaction and version guards inspected. Replica-set execution, reassignment and long-history behavior require acceptance coverage. |
| Search/recommendations | search, regional suggestions/counts, public response cache, pagination, ranking | Native/Express parity and cache tests pass; mobile recommendation parity test passes. Replica lag and real capacity not certified. |
| Background/cache infrastructure | region count rebuild/lease, notification delivery, push receipts, Redis deadlines, public mutation hooks | Cache invalidation/concurrency tests pass. Push retry semantics and production indexes need fixes. |
| Client sessions/API | URL resolution, refresh queues, stores, hydration/logout | SecureStore used natively; browser tokens use localStorage. Build URL divergence and browser hardening need verification. |
| Client uploads | `prepareUpload`, `runUploadTasks`, `uploadListingFiles` | Two-task concurrency, stable in-memory upload IDs and retries inspected; backend duplicate/recovery test passes. App termination recovery is not certified. |
| Maps/UI/navigation | map initialization/cleanup, boundary scripts, startup asset cache, resume state, route helpers | Targeted utilities/navigation tests pass. No complete visual, accessibility or physical-device audit was performed. |
| Models and operations | schemas, indexes, script entry points, package/build settings | Missing explicit indexes and startup DDL identified. Local seed/import tools removed from source tracking. |

## Findings

Severity: P1 = address before release; P2 = material issue requiring a fix or explicit operational mitigation; P3 = hardening/maintenance. Findings below are source-confirmed unless explicitly marked as a deployment condition. Dependency severity comes from npm and is distinct from these priorities.

### P1-01 — Dependency audit is not clean

The captured `npm audit --omit=dev --json` responses report:

| Package tree | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| server | 0 | 8 | 7 | 0 | 15 |
| app | 4 | 23 | 16 | 7 | 50 |
| website | 2 | 15 | 5 | 6 | 28 |

These are vulnerable-package counts, not distinct exploitable attack paths. `server/.npmrc` contains `include=dev`, so the server response includes tools such as PM2/nodemon/autocannon despite the omit argument. Direct affected packages also include Axios in the app/website and qs in the server. Determine runtime reachability, update compatible versions and lockfiles, rerun builds/regressions and capture a clean audit or individually justified exceptions. Do not apply a blind major-version force upgrade.

### P1-02 — Recovery accepts unverified or silently changed contact addresses

Evidence: `server/src/routes/user.routes.ts:34` changes email directly; `server/src/routes/auth.routes.ts:628` sends password recovery to the current address without checking `emailVerifiedAt`/`mobileVerifiedAt`. Registration can save an optional contact that was not the verified channel. Profile changes neither verify the new email nor clear the previous email-verification timestamp.

Impact: a stolen active session can replace a recovery address and then obtain a new password through the attacker's mailbox; an unverified optional contact becomes an account recovery factor. Require recent authentication and OTP verification for contact changes; keep pending addresses separate, bind recovery to verified destinations, and notify the previous contact. Test changed, unverified, stale and concurrently updated contacts.

### P1-03 — Password reset/logout do not revoke already issued access JWTs

Evidence: reset updates password and refresh hash at `server/src/routes/auth.routes.ts:828`; logout only clears refresh state at line 535. `server/src/middleware/auth.middleware.ts` verifies signature and current account status but no session version/password-change timestamp.

Impact: a stolen access token remains usable after password reset/logout until its configured expiry (default 15 minutes). Add a session/token version or issued-at cutoff, include it in tokens and enforce it on each authenticated request. Regression: old access and refresh tokens must fail after reset; decide and document whether logout revokes one or all sessions.

### P1-04 — Production index migration omits active models

Evidence: `server/src/index.ts:25` disables automatic indexes in production. `server/src/scripts/createIndexes.ts:17` enumerates nine models and omits `PasswordReset`, `Notification`, `SearchCache`, `SearchPreference`, `Engagement` and region models. Region startup creates its own indexes, but that does not cover all other models.

Impact: on a fresh production database, password-reset challenge lookups/TTL cleanup and notification polling can lack declared indexes; other omitted indexes must be checked against their owning initializers. Include all required model indexes in a repeatable pretraffic migration and assert them on a new database with autoIndex disabled. TTL absence is also a retention issue; it does not by itself bypass the explicit OTP expiry check.

### P1-05 — Startup drops uniqueness indexes and continues after migration failure

Evidence: `server/src/index.ts:42` and `:49` drop existing user mobile/email indexes before recreating them; failures are caught as warnings and readiness proceeds.

Impact: a failed create can leave a live system without uniqueness enforcement. Concurrent startups increase risk. Move DDL to an explicit migration, preflight conflicting data, verify required indexes before readiness and fail closed if constraints are absent.

### P1-06 — KYC uploads bypass the existing concurrency admission control

Evidence: `server/src/routes/kyc.routes.ts:36` uses memory storage for three 5 MB files per request; POST at line 50 has no `uploadCapacity`. The photo/document paths use that middleware.

Impact: concurrent authenticated requests can allocate large buffers before the pending/approved check, including requests that ultimately return 409. Put admission and account-state checks before parsing, enforce field/part limits and per-account rates, and prefer streaming. Verify memory under concurrent rejected as well as accepted uploads.

### P1-07 — Property documents depend on local disk

Evidence: `server/src/routes/document.routes.ts:16` derives an `uploads` directory and uses diskStorage/download from that directory. Photos and identity files use GridFS.

Deployment condition: ephemeral/replaced hosts lose document bytes; multiple independent API hosts cannot reliably download files uploaded to another host. Use durable shared storage/object storage with access control, or explicitly provision and back up a shared volume. Demonstrate upload/download across replicas and after replacement/restore before deploying that topology.

### P1-08 — Mobile lint fails

`npm run lint` in app exits 1: **11 errors, 12 warnings**. Errors include render-time `Date.now()` in `app/app/(auth)/forgot-password.tsx:20`, dynamic hook dependency lists and synchronous state changes in effects in marketplace/map components. TypeScript passes, but this is not a clean quality gate. Resolve the lint errors and review hook warnings; do not suppress the entire ruleset to obtain a pass.

### P2-01 — Proxy trust and rate limits depend on deployment topology

Evidence: `server/src/middleware/runtime.middleware.ts:26` accepts `TRUST_PROXY=true` and defaults to trusting one hop. Authentication limiters use the default per-process store. Per-client proxy behavior passes the configured one-hop test.

Risk condition: direct access to the origin or a different proxy chain permits spoofed forwarding headers or incorrect client grouping; limits multiply with process count. Restrict origin access, explicitly configure trusted proxies, and use a shared rate-limit store/per-account throttle where needed. Test through the actual edge and direct-origin paths.

### P2-02 — Password reset reveals account existence and status

Evidence: `server/src/routes/auth.routes.ts:581` returns 404 for absent accounts and 403 for inactive accounts, versus 200/challenge data for active accounts. Use a consistent public response and comparable processing behavior, while retaining useful private diagnostics and delivery throttles.

### P2-03 — Clearing profile email writes an indexed empty string

Evidence: `server/src/routes/user.routes.ts:34` writes `email: ''` with `findByIdAndUpdate`. The empty-to-undefined normalization in `server/src/models/User.model.ts` is a save hook, so it does not run for this query. A sparse unique index still indexes empty strings. A second account clearing email can receive a duplicate-key error, exposed as generic 500. Use `$unset` for empty email and test two separate users clearing it.

### P2-04 — Document file policy and aggregate quotas are absent

Evidence: document multer configuration bounds individual bytes but has no content-type/signature validation or malware quarantine. Uploads occur before property authorization, and repeated uploads can grow disk usage without an account/property quota. Downloads are authenticated and sent as attachments, reducing direct browser execution risk; that does not make arbitrary document content safe for staff. Add allowed types, validation/scanning and quotas; reject unauthorized requests before writing file bodies where practical.

### P2-05 — Nested listing validation is inconsistent and media ownership is not enforced

Evidence: `server/src/services/propertyWorkflow.ts:14` calls `.trim()` on untyped nested values, and validates media with a broad HTTP(S) regex. Direct create/patch can supply media arrays without the photo endpoint's ten-photo limit or proof of ownership. Invalid shapes can cause exception-derived 400s; arbitrary external media can track viewers or break. Add schema validation for nested types, lengths, parcel-point count and media count; restrict accepted media references to the intended upload contract. Test direct API calls, not only client form validation.

### P2-06 — Browser tokens are persisted in localStorage; website lacks in-process security headers

Evidence: `website/src/store/authStore.ts` saves access/refresh tokens in localStorage; `website/server.js` configures static files and SPA fallback without Helmet/CSP. XSS anywhere on the origin can expose both tokens. This is an architectural risk, not a demonstrated XSS exploit. Define and test CSP/headers at the serving layer, minimize executable third-party resources, and assess HttpOnly refresh cookies with appropriate CSRF controls.

### P2-07 — Mobile and website use different production API defaults

Evidence: `app/eas.json` and native fallback in `app/src/services/authService.ts` use `https://malikse.devoxa.in`; website fallback uses `https://malikseserver.devoxa.in`. Both may be intentional aliases, but their live equivalence was not checked. Configure one deliberate API origin per release, verify `/health`, `/ready`, CORS and upload/download origins from built clients, and fail builds with missing/invalid production configuration.

### P2-08 — Notification rejection can be recorded as successful delivery

Evidence: `server/src/services/pushNotifications.ts` logs non-DeviceNotRegistered per-ticket errors without throwing; `server/src/services/notificationQueue.ts` then writes `deliveredAt`. Some rejected pushes therefore do not enter the durable retry path. Classify transient/permanent errors, preserve per-device outcomes and bound retries/dead-letter handling. Test HTTP 200 containing error tickets, partial success and provider timeout.

### P2-09 — KYC resubmission does not retire replaced identity files

Evidence: successful KYC submission overwrites `kycDocuments` in `server/src/routes/kyc.routes.ts`; cleanup deletes only newly uploaded IDs on failure. Previous rejected/correction documents remain in GridFS. Define retention and implement retryable cleanup of superseded files with a deliberate review-history policy. Test repeated corrections and interrupted cleanup.

### P2-10 — Account deletion is still a draft contract

Evidence: `play-store/account-deletion.md:3` explicitly states that no functional flow was found; it contains unresolved publication placeholders. No account-deletion endpoint appears in the route inventory. Implement and test the product flow, retention handling and support/public request mechanism before representing them as available. Store-policy/legal compliance was not independently certified by this audit.

### P2-11 — Fresh-checkout and production-only behavior need dedicated CI

No tracked `.github/workflows` release gate was found. Existing local node_modules and untracked/ignored assets can mask clean-checkout failures. Server postinstall compiles TypeScript and `.npmrc` deliberately includes development dependencies. Reproduce with a clean checkout, lockfile install, explicit Node version, type/lint/test gates and a production-mode temporary database. Do not deploy a reused local `dist`: TypeScript does not remove stale compiled seed scripts.

### P3-01 — Remaining defensive hardening

- `security.requiredSecret` rejects missing/known placeholders but does not enforce minimum strength. Provision independent high-entropy signing secrets and validate lengths.
- Registration verification logs full mobile identifiers. Redact identifiers from routine provider logs.
- Deal listing returns at most 100 without a next cursor. Test older-history access and add pagination if required.
- Identity review overwrites a single `identityReview`; suspension/staff status updates do not create a durable administrative event history. Add actor/time/reason events for sensitive actions.
- Notification timers can overlap, and shutdown does not explicitly await in-flight notification/receipt work. Jobs have leases, but duplicate delivery remains possible. Document at-least-once semantics and test graceful termination.
- Production response caching is correctly disabled unless `PUBLIC_CACHE_SINGLE_WRITER=true`. Do not enable that flag with multiple writers; invalidation generations are process-local. Secondary reads also require an explicit staleness policy for suspension/unpublication.

## Validation performed

| Command / scope | Observed result |
|---|---|
| `server: npm run build` | PASS |
| `website: npm run typecheck` | PASS |
| `website: npm test` | PASS: 4 navigation tests |
| `website: npm run build` | PASS: 472 modules transformed |
| `app: npx tsc --noEmit` | PASS |
| `app: npm run lint` | FAIL: 11 errors, 12 warnings |
| `server: node load/test-hosting-startup.cjs` | PASS: startup/readiness/proxy client limits |
| `server: node load/test-password-reset.cjs` | PASS: email-only reset, invalid/expired OTP, throttling, concurrent resend, provider binding, single use and password replacement |
| `server: node load/test-registration-otp.cjs` | PASS: registration gate, expiry, cooldown, attempt cap, resend/concurrency/replay and provider failure |
| `server: node load/test-fastify-property-reads.cjs` | PASS: native GET/HEAD parity, pagination, roles, private workspaces and suspended/inactive accounts |
| `server: node load/test-uploads.cjs` | PASS: duplicate photo/document requests, replay and attachment recovery; a region-refresh retry log occurred during teardown |
| `server: node load/test-public-cache.cjs` | PASS assertions: paging, visibility invalidation, compression, Redis failure fallback, races, bounded admission and protected metrics |
| `server: node load/test-assigned-workflow.cjs` | BLOCKED: required local replica set refused connection at 127.0.0.1:27028; transaction workflow not verified in this run |
| `app: node scripts/check-recommendations.cjs` | PASS: website parity, ranking/filter/limits, persistence and corrupt-state recovery |
| `app: node scripts/check-startup-cache.cjs` | PASS: integrity, offline reuse, coalescing, corrupt-file recovery and retry |
| `app: node scripts/check-leaflet-cleanup.cjs` | PASS: stale wheel-zoom reproduction and cleanup |
| `app: node scripts/test-resume.cjs` | PASS: tab/search restore, ordered writes, web isolation, unavailable/corrupt storage |
| `app: node scripts/test-region-boundaries.cjs` | PASS: hierarchy, tags, geometry holes, cleanup, script syntax and escaped labels |
| npm dependency audits | FAIL: advisory counts above; raw responses attached |
| `git diff --check` | PASS at cleanup verification |

Test providers were stubbed; passing OTP tests does not certify SMTP/Twilio credentials or delivery. Existing historical load reports are not fresh production capacity evidence. End-to-end physical devices, accessibility, payment operations, sustained production-scale load, backup restore, failover, email ownership changes and post-reset access-token rejection remain unverified.

## Repository cleanup applied

1. Removed 13 seed/import/demo verification/property-maintenance files from the Git index and ignored their paths/patterns. Includes the archived URL-fixing script. Two existing untracked staff fixture scripts are now ignored as well.
2. Removed five uploaded PDFs/images from tracking; `server/uploads/` remains local runtime data.
3. Removed 140 generated build-check/debug/scratch/package artifacts from tracking and added ignore rules. **All 158 previously tracked removed files were retained on local disk.**
4. Removed four npm commands that would reference missing local-only utilities in a fresh checkout. Existing password-reset changes were preserved.
5. Excluded local-only seed/import/staff fixture scripts from TypeScript build inputs. Runtime upload services, submission workers, explicit migrations and tests remain tracked.
6. No Git history rewrite: old commits still contain removed files. A new branch does not erase historical data. Investigate and separately remove historical sensitive data/rotate exposed credentials if any are confirmed.

Local bootstrap remains possible with the ignored `server/src/scripts/seedAdmin.ts`, using environment-supplied admin credentials. A fresh production checkout needs a controlled external bootstrap procedure; do not restore default-password fixture accounts. Build release artifacts from a clean output directory so stale JavaScript from previously compiled seeders cannot ship.

## Required release evidence

Before deployment: remediate P1 findings; resolve applicable P2 findings or record concrete mitigations; capture clean dependency and lint results; verify all required indexes on a fresh production-mode database; test the replica-set transaction workflows; exercise auth/KYC/list/upload/submit/review/search/inquiry/deal/logout/recovery from both clients; verify uploaded-file persistence across restarts/replicas; restore a backup; validate proxy/TLS/CORS and production origins; confirm alerting for database errors, queue age, upload capacity and provider failures; and document rollback plus approved retention/deletion behavior.

The function inventory is an explicit review checklist for remaining per-function tests. Passing compilation or appearing in that inventory is not equivalent to a function-level correctness or security certification.
