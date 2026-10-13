# Implementation plan: 10,000 active users on one Hostinger API deployment

> Updated direction, 12 October 2026: follow [Performance remediation plan](PERFORMANCE_REMEDIATION_PLAN.md) for the latest measured bottlenecks, Redis/compression design, pool sizing and index/Bloom-filter decisions. It supersedes this document's Redis exclusion, initial baseline figures and remaining-work assumptions. Retain the workload inventory and broader release backlog below as historical planning context.

Date: 12 October 2026. Status: implementation backlog and qualification plan; the 10,000 RPS target is not achieved or certified.

## 1. Confirmed scope and success definition

- One Express/Node.js API deployment on the user's **Hostinger Business plan**. No extra API replicas, PM2 cluster, or additional HTTP-serving processes are assumed.
- MongoDB Atlas hosts the database and the existing `PropertySearchCache` collection. Redis is not part of this plan.
- Target: **10,000 simultaneously active users × 1 API request/user/second = 10,000 API requests/second**. This differs substantially from 10,000 registered or daily users.
- All counted requests must reach this API deployment and complete their intended operation. CDN hits, client-cache hits, deliberate rejection responses, and health checks cannot substitute for successful application requests.
- Background submission processing remains inside the existing deployment, subject to an explicit CPU/concurrency budget and Hostinger lifecycle constraints. Load tests must include its work when the workload includes submissions.
- This turn creates the implementation plan. Earlier hardening changes remain in the working tree; the work packages below are not implemented by creating this document.

**Feasibility position:** there is no evidence that this application can sustain 10,000 RPS on the purchased Business allocation. The measured local result is only 50 RPS for 30 seconds over five read routes. Optimization can reduce work, but it cannot guarantee throughput beyond the hosting or Atlas allocation. If the final gates fail, the deliverable is the measured sustainable rate and limiting resource; the target remains unmet. This plan does not silently add another server or assume an upgrade.

Hostinger's current documentation supports Express on Business plans. Its public limits page also says existing Business customers retain their plan limits. Therefore, neither a generic Business RAM figure nor the local laptop's specification establishes this account's capacity. The exact hPanel allocation and Atlas tier must be recorded before qualification. [Hostinger Node.js support](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [plan limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/).

## 2. Gate 0: record the actual deployment envelope

Create `server/load/target-environment.json` without secrets. Record:

| Required field | Why it affects implementation |
| --- | --- |
| Hostinger exact plan/renewal generation, CPU allowance, RAM/process limit, CPU throttling policy | Sets the available CPU and heap budget; account allocations may be shared with other websites |
| Other websites/apps using the same hosting allocation | Their consumption reduces this API's available resources |
| Node version, build/start commands, application root, persistent storage behavior, restart policy | Determines compatible worker APIs, compilation, uploads, shutdown and recovery |
| Supported background work/worker threads, request/idle timeouts, socket limits, proxy addresses | Avoid relying on VPS-level controls or an unmanaged daemon that Business hosting may not expose |
| Hostinger deployment region and measured Hostinger-to-Atlas query latency | Remote DB latency changes pool needs and queued-request memory |
| Atlas tier/provider/region, RAM, storage/IOPS, operation and connection limits, MongoDB version | API RPS and MongoDB operations/second are different quantities |
| Atlas primary/read preferences, backup/restore configuration and index inventory | Visibility/revocation reads must retain their consistency requirements |
| Hostinger-supported procedure for a controlled staging load test | Run high-load qualification within the actual provider's operating constraints |

Do not infer API capacity from PHP worker settings or treat disk I/O limits as network throughput. Verify whether hPanel's resource graphs are account-wide or application-specific. Confirm the deployment is serving compiled `server/dist/index.js` from the server package with the configured `PORT`.

Atlas Free is documented at **100 read/write operations per second**. If the actual tier is Free, the proposed dynamic workload fails this prerequisite before a 10,000 RPS run. A cache collection on that same cluster shares its limits. Dedicated tiers must also be measured; their name or connection limit is not a throughput guarantee. [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [Atlas limits](https://www.mongodb.com/docs/atlas/reference/atlas-limits/).

## 3. Workload contract and engineering budgets

The following is a proposed qualification mix until real traffic is available. Save it as versioned test data; changing the mix invalidates comparisons with earlier results.

| Request group | Share | RPS at target | Representative endpoints |
| --- | ---: | ---: | --- |
| Search and filtered browsing | 40% | 4,000 | `GET /properties/search` |
| Public details | 25% | 2,500 | `GET /properties/:id` |
| Profile/current session reads | 10% | 1,000 | `GET /users/profile`, `GET /auth/me` |
| Saved/owner/workspace reads | 10% | 1,000 | Wishlist, mine, workspace |
| Conversation reads | 8% | 800 | Sent/received inquiries, proposed message pages |
| Ordinary writes | 5% | 500 | Messages, draft edits, offers, wishlist/read acknowledgements |
| Password login/registration | 0.2% | 20 | `POST /auth/login`, `POST /auth/register` |
| Refresh/logout | 0.8% | 80 | Session rotation/revocation |
| Staff/admin/review operations | 1% | 100 | Review, assignment, summary and queues |
| **Total** | **100%** | **10,000** | |

Media bytes require a separate bandwidth/concurrency scenario. Metadata/upload-control calls count as API requests; bulk photo/document transfer costs must also be measured and disclosed. Do not omit existing file endpoints from successful endpoint coverage. This mix is demanding: 500 ordinary writes/sec produces up to 900,000 write operations in a 30-minute run, so prepare enough disposable workflow fixtures and storage.

Resource arithmetic to use during profiling:

- At 10,000 RPS and 200 ms **mean** response time, average in-flight requests are about 2,000; at 500 ms they are about 5,000. These are not the number of registered users or necessarily the number of TCP connections.
- A single main JavaScript thread with 70% utilization headroom has about **70 microseconds of main-thread CPU per request on average** at 10,000 RPS. Measure serialization, JWT processing, middleware and logs against that budget. Worker threads can move eligible CPU work but do not remove all main-thread work.
- A 20 KB average wire response at 10,000 RPS is about **200 MB/s / 1.6 Gbit/s**, before transport overhead. Measure actual compressed and uncompressed sizes; compression itself consumes CPU.
- Estimate DB operations as `sum(route RPS × measured DB operations per request)`. An Atlas cache hit is still a DB operation. Measure index work and bytes as well as query count.
- Start pool experiments from the existing 50-connection cap. Size from measured DB service time and concurrency; increasing the pool to thousands is not a performance fix. Include monitoring sockets, background jobs and index/deployment tools in Atlas connection budgets.

Proposed release SLOs for the declared workload: read p95 ≤500 ms and p99 ≤1 s; ordinary-write p95 ≤1 s; login p95 ≤1 s; ≥99.9% successful valid requests; zero permission leaks, lost acknowledged writes or duplicate effects; zero dropped scheduled k6 iterations. Unexpected 429/503 responses to the valid target workload count as failures. Separate intentional validation/conflict/abuse scenarios from that denominator.

## 4. Verified current gaps to fix

The [49-route audit](PRODUCTION_READINESS_PLAN.md#2-complete-endpoint-audit) remains the full route inventory. These are the concrete implementation gaps most relevant to this target:

| ID | Current code/evidence | Required change |
| --- | --- | --- |
| G01 | `propertySearch.ts`: a hit still queries unavailable owners, the Atlas cache collection, and current properties | Eliminate the global owner list; measure a bounded visibility-aware read; reduce cache round trips |
| G02 | `marketplace.ts`: every public query obtains all suspended/inactive account IDs for `$nin` | Use indexed eligibility checks for candidate owners, bounded to the requested results; benchmark an indexed join vs batched reads |
| G03 | `propertyWorkflow.ts`: publication changes run `SearchCache.deleteMany({})` | Version/narrow candidate-cache invalidation; coalesce fills and prevent a global refill storm |
| G04 | Owner, staff, admin, wishlist and inquiry lists can return growing records/arrays | Cursor pagination, explicit summary DTOs and bounded payloads, with coordinated app changes |
| G05 | Messages and verification history grow inside parent documents | Separate paginated message/audit collections and a restartable migration |
| G06 | `authGuard` does a fresh account lookup, then profile/me and some handlers fetch it again | One authoritative account lookup plus request-scoped minimal DTO reuse; retain immediate suspension checks |
| G07 | `bcryptjs` runs CPU work in the API process; staff creation is another hashing path | Measure cost; introduce a small bounded password-worker pool if supported, without reducing password strength |
| G08 | `authService.ts`: no general request timeout; any refresh failure clears the session; refresh waiters are unbounded | Typed timeout/retry policy, bounded waiters, preserve session on transient refresh failure and prevent retry storms |
| G09 | Home search cache has no age limit and every focus still makes a request | TTL/age policy, canonical keys, request coalescing, cancellation and explicit revalidation UX |
| G10 | Wishlist/suspension/staff status use toggle semantics; creates/messages/offers have no general idempotency contract | Desired-state operations, conditional versions and actor-scoped idempotency records |
| G11 | Documents use local disk; photos buffer up to 10 MB/request and query GridFS | Bound upload concurrency/memory; durable storage and document scanning/quarantine; account for file transfer load |
| G12 | Dashboard improvements still aggregate whole collections; workload/history routes can scan large histories | Materialized nonfinancial counters or short bounded caching; indexed audit/message queries |
| G13 | Submission worker polls each second and processes at most ten sequential jobs per tick | Measure required job arrival rate, bound concurrency, expose queue age/retries and preserve lease fencing |
| G14 | Runtime logs every request in production; error classification is inconsistent in several route catches | Bounded log transport/sampling, low-cardinality metrics, typed 4xx/5xx/503 errors and actual DB deadlines |
| G15 | Refresh catches DB failures as 401; logout clears refresh state but leaves access tokens valid until expiry | Correct transient failure classification, explicit session/logout semantics and revocation design |
| G16 | New indexes exist in code and temporary tests, not verified on the hosted database | Additive migration, production query-plan review and controlled rollout |
| G17 | Current load runner tests only five read routes, 200 account fixtures, max 200 VUs and a single hot search | Full endpoint workflows, 10,000 identities, diverse filters and sufficient generator concurrency |
| G18 | Demo KYC and admin-controlled payment-related states remain prototype behavior | Disable unready sensitive features or implement real verification/payment workflows before releasing them |

## 5. Ordered implementation packages

Each package is a separate reviewable change with tests and rollback notes. Suggested module names below are proposed files, not existing implementations. Do not combine all schema/API/client changes in one release.

### P00 — environment contract, metrics and endpoint coverage

**Depends on:** none. **Files:** `server/src/middleware/runtime.middleware.ts`, `server/load/*`, proposed `server/src/services/telemetry.ts` and `server/load/endpoints.json`.

1. Complete Gate 0 and save the workload/SLO configuration.
2. Generate a method/path manifest from the routes; map every current endpoint to successful, forbidden, invalid, transient-failure and concurrency cases where applicable. New routes must update the manifest.
3. Record route-template latency/error/payload histograms, process CPU/RSS/heap/event-loop delay, Atlas command latency/pool checkout time, cache hit/miss/coalescing, and submission queue age. Do not label metrics with user/property IDs or raw queries.
4. Replace unlimited console output with a bounded sink; retain errors and sample successful request events. Never log bodies, passwords, tokens or document-link query strings.

**Done when:** the current baseline is reproducible on staging, monitoring overhead is measured, and every route has a coverage status. A server-failure-free 401/403 probe is not successful-handler coverage.

### P01 — existing correctness, validation and retry failures

**Depends on:** P00. **Files:** `app/src/services/authService.ts`, `server/src/routes/auth.routes.ts`, affected route modules and shared validation/error middleware.

1. Set explicit client request and refresh deadlines. Keep credentials on refresh network/429/5xx failure; clear only on an authoritative expired/revoked session response. Bound refresh waiters and mark all replayed requests to prevent refresh loops.
2. Respect `Retry-After`; use capped jittered retries for safe reads. Retry writes only with an idempotency key. Cancel obsolete screen requests.
3. Return 503 for DB/pool outages and overloaded search, not 401 or validation 400. Implement typed operational errors and safe client messages.
4. Validate ID/query/body shapes and length/array/number bounds on every route. Preserve existing role, ownership, review-version and publication checks.
5. Make auth rate limits work for the expected NAT/client distribution; add failed-account-attempt controls. Do not merely raise or disable limits for k6.

**Done when:** expired-session, unavailable-DB, concurrent refresh, 429, timeout, malformed payload and cancelled-navigation tests pass; transient failures no longer log users out or amplify traffic.

### P02 — bounded list contracts and compact responses

**Depends on:** P01. **Files:** list route modules, `app/src/services/*`, affected screens, proposed `server/src/services/pagination.ts` and shared DTO types.

1. Add a stable `(createdAt, _id)` cursor, default page 20 and maximum 100. Validate cursor length/type/version and bind it to the normalized filter/sort. Fetch `limit + 1` for the next cursor; avoid a total count on every request.
2. Define card, conversation summary, queue summary, workspace and account DTOs. Public cards exclude detailed boundaries/history/documents and unused photos; keep authoritative price/visibility handling explicit.
3. Migrate owner lists, wishlist, inquiries, admin lists/transactions/workload and reviewer queues together with their clients. Introduce a versioned contract or opt-in pagination during migration; do not silently truncate existing array clients.
4. Use lean reads where document methods are unnecessary. Measure response bytes and serialization time, not only database duration.

**Done when:** every list is bounded, pages do not repeat/skip stable records under the documented concurrent-insert semantics, and app search/pagination works on web and mobile. Keep the legacy response path only for a documented transition window.

### P03 — message and audit storage migration

**Depends on:** P02. **Files:** `Inquiry.model.ts`, `Property.model.ts`, inquiry/admin/review routes; new message/audit models and migration script.

1. Store messages separately with `{ inquiryId, createdAt, _id }` indexing and a unique actor/client message key. Keep only last-message/unread summary data on the conversation.
2. Store verification events separately with property/actor/time indexes. Keep current review state on the property; preserve the event payload and actor role.
3. Add participant-authorized message pagination and admin/assigned-reviewer audit reads; update the endpoint manifest and clients.
4. Backfill in bounded resumable batches with unique source keys. Reconcile counts/order/checksums and dual-write or transactionally bridge the transition. Retain original arrays through the rollback window.

**Done when:** large histories do not enlarge every list response, repeated migration is safe, concurrent messages/read acknowledgements stay correct, and rollback does not discard new events.

### P04 — search, Atlas cache and current visibility

**Depends on:** P02 and the production index inventory. **Files:** `propertySearch.ts`, `marketplace.ts`, `propertyWorkflow.ts`, `SearchCache.model.ts`, property/user routes and index migrations.

1. Measure all four paths: cache hit, cache miss, new-filter miss and invalidation burst. Record DB operations/bytes and examined keys/documents per path.
2. Replace the full unavailable-owner `$nin` query with an indexed check against candidate owners. Compare a MongoDB aggregation with bounded owner lookup against batched queries; choose using explain and latency on the actual Atlas tier.
3. Retain fresh publication, account eligibility and price checks before responding. Candidate caches may omit a new match briefly under the documented policy; they must not bypass authorization or return newly hidden records merely because their IDs are cached.
4. Keep Atlas as the cache store. Use canonical keys, explicit `expiresAt > now`, bounded candidate IDs, TTL jitter and per-key request coalescing. MongoDB TTL cleanup is delayed, so deletion is never the freshness check. [TTL behavior](https://www.mongodb.com/docs/manual/core/index-ttl/).
5. Evaluate an optional small in-process candidate-ID cache only after measuring the Hostinger heap budget; cap by bytes and entries, clear on restart/invalidation, and retain authoritative visibility checks. This adds no cache server. If memory or coherence tests fail, leave it disabled.
6. Replace global cache deletion with versioned/narrow candidate invalidation. Make publication/suspension paths invalidate the relevant generation, including worker-driven changes; recover missed invalidation through a durable event/expiry policy. This does not replace current-state permission checks.
7. Do not enable full-response or permission caching solely to hit the target. Any permitted staleness or revocation model change requires a separate explicit product contract and race/failure tests.

**Done when:** repeated queries reduce remote work, random-filter traffic remains bounded, cold-start/invalidation cannot produce unbounded concurrent fills, and existing private/suspended/unpublished/current-price tests still pass. If authoritative queries exceed Atlas capacity, report that limit rather than weakening checks.

### P05 — authentication CPU and request-scoped account reuse

**Depends on:** P01 and Hostinger runtime capabilities. **Files:** `auth.middleware.ts`, auth/profile/admin-staff routes, `security.ts`; proposed password worker-pool service and session model.

1. Fetch the smallest live account projection once per request and reuse its safe fields for profile/me/role checks. Do not retain an account's authorization result across requests without a tested revocation mechanism.
2. Benchmark bcrypt cost on the actual CPU allocation. If worker threads are supported, use a small pool with bounded queue length/deadline for login, registration and staff password creation. Never create one worker per request or lower password cost to improve a chart.
3. Define session IDs, per-device refresh rotation and logout-one/logout-all. Persist revoked/session-version state atomically and verify replay, races and failures. Keep the existing immediate suspension behavior.
4. Tune the account/IP limiter and password concurrency from measured CPU and expected legitimate arrivals. Account for hashing work when the queue and API are both busy.

**Done when:** password bursts do not stall ordinary reads, revocation/rotation tests pass, and transient failures do not look like invalid credentials. A worker pool is permitted CPU isolation within the same API deployment, not an additional API replica; use a bounded lower-capacity fallback if the platform disallows it.

### P06 — safe writes and background work

**Depends on:** P01–P03. **Files:** inquiry, property, deal, user/admin routes; submission services; new idempotency/outbox models.

1. Add actor-scoped idempotency keys plus a canonical request hash for creates/offers/messages/submissions. A duplicate returns the recorded result; reusing a key for different input returns a conflict.
2. Replace wishlist, suspension and staff-status toggles with explicit desired state. Use version/expected-status predicates for concurrent decisions and preserve existing review role separation.
3. Use Atlas transactions where a single logical action changes multiple records, with an outbox for external work. Never make provider calls inside a retryable transaction callback.
4. Tune the existing submission worker with measured, bounded concurrency and leased updates. Keep one logical worker lifecycle in this deployment; expose attempts, oldest-job age and exhausted jobs. Include its CPU/DB load in qualification.
5. Treat identity/payment release blockers as separate acceptance tasks: disable demo-sensitive features or implement real verification; define integer monetary units/currency and verified payment events before claiming settlement correctness.

**Done when:** duplicate retries have one effect, concurrent updates cannot silently overwrite state, worker restarts recover leases, acknowledged operations survive failures, and queue age stays bounded under the declared write mix.

### P07 — upload memory and durable files

**Depends on:** P01 and platform storage constraints. **Files:** document/photo routes, `propertyPhotos.ts`, upload clients and document model.

1. Enforce file count/type/size and request admission before expensive work. Bound simultaneous in-memory photos; move to streaming where practical. Check actual signatures/dimensions, quarantine documents and restrict downloads until validation completes.
2. Keep the current Atlas constraint explicit: evaluate streamed GridFS for ownership documents to remove ephemeral Hostinger local-disk dependence. Protect metadata/file consistency with recoverable states and orphan cleanup.
3. Measure Atlas/GridFS traffic and the API's file bandwidth separately from JSON RPS. Set stream deadlines, disconnect cancellation and concurrency limits.
4. Optional object storage/CDN is a separately scoped infrastructure change. It is not assumed to exist or counted as proof that Hostinger handled those requests.

**Done when:** concurrent uploads stay inside the measured RAM envelope, deployment/restart does not lose documents, access tests pass, and interrupted uploads leave no inaccessible permanent garbage.

### P08 — complete the Home/client data lifecycle

**Depends on:** P01/P02/P04. **Files:** `VerifiedHomeScreen.tsx`, `propertyService.ts`, pagination/search screens and auth lifecycle.

1. Add cache age, canonical keys and per-key in-flight deduplication. Keep useful cached results visible while permitted background refresh runs; stop showing indefinitely stale results without any indication after repeated refresh failure.
2. Cancel obsolete filters/navigation requests and prevent an older response overwriting a newer cache entry. Make pull-to-refresh/retry explicit and throttle focus refreshes while data is fresh.
3. Clear actor-specific caches on logout/account change; invalidate affected public queries after publication changes. Keep server permission checks authoritative when a cached card is opened.
4. Virtualize long lists and bound/preload image work. Verify pagination/filter transitions and empty/error/offline cases on both web and mobile.

**Done when:** returning Home does not flash an unnecessary full-screen loader, duplicate focus does not duplicate requests, and errors or changed permissions are handled correctly. Reduced client requests improve UX, but the server still has to pass the declared 10,000 RPS target independently.

### P09 — runtime resource controls and deployment

**Depends on:** measured results from P00–P08. **Files:** `index.ts`, runtime middleware, deployment configuration and index/migration scripts.

1. Add per-class admission limits for costly auth/upload/report work, bounded queues and explicit 429/503/Retry-After behavior. Derive values from measured service time and heap use.
2. Implement DB operation deadlines on all significant query classes. An HTTP receive timeout alone does not cancel a long query or business operation. Propagate cancellation where supported and clean up streams/jobs appropriately.
3. Tune pool checkout limits from measured remote latency and Atlas limits; keep persistent connections and avoid reconnecting per request. Do not solve queueing by creating unlimited sockets.
4. Configure the actual trusted proxy addresses, CORS origins, public HTTPS origin, production logging and Hostinger build/start paths. Benchmark compression only if available in the actual hosting path and include its CPU cost.
5. Ship additive indexes first; verify real query plans. Use feature flags for new reads, migration progress and cache policy. Retain a working rollback build and old data through the migration window.

**Done when:** overload remains bounded, allowed workload is not falsely throttled, readiness/shutdown/restart behave correctly on Hostinger, and one deployment with worker activity stays inside its resource allowance. Do not introduce clustering to redefine the instance limit.

## 6. Qualification sequence

**Generator:** run k6 outside the Hostinger allocation, with enough independent generator CPU/network capacity. Multiple load generators do not create more API instances; their rates must sum to the one declared target. Use production-like proxy/TLS/Atlas paths and never modify private records in the live customer database.

**Fixtures:** at least 10,000 distinct accounts; 100,000 varied listings; realistic sparse/dense locations, suspension states and price distributions; populated conversations/audits/documents; sufficient isolated state for each write workflow. Increase to the expected launch cardinality if larger. Allocate unique refresh sessions to avoid artificial token-replay races; use separate contention scenarios for intentional conflicts.

**Coverage:** each of the original 49 routes plus new routes needs a valid-success scenario with payload/side-effect checks. Missing permission, nonexistent IDs and malformed payload tests are separate. Each rare route needs enough samples for useful percentiles; aggregates must not hide slow endpoints.

**Traffic diversity:** exercise hot and long-tail searches, valid empty searches, uncached details, warm cache, process restart/cold cache and invalidation bursts. Model legitimate client IP/NAT distribution for auth limits. Do not trust arbitrary forwarded headers or disable abuse controls to simulate users.

| Stage | Offered rate and duration | Gate |
| --- | --- | --- |
| Contract/functional | Low rate; all valid/invalid role workflows | Every route behaves correctly; no missing success coverage |
| On-host baseline | 50 and 100 RPS, 5 minutes each | Measure remote Atlas/proxy overhead relative to local baseline |
| Capacity steps | 250, 500, 1,000, 2,000, 5,000, 7,500 RPS; 5-minute steady plateau each after warmup | Stop at first SLO/resource failure; diagnose before advancing |
| Target | 10,000 RPS for 30 minutes after warmup | About 18 million scheduled API requests; success/latency/data-integrity gates pass |
| Headroom | Step toward 12,500–15,000 RPS only within provider/resource allowance | Establish margin; 30% capacity reserve would require about 14,286 sustainable RPS for a 10,000 RPS operating rate |
| Soak/fault | Longer steady test plus controlled cache expiry, DB slowdown and application restart | No retained-memory growth, unbounded queues or lost/duplicate acknowledged effects; recovery measured |

Use `constant-arrival-rate`/`ramping-arrival-rate` with one API request per measured iteration, or explicitly account for every request in multi-step workflows. Login/fixture creation must not be silently added to the advertised rate. Remove `sleep(1)` from arrival-rate executors. Keep a separate user-session pacing test if validating the literal per-user pattern.

The existing `maxVUs: 200` is insufficient for 10,000 RPS if requests take 200 ms on average (about 2,000 in flight). Provision VUs from observed durations with headroom and monitor generator CPU/RAM/network. `dropped_iterations` must remain zero; reducing achieved throughput as latency rises is not a pass. [k6 arrival models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/), [VU allocation](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/arrival-rate-vu-allocation/).

A release report must include offered and achieved RPS, per-route p50/p95/p99, valid-request success rate, 429/503 counts, dropped iterations, payload bytes, CPU/throttling, RSS/heap/GC/event-loop delay, Atlas operations/latency/pool waits, cache behavior and queue age. At the selected operating point retain resource headroom (initial target ≤70% sustained CPU and no increasing retained heap); redefine headroom only through a documented capacity decision.

## 7. Dependency order and review checkpoints

| Order | Packages | Review checkpoint |
| --- | --- | --- |
| 1 | P00 | Exact Hostinger/Atlas contract, telemetry and complete test inventory |
| 2 | P01 | Correct sessions/errors/retries/validation before optimization |
| 3 | P02 | API/client pagination and response-size contract |
| 4 | P04, then P05 | Reduced search/account work with unchanged access guarantees |
| 5 | P03 | Verified resumable message/audit migration |
| 6 | P06 and P07 | Idempotent writes, bounded worker/uploads and durable documents |
| 7 | P08 | Home/data lifecycle and app regressions completed |
| 8 | P09 | Hosted configuration, resource budgets, migration and rollback rehearsal |
| 9 | Qualification sequence | Signed result for the actual plan/tier, or a documented lower ceiling |

Start with P00 and P01. The first four implementation reviews should prioritize the environment/coverage evidence, transient-refresh bug, bounded APIs and the search DB-work reduction. Do not begin a broad framework rewrite or replace MongoDB solely on the basis of the old local benchmark.

## 8. What constitutes completion

The implementation is complete only when all endpoint correctness gates and migrations pass, the client supports the new contracts, the deployed configuration is recorded, and the actual one-deployment Hostinger/Atlas workload meets the target SLOs. If Business hosting saturates earlier, publish the highest sustained rate with headroom and the evidence (CPU, memory, network, Atlas or provider throttling). State **“10,000 RPS not met under the fixed constraints”**. A hosting change, extra API replica, added cache service or weaker freshness guarantee is a separate decision, not an implicit part of success.

A single API deployment also has interruption risk during process/host failures and some deployments. A throughput pass does not establish high availability.

## 9. Supporting references

- [Hostinger Node.js deployment and runtime](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger account/plan resource limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/)
- [Atlas Free throughput limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
- [Atlas connection and tier limits](https://www.mongodb.com/docs/atlas/reference/atlas-limits/)
- [MongoDB index optimization](https://www.mongodb.com/docs/v8.0/core/query-optimization/)
- [MongoDB TTL behavior](https://www.mongodb.com/docs/manual/core/index-ttl/)
- [Node.js worker threads](https://nodejs.org/api/worker_threads.html)
- [k6 open/closed workloads](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)
- [k6 arrival-rate VU allocation](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/arrival-rate-vu-allocation/)
