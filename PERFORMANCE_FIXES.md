# Performance fixes — 12 October 2026

This implementation addresses the pathological list sizes, repeated database/cache work, event-loop hashing stalls and client refresh issues measured in `LOCAL_BOTTLENECK_REPORT.md`. It is a local implementation and verification pass, not a certification for 10,000 RPS on Hostinger.

## Measured results

| Measurement | Before | After |
|---|---:|---:|
| Highest tested passing mixed workload | 150 RPS / 20 seconds | **400 RPS / 30 seconds** |
| Mixed 250 RPS p95 / dropped iterations | 333 ms / 70 | **9.36 ms / 0** |
| Admin property response | 11,670,391 bytes | **30,431 bytes** |
| Admin list at 2 RPS | 85.37% failures; ~10 seconds p95 | **0 failures; 14.70 ms p95** |
| Admin-stage peak API RSS | ~1,465 MiB | **~292 MiB** |
| Inbox response | 2,788,991 bytes | **41,951 bytes** |
| Inbox at 10 RPS | Timed out after admin overload* | **13.33 ms p95; no errors/drops** |
| Ten concurrent logins: maximum event-loop stall | 592 ms | **25.84 ms** |
| Warm search database commands | 3 | **1** |
| Cold search database commands | 5, including a cache write | **3, all reads** |
| Profile database commands | 2 | **1** |

The 400-RPS confirmation preallocated all 80 k6 virtual users: **12,001 requests, 23.25 ms p95, zero HTTP failures and zero dropped iterations**. Earlier runs with 30 preallocated users dropped arrivals while allocating additional users; those raw failures remain preserved, not relabeled as passes.

**Remaining capacity limits:** 500 mixed RPS still failed the no-drop threshold (462 dropped; 215.79 ms p95 in the final code's 20-second run). Uncached search at 250 RPS improved from 427 ms p95/561 drops to 229 ms p95/18 drops in the 30-second preallocated confirmation, but still **failed** the no-drop threshold. This application has not achieved 10,000 RPS. A passing 400-RPS browsing test is not 400 RPS for every route, a sustained production maximum, or a Hostinger capacity guarantee.

*The original inbox load followed admin overload, so it is not an isolated before/after throughput comparison. The payload-size reduction and current passing inbox run are independently observed.

## Implemented

- **Bounded list APIs:** default 50, maximum 100 records, validated continuation cursors and `X-Next-Cursor`. Admin properties/users/staff, owner listings, reviewer queues, documents, saved properties, conversations, transactions and staff history use bounded reads. Read-only lists use plain objects and smaller projections. CORS exposes the cursor header.
- **Compatible client navigation:** home/marketplace use cursor navigation; admin, queue, document, staff, saved-property and conversation screens expose further pages. Arrays remain arrays; compound admin responses expose a cursor per collection. Deploy the updated client with the API; old clients will only show the first page.
- **Conversations:** lists return one preview message and an accurate unread flag; opening a conversation fetches 50 messages at a time. Older pages remain available. Message appends are atomic, return a bounded response and preserve concurrent sends. Read markers no longer load message history. Web and native screens avoid overlapping polls, preserve loaded history and show send failures.
- **Hashing:** existing bcrypt hashes and cost settings remain valid. Two worker threads inside the same API process perform hashing/comparison; the waiting queue is capped at 32, running operations time out at 15 seconds, and overload returns 503. This is still one API deployment.
- **Search:** candidate IDs are cached in the API process for 15 seconds, maximum 500 keys; duplicate misses share work, with at most 50 distinct misses in flight. MongoDB cache reads, writes and collection-wide invalidation have been removed from the search request path. Existing legacy cache records can expire normally; no database deletion/migration is required for them. Every returned page checks current publication, current data and current owner flags. Visibility changes cannot return cached private data; shortened pages are rebuilt for cursor correctness.
- **Search queries:** indexed candidate selection precedes the live owner join. The join uses simple equality lookup, and a final allowlist projection removes owner/private fields. Exact district/state filters and a district cursor index are available; the app uses cursors instead of deep offset pagination. Legacy `page` queries remain supported up to the existing limit and still incur offset cost.
- **Dashboard:** coalesced, five-second aggregate snapshots replace repeated full scans on every dashboard poll. Totals may lag writes by up to five seconds.
- **Authentication reads:** profile and `/auth/me` reuse the live account check already performed by middleware. Suspension/deactivation checks remain live on each protected request.
- **Home refresh:** public result caching has a 15-second freshness window, stable keys, shared in-flight requests, mutation invalidation and a bounded stale fallback. Cached cards stay visible during refresh; stale-request results do not replace another screen's filters. Refresh failures show a notice.
- **Client authentication:** 15-second normal request timeout; 10-second refresh timeout; one retry per failed request; at most 100 refresh waiters. Temporary 429/network/503 errors do not erase the session, and a refresh cannot restore a session after an account switch/logout.
- **Other resource bounds:** four simultaneous uploads; multipart limits; cursor indexes; continuous submission-queue draining in bounded batches rather than an artificial ten-jobs-per-second ceiling. Saved-list toggles are atomic, preserve saved order and have a maximum of 1,000 entries.

Conversation storage remains embedded in MongoDB. New appends stop at 1,000 messages per conversation to bound document growth; old messages remain readable. Larger/unlimited conversations require a separate message collection and a migration. The UI reports the limit instead of silently dropping messages.

The equality-lookup change follows MongoDB's documented distinction between a simple lookup and a foreign-collection pipeline; eligibility for the optimized engine is version/plan dependent, so the measured API results remain the evidence for this application. [MongoDB 7.0 lookup documentation](https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/lookup/).

## Verification

- Server TypeScript build and app `tsc --noEmit`.
- Workflow: 62 HTTP assertions plus transitions/concurrency/publication/document checks.
- Security: 66 HTTP/configuration checks plus model and client activity assertions.
- Infrastructure: queue leases/retries, round-robin assignment, cache expiry, current values, visibility revocation and index plans.
- Production middleware: headers/CORS, body limits, rate limits, summary values, database outage and immediate account revocation.
- Added `server/load/test-performance.cjs`: complete cursor traversal, invalid cursor/limit rejection, role checks, live visibility changes, correct unread state when the last message is outgoing, authorized older-message paging, ten concurrent message appends without lost updates, atomic saved-list toggles and preserved saved-order pagination.

The browser/native screens were type-checked, not manually exercised on a device during this pass. Functional suites and k6 ran separately so test-suite CPU did not contaminate load measurements.

## Benchmark interpretation

The unchanged original evidence is in `server/load/local-results/` and `local-followup/`. Intermediate tuning runs are retained in `after-results/`, `final-results/` and `tuned-results/`; the latest implementation uses `release-results/`. The preallocated-user confirmation is in `steady-results/`. The intermediate cold-search regression was corrected before the release run.

The same machine, synthetic dataset and mixed workload were used: one API process, local MongoDB and k6 colocated; 10,000 properties, 1,000 users plus admin, 300 conversations with 30 messages each. Tests schedule arrivals for 20 seconds, with an 80-VU cap. Dropped iterations mean the offered load was not sustained. Reduced response sizes are intentional pagination changes; testing all pages of a bulk export is a different workload.

Submission workers, uploads and the client UI are not included in the throughput mix. Hostinger/Atlas latency, shared-host quotas, production logs/TLS and long-duration behavior remain unmeasured. These tests cannot establish a capacity claim for every endpoint or 10,000 active users at 1 RPS each.

## Before deployment

1. Build the API and run the existing additive `db:indexes:prod` command with the intended database configuration. No indexes are dropped. Index creation here was limited to disposable local test databases; Atlas has not been changed.
2. Release the client and API together because list/message pagination is a coordinated contract change.
3. Keep the configured JWT secrets, CORS origins, proxy settings, auth limits and Mongo pool bounds. The new search cache needs no Redis service.
4. Verify warm/cold traffic, uploads, queue backlog, write contention and an extended soak using an external generator against the actual deployment. Set capacity from passing latency/error/drop thresholds with resource headroom; do not extrapolate local results to Hostinger.

## Reproduce

From `server/`, build with `npm run build`, run `node load/test-performance.cjs`, then set `$env:PROFILE_RELEASE='1'` and run `node load/profile-local.cjs`. Remove the environment flag afterward. The profiler hardcodes loopback MongoDB, creates a unique disposable database, and removes it and its temporary tokens after finishing. Existing saved benchmark files are overwritten when that mode is rerun.

For the confirmation run instead set `PROFILE_VALIDATION=1`, `PREALLOCATED_VUS=80` and `DURATION=30s`. This selects only mixed 400 RPS and uncached-search 250 RPS and saves `steady-results/`; remove these environment flags afterward. Its cold-search stage is expected to report a failed no-drop threshold on the measured machine. The harness saves each stage's failure and continues cleanup; overall harness exit status alone is not a capacity pass.
