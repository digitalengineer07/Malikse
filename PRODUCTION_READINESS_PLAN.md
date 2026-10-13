# MalikSe production readiness plan

> Latest performance implementation sequence: [Performance remediation plan](PERFORMANCE_REMEDIATION_PLAN.md). The route inventory below is useful, but its original gap descriptions predate the completed changes in `PERFORMANCE_FIXES.md` and the recent overload tests.

For the user's confirmed target of one Hostinger Business API deployment with MongoDB Atlas and 10,000 active users at 1 RPS each, follow [the implementation plan](IMPLEMENTATION_PLAN_10000_RPS.md). Its deployment constraints and qualification gates take precedence over generic multi-replica recommendations in this document. The endpoint audit below remains the current route inventory.

Audit date: 12 October 2026. Scope: all 48 original API route definitions, the new `/ready` route, authentication, database queries/indexes, uploads, submission processing, client property caching and deployment configuration.

This is a release plan with an initial implementation completed, not a declaration that the application is ready to launch. The existing multi-million-user architecture proposal remains a long-term reference. Capacity must be established for the intended deployment hardware, data and traffic mix.

## 1. Findings and changes applied

| Finding | Applied in this change | Remaining requirement |
| --- | --- | --- |
| Every focus of Home hid existing data behind a spinner | Previous change keeps public search results visible while refreshing | Bound cache age, coalesce concurrent searches, invalidate after publication/account events; test actual navigation on web and mobile |
| Password operations had no rate limiting | Separate per-IP buckets for login (20/min), registration (10/min), refresh (60/min), with 429 and Retry-After | Shared Redis/edge limits across replicas, account-based failed-login limits, abuse alerts; isolate bcrypt CPU work if profiling confirms contention |
| Wildcard CORS and minimal response hardening | Exact origin allowlist required in production, Helmet headers, no-store responses, generated request IDs; photos explicitly allow cross-origin embedding | Configure actual origins and trusted proxy CIDRs; enforce TLS at ingress |
| No full HTTP pipeline tests | Extracted `createApp`; added production middleware/integration tests | CI must exercise both route logic and the deployed middleware stack |
| DB outage could look like an expired login | Separate JWT failures (401) from DB lookup failures (503); lean auth lookup retains immediate suspension checks | Define retry/backoff behavior on the app for 429/503; do not cache permission decisions without revocation support |
| Serial dashboard counts plus loading all completed deals | Three parallel aggregations with 5-second deadlines and bounded result sets | Maintain counters/materialized summaries once full collection scans become expensive; aggregation is not constant-time |
| Missing owner, reviewer, inquiry, deal and document access indexes | Added indexes for filter/sort patterns; owner query verified without an in-memory sort | Measure `explain` on production-like cardinality; remove redundant indexes only after review; indexes add write/storage cost |
| Index creation coupled to production startup | Disabled automatic production index creation; additive migration command | Run migrations before rollout and verify indexes; never run automatic destructive `syncIndexes` |
| Unbounded DB connection waits and weak lifecycle visibility | Pool cap 50, 2-second pool wait, 5-second server selection timeout, 20-second socket timeout; `/ready`; 15-second shutdown deadline | Size total pools across API and worker replicas; monitor saturation; add explicit deadlines to remaining query classes |
| Weak route parameter checks and raw 500 messages | Admin/deal IDs and admin status query validated, auth fields bounded, generic 500 bodies for affected routes | Consistent DTO validation on every write; classify all operational vs validation errors, including current broad 400 catches |
| Dependency advisory in unused UUID package | Removed unused `uuid`, types and `ts-node-dev`; production dependency audit reports zero advisories at audit time | Full development tree still reports the nodemon/chokidar/braces advisory chain; update/replace the watcher before using untrusted repository paths |

## 2. Complete endpoint audit

Priorities: **P0** before accepting real sensitive data or enabling production workflows; **P1** before a broad launch; **P2** after measured traffic justifies the work. All routes inherit the new runtime headers/logging; auth limits cover only the three named auth routes. "Index added" means defined in code and tested in disposable databases, not deployed to the normal database.

| Method and endpoint | Access and current behavior | Technique / next action | Priority |
| --- | --- | --- | --- |
| GET `/health` | Public process liveness | Keep dependency-free; ingress health route | P1 |
| GET `/ready` | New; 503 while DB disconnected or shutdown starts | Use for load balancer readiness; connection state is not a full dependency ping | P1 |
| POST `/auth/register` | Public; bcrypt, account creation and refresh digest save | Rate limit and field bounds applied; verify mobile ownership, idempotent retries, atomic account/session persistence | P0 |
| POST `/auth/login` | Public; bcrypt on API process, one refresh digest per account | Rate limit applied; profile CPU and event-loop delay; bounded password worker pool; account-based abuse control | P0 |
| POST `/auth/kyc/demo` | User; toggles a demo flag | Async DB failures handled; replace with provider-verified workflow or restrict demo mode before claiming real identity verification | P0 |
| POST `/auth/refresh` | Signed refresh token; atomic digest compare/replace | Rate limit and algorithm restriction applied; per-device session records, expiry cleanup and replay audit | P0 |
| POST `/auth/logout` | Authenticated; clears refresh digest | Revoke active access session/version if immediate logout is required; define logout-one vs logout-all | P0 |
| GET `/auth/me` | Authenticated account DTO | Lean live authorization applied; reuse request-scoped account projection to avoid duplicate reads, without caching revoked access | P1 |
| GET `/properties/search` | Public; bounded page/limit, DB ID cache, visibility recheck | Preserve visibility recheck; canonical cursor pagination and compact card DTO; explicit 503 for overload; measure cache cost before adopting Redis | P1 |
| GET `/properties/mine` | Owner; unbounded full documents | Owner/sort index added; cursor pagination and summary projection coordinated with app | P1 |
| GET `/properties/:id/workspace` | Owner/assigned reviewer/admin | Keep live ownership/assignment checks; separate histories/documents from main response as they grow | P1 |
| GET `/properties/:id` | Public; approved, visible property only | `_id` index already serves detail; lean public projection, small response, optional revalidation metadata | P1 |
| POST `/properties` | User with demo KYC; draft creation | Request DTO/schema bounds, idempotency key, listing/account quotas; replace demo eligibility | P0 |
| PATCH `/properties/:id` | Owner; draft/correction, versioned transition | Preserve conditional write; validate all nested arrays/text/media URLs; client version precondition | P0 |
| POST `/properties/:id/submit` | Owner; durable queue, conditional status transition | Existing queue is useful; monitor oldest job, leases/retries/dead letters; scale separate workers and test crashes | P1 |
| POST `/properties/:id/photos` | Owner; memory-buffered image, 10 MB and 10-photo cap | File signature check exists; add global upload admission, pixel/decompression limits, metadata stripping, scanning and object storage/CDN | P0 |
| GET `/property-photos/:filename` | Public UUID image; GridFS/local fallback | Cross-origin header applied; immutable photo caching/CDN after deletion policy; stream metrics and shared storage | P1 |
| POST `/documents` | Owner; disk upload before ownership check, metadata + listing writes | Restrict count/type, scan/quarantine, authorized upload initiation, shared private storage; transaction/outbox for reference consistency | P0 |
| GET `/documents` | Owner/assigned reviewer/admin; signed links | Property/date index added; cap document count, lean metadata, redact signed query tokens in every log layer | P0 |
| GET `/documents/:id/file` | Signed link + live actor/property authorization | Keep no-store and live revocation; shared object storage, expiration and download error tests | P0 |
| POST `/deals/:propertyId/offer` | Eligible buyer; verifies publication and amount | Idempotency key and safe money representation; unique business constraints; rate/account quota | P0 |
| GET `/deals/:id` | Parties/admin; role-dependent projection | Invalid ID handling applied; retain private/public field separation; bound populated property response | P1 |
| PATCH `/deals/:id/status` | Owner/admin; optimistic state transition | Invalid ID handling applied; payment state must come from verified provider workflow, not an admin status alone; auditable transition records | P0 |
| GET `/verification/my-tasks` | Advisor/verifier; assigned + unassigned queues | Reviewer indexes added; separate paginated queues, summary fields and status indexes verified by explain | P1 |
| POST `/verification/:propertyId/claim` | Reviewer; atomic unassigned claim | Preserve conditional claim; recheck seller eligibility, claim quotas and concurrent contention tests | P1 |
| POST `/verification/:propertyId/report` | Assigned reviewer; versioned review transition | Preserve role separation and concurrency checks; immutable audit export, signature semantics and outbox publication event | P0 |
| POST `/admin/properties/:id/assign` | Admin; eligible reviewer and versioned transition | ID validation applied; MFA/recent authentication for privileged actions, complete immutable audit | P0 |
| GET `/admin/staff` | Admin; staff list | Role/date index added; cursor pagination and lean list DTO | P1 |
| POST `/admin/staff` | Admin; bcrypt account creation | Field bounds applied; MFA, creation rate limit, invitation/password reset workflow | P0 |
| GET `/admin/dashboard/summary` | Admin; users, properties, deals, commissions | Parallel aggregation applied; deadline/counters, reconciliation of financial totals | P1 |
| GET `/admin/properties` | Admin; status + suspended seller exclusion | Status validation and sort index applied; page/summary DTO, scalable visibility model | P1 |
| GET `/admin/users` | Admin; unbounded user list | Role/date index added; pagination, explicit fields and access auditing | P1 |
| GET `/admin/users/:userId/properties` | Admin; owner properties | ID validation and owner index applied; paginated summary | P1 |
| PUT `/admin/users/:userId/suspend` | Admin; read/save toggle | ID validation and debug-log removal applied; explicit desired boolean + conditional update, audit and visibility invalidation | P0 |
| PUT `/admin/staff/:staffId/status` | Admin; toggle plus queue reassignment | ID validation applied; explicit desired state, transactional/outbox deactivation and recoverable reassignment | P0 |
| GET `/admin/users/:userId/transactions` | Admin; inquiries and deals | ID validation and party indexes added; paginate both collections, parallel queries, minimal projections | P1 |
| GET `/admin/staff/:staffId/workload` | Admin; assignments + embedded history scan | ID validation and assignment indexes added; separate indexed audit collection for history | P1 |
| GET `/admin/properties/:propertyId/audit` | Admin; whole embedded audit array | ID validation applied; append-only audit storage and paginated events | P0 |
| GET `/users/profile` | Authenticated account DTO | Live lean guard applied; avoid second account fetch using request-scoped DTO | P1 |
| PUT `/users/profile` | Authenticated; allowed name/email update | Enforce consistent size/email validation; verified email change flow if used for authentication | P1 |
| GET `/users/my-properties` | Authenticated; duplicate owner-list path | Owner/sort index added; unify implementation and paginated response with `/properties/mine` | P1 |
| GET `/users/wishlist` | Authenticated; published/visible saved properties | Bound wishlist cardinality; paginated results; retain fresh publication and suspension filtering | P1 |
| POST `/users/wishlist/:propertyId` | Authenticated; toggles membership | Idempotent explicit add/remove methods; cap list size; avoid race-prone toggle semantics | P1 |
| POST `/inquiries` | Eligible buyer; initial inquiry/message | Idempotency key, per-account quota, duplicate inquiry policy, abuse controls | P0 |
| GET `/inquiries/sent` | Buyer; full inquiry arrays and populated fields | Buyer/date index added; paginated conversation summaries, separate message endpoint | P1 |
| GET `/inquiries/received` | Seller; full inquiry arrays and populated fields | Seller/date index added; same bounded conversation contract | P1 |
| PUT `/inquiries/:id/status` | Seller; allowed status enum | Define legal transition matrix/version precondition and add audit events | P1 |
| POST `/inquiries/:id/message` | Buyer/seller; embedded messages grow indefinitely | Separate indexed message collection, pagination, account rate limits and idempotency key | P0 |
| POST `/inquiries/:id/read` | Participant; monotonic read timestamp | Preserve `$max`; test read/message races; idempotent operation already useful | P1 |

## 3. Delivery sequence and acceptance gates

### Phase A — runtime safety and evidence (initial implementation complete)

Deploy the runtime middleware, connection bounds, readiness, input checks, aggregation and indexes from this change to staging. Run the index migration before new API instances serve traffic. Set CORS origins and trusted proxy ranges explicitly. Keep the API and submission worker as separate processes in production. Release gate: build + production/security/workflow/infrastructure tests pass; no sensitive values appear in logs; rate limiting works through the actual proxy; readiness removes unhealthy instances.

### Phase B — bounded API contracts

Introduce a shared cursor utility with stable `(createdAt, _id)` ordering, default 20 and maximum 100. Migrate every list route and corresponding Expo screen together to `{ items, nextCursor }`; do not silently truncate existing arrays. Create separate card, workspace, account and conversation DTOs. Move messages and audit histories into indexed collections with backfill and verification. Replace toggles with desired-state operations and add actor-scoped idempotency keys to create/offer/message operations. Gate: pagination cannot skip/duplicate data under inserts; retrying a write cannot create a duplicate; cross-user access tests pass.

### Phase C — sensitive workflow release blockers

Decide whether launch is a browsing-only marketplace or includes verified identity/payments. Real verification needs provider-backed evidence, retention/access rules and a clear review process; the demo toggle cannot serve that purpose. Payment status needs server-verified provider events, amount/currency checks, deduplication and reconciliation. Add admin MFA, per-device sessions, session revocation, shared abuse controls and complete request validation. Move private documents to shared storage with quarantine/scanning and recoverable metadata transactions. Gate: no sensitive workflow is enabled based only on a demo flag, client claim or unverified admin payment status.

### Phase D — representative performance qualification

Use a dedicated load generator and one production-sized API instance. Record CPU/RAM, Node/Mongo versions, instance limits, indexes, pool caps, database location and latency. Seed at least 10,000 listings for an initial baseline and then the expected launch data volume (including realistic messages, histories, photos and documents). Use distinct accounts for all roles. Separate login bursts, browsing, seller uploads/submissions, advisor/verifier decisions and admin operations.

For every endpoint, assert a successful payload and its side effects with valid permissions, plus expected rejection cases separately. Destructive workflow tests must use disposable fixtures. The earlier unauthenticated 48-route smoke test is not successful-handler coverage. Run fixed arrival-rate steps of 25/50/100/200 RPS, each with a warmup and at least 5 minutes of steady traffic; stop when latency, error or dropped-iteration budgets fail. Follow with a 30-minute soak, short 2x spike, DB slowdown, worker crash and graceful rollout. Capture per-route p50/p95/p99, errors, payload size, event-loop delay, CPU, RSS/heap, pool wait and queue age.

Initial engineering targets (proposed, not a capacity guarantee): reads p95 <500 ms, ordinary writes p95 <1 s, login p95 <1 s, unexpected error rate <1%, no dropped scheduled iterations and no unbounded memory/queue growth. Report intentional 429/409 separately. Select a sustained rate with at least 30% headroom below the measured failure point. Convert to active users only using measured requests/user/second; report registered users separately.

### Phase E — deployment and operations

Use immutable builds with supported Node LTS, pinned lockfile and `npm ci`; run compiled JavaScript with production dependencies only. Add CI for tests, type checks, dependency scans, index validation and endpoint contract drift. Use TLS ingress, secret manager, private database access, replica-set backups with restore drills, shared rate-limit storage and private object storage. Run at least two API replicas when availability is required, with API/worker connection budgets and independent autoscaling. Alert on p95/error rate, event-loop delay, DB pool waits, old queue jobs, failed uploads and backup age. Gate: restore, rollback and instance-loss drills succeed within agreed recovery objectives.

## 4. Deployment commands and configuration

Build with `npm --prefix server run build`. Run `npm --prefix server run db:indexes` in the development/staging tool environment, or `npm --prefix server run db:indexes:prod` from an already compiled production artifact. The migration only creates indexes and can still consume DB I/O; schedule it before rollout. Start with `npm --prefix server start`.

Required production settings: distinct private JWT secrets, `NODE_ENV=production`, HTTPS `PUBLIC_API_URL`, exact comma-separated HTTPS `CORS_ORIGINS`, `MONGO_URI`, and trusted proxy IPs/CIDRs in `TRUSTED_PROXIES` if applicable. An incorrect proxy allowlist can collapse all clients into one limiter bucket or trust spoofed addresses; test the real ingress. Pool defaults are 50 connections per API process and a 2-second checkout wait. Configure a separate worker with `SUBMISSION_WORKER_ENABLED=false` on API processes only after the worker is running.

The current limiter is per-process memory. It is useful for one instance but not a complete distributed abuse-control system. Do not raise production limits to make a load test pass. `/health` tests the process; `/ready` currently checks connection state and shutdown state. Server request/header timeouts protect incoming HTTP traffic; they do not cancel all ongoing database or business work.

## 5. Verification and evidence

- Server TypeScript build passes.
- `test:production` passes: headers, CORS, request IDs, readiness, body limits, malformed JSON, 429/Retry-After, aggregation semantics, owner index/sort, invalid query/IDs, immediate suspension and DB-outage 503.
- Existing workflow suite: 62 HTTP assertions plus assignment/concurrency/correction/publication checks pass.
- Existing security suite: 66 HTTP/configuration checks plus model/UI activity assertions pass.
- Existing infrastructure suite: assignment, queue leases/retries and search/privacy/index checks pass.
- `npm audit --omit=dev`: zero known advisories at audit time. Development watcher advisories remain tracked above.
- New `load:production` harness creates 200 accounts and 10,000 published listings in a unique disposable DB, runs one API process through the real middleware, uses k6 fixed arrival rate and checks successful data. It removes its temporary DB and token fixture file afterward. Run `npm --prefix server run build` then `npm --prefix server run load:production`; set `RPS` and `DURATION` for different steps. Results are in `server/load/production-baseline.json` and `production-environment.json`.

Measured baseline: 50 requests/second for 30 seconds, 1,500 successful requests, zero failures and zero dropped iterations. Overall p95 was 10.03 ms; search 6.90 ms, detail 5.29 ms, profile 4.57 ms, own listings 11.42 ms and admin summary 10.95 ms. This was Windows/Node 22.14.0 on an AMD Ryzen 5 5600H with 12 logical CPUs and approximately 7 GiB reported RAM, with the API, MongoDB and k6 sharing the host. It is a short local read baseline, not a maximum-user estimate or a production latency promise. Fixtures omit large histories/messages/media, writes, password hashing and worker processing; no before/after speedup is claimed because the earlier workload was different.

## 6. Primary references

- [Express production performance guidance](https://expressjs.com/en/advanced/best-practice-performance/): CPU-heavy work, reverse proxies and process operations.
- [Express proxy configuration](https://expressjs.com/en/guide/behind-proxies/): establish a precise trusted proxy boundary.
- [Mongoose connections](https://mongoosejs.com/docs/connections.html): pool and connection timeout behavior; this repository currently uses Mongoose 8, so verify available options against the installed types.
- [express-rate-limit usage](https://github.com/express-rate-limit/express-rate-limit/blob/main/docs/quickstart/usage.mdx): endpoint-specific limits and shared stores.
- [Helmet headers](https://github.com/helmetjs/helmet): security headers and cross-origin resource policy.
- [k6 constant arrival rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/) and [thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/): reproducible offered load and explicit pass/fail budgets.
