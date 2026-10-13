# Performance implementation and local results

Updated 12 October 2026. The public-read implementation is complete and locally tested. **10,000 requests/second is not achieved or certified.** This report supersedes earlier measurements where noted. The broader production release gates in `PERFORMANCE_REMEDIATION_PLAN.md` remain applicable.

Follow-up requested by the user: [two-worker PM2 experiment](LOCAL_PM2_CLUSTER_REPORT.md), approximately 6,147 RPS for the cached snapshot and 5,101 RPS with caching disabled. Neither met 10,000 RPS; the cached cluster remains a read-only test because invalidation is process-local.

## Changes implemented

- Home navigation reuses bounded client search results and refreshes without replacing cached cards with a spinner. Filter and cursor keys remain separate; mutations and session changes invalidate the client cache. Client results are fresh for 15 seconds and may display for up to another 60 seconds during refresh; already displayed cards are not remotely revoked. Server detail/read checks enforce current visibility independently.
- Search and public property details now cache the complete serialized response, cursor and HTTP status. Warm hits perform **zero MongoDB reads**. A bounded Map holds up to 512 entries / approximately 32 MiB; individual cached entries are limited to 512 KiB.
- Gzip level 1 and Brotli quality 4 are computed once per fill, selected using `Accept-Encoding`, and served as buffers. `Vary: Accept-Encoding` is set. HTTP responses remain `no-store` because public visibility must be rechecked through the application cache policy.
- Optional Redis response storage has deadlines, an error circuit, no offline command queue, and a working local-cache fallback. No Redis service is required to start the app.
- Concurrent identical misses share a fill. Pending keys, waiters, active database fills and queued fills are bounded; overload returns 503 instead of growing an unlimited queue.
- Model write hooks invalidate cache generations before and after property and account-visibility writes. Responses racing these writes fail closed. Suspended owners, unpublished properties and stale negative results are covered by regression tests.
- Search checks owners in bounded batches instead of enumerating every disabled account. Cursor paging preserves visible results across hidden-owner batches. Exact district/state filters are supported alongside existing free-text search.
- Additive compound/partial Mongo indexes cover published newest/type/location access. MongoDB manages the ordered indexes; no custom B+ tree is introduced.
- One shared Mongo client has configurable pool bounds and checkout deadlines. Pool sizes 10, 25, 50 and 100 were compared. Default remains 50 pending deployment measurements; use `MONGO_MAX_POOL_SIZE=10` for a ten-connection maximum. Ten independent clients/pools are unnecessary.
- Admin suspension/staff clients send the desired boolean state so retrying a request does not reverse it. Staff assignment cleanup can be retried after partial failure.
- Protected `/admin/performance` exposes aggregate HTTP, cache, admission and pool counters. Load generators run in separate processes, record server counters, and write unique timestamped result folders.

Bloom filters were deferred: they do not accelerate general location/price search, and this workload does not establish a benefit for nonexistent-ID probes. Short negative caching is implemented instead. No speculative algorithm is presented as a capacity fix.

## Local evidence

One Node API process, local MongoDB and a separate generator process share the Ryzen 5600H PC. Fixtures contain 10,000 properties and 1,000 accounts. Submission workers and request logging were disabled. No live Redis server was used. These are local development measurements, not Hostinger or Atlas M10 results. Roughly half the supplied Hostinger allocation is **2 CPU cores / 2 GiB RAM**, shared rather than reserved.

### Sustained home-page check

30-second k6 constant-arrival-rate run, 2,000 RPS, gzip cards response:

| Measure | Result |
| --- | ---: |
| Successful client responses | 60,001 |
| Server received / completed | 60,001 / 60,001 |
| Errors / dropped iterations | 0 / 0 |
| HTTP p95 | 1.09 ms |
| Cache fills / coalesced requests | 2 / 61 |
| Mongo commands | 4 finds total |
| API CPU, one core basis | 64.7% |
| Peak sampled API RSS | 267.3 MiB |

This crosses the approximately 15-second cache lifetime and validates fill coalescing at expiry. The very low latency is loopback latency, not internet latency. This is a 30-second run, not a production soak.

Evidence: `server/load/runs/2026-10-12T15-24-42-171Z-local-profile/`.

### Individual public routes

Separate-process autocannon, 20 connections, five seconds per case, warm cache and gzip:

| Home request | Reported RPS | p99 ms |
| --- | ---: | ---: |
| Default cards | 4,261 | 9 |
| Type filter | 4,216 | 9 |
| Location filter | 4,234 | 9 |
| Price filter | 3,914 | 10 |
| Cursor next page | 3,565 | 12 |
| Public detail | 3,475 | 16 |

Every stage had zero client errors/non-2xx responses and zero Mongo commands. API CPU was around one fully occupied core; these are short saturation figures, not safe operating budgets. Earlier tests ran autocannon inside the API process, so a clean before/after speedup ratio is unavailable.

Evidence: `server/load/runs/2026-10-12T13-26-36-593Z-autocannon-home-results/`.

### Attempted 10,000 RPS

The offered target was 10,000 RPS using 1,000 generator connections and rotating synthetic user identifiers. It does not establish 10,000 independently connected users issuing exactly one request each second.

- Autocannon prepared 19,269 requests and observed 18,269 completed responses, all HTTP 200. The server received and completed 19,269. The remaining 1,000 were not observed as completed by the client before it stopped.
- Reported sample-average throughput was 3,045 RPS. Requested duration was five seconds; autocannon reported 6.21 seconds elapsed. These counters/rates use different collection boundaries and should not be treated as interchangeable.
- Zero Mongo commands, zero pool failures, API CPU 111.6% on a one-core basis, event-loop utilization 92.7%, peak sampled RSS 264.6 MiB.
- Target failed. Warm-read database pressure was removed; API CPU/event-loop work and local generator capacity now limit this experiment. Redis alone cannot establish a 10,000 RPS guarantee.

Do not use autocannon's raw `requests.sent` counter for this rate-limited experiment: its accounting was inflated. Use the prepared, client-completed and server-received/completed counters separately. Reported latency in this overload configuration includes coordinated-omission correction.

Evidence: `server/load/runs/2026-10-12T13-23-16-257Z-users-10000-results/`.

Earlier k6 **dropped iterations** were requests the generator could not start on schedule with its available virtual users. They were not database records lost or requests successfully processed by the API. They still mean the requested load target failed.

### Connection pool comparison

Each pool size ran a ten-second mixed-read workload at 400 RPS and unique uncached searches at 100 RPS. All four sizes had zero HTTP failures and zero dropped iterations.

| Maximum connections | Mixed p95 ms | Uncached search p95 ms |
| --- | ---: | ---: |
| 10 | 10.71 | 17.44 |
| 25 | 5.75 | 13.83 |
| 50 | 11.11 | 9.17 |
| 100 | 4.89 | 9.08 |

Short-run variation and local Mongo latency prevent selecting an Atlas optimum from this alone. Evidence folders are `server/load/runs/2026-10-12T13-27-33-019Z-pool-10`, `...13-28-03-297Z-pool-25`, `...13-28-32-853Z-pool-50`, and `...13-29-01-764Z-pool-100`.

## Verification completed

- Backend TypeScript build and frontend `tsc --noEmit`.
- Public-cache regression: gzip/Brotli equality, cursor headers, zero-DB warm reads, real Redis connection-refusal fallback, bounded admission, generation races, paging across hidden owners, bulk updates, suspension/reactivation, deletion, negative-cache invalidation, failed-write barrier release and desired-state admin retries.
- Redis payload roundtrip/generation tests use an injected in-memory store. **A real Redis integration test is still pending provision of that service.**
- Existing performance paging/concurrency/privacy tests, infrastructure tests, workflow suite (62 HTTP assertions), production guard tests and security suite (66 checks).
- Synthetic compression fixture: 25,981 JSON bytes reduced to approximately 800 gzip bytes / 550 Brotli bytes. Fixture repetition makes these unusually favorable; real listing ratios will vary.

All load runs used uniquely named disposable local databases, cleaned up afterward. No deployment, real-database migration or real-data load test was performed.

## Deployment configuration and remaining gates

1. Build the server and run the additive `npm run db:indexes:prod` migration against the intended deployment during a controlled rollout. Local index creation was tested; Atlas indexes have not been applied.
2. Leave `REDIS_URL` unset for the tested local Map fallback. Later configure the Redis URL privately and test live connection, expiry, outage and recovery before relying on it.
3. In production, response caching requires `PUBLIC_CACHE_SINGLE_WRITER=true`. Enable this only while **all** visibility-changing writes use the shared Mongoose models in this one API process. Keep the submission worker inside that process. External workers, raw-driver writes, database edits/imports or transaction-based writes need a coordinated invalidation design; use maintenance mode plus API restart for offline imports. Redis does not make this design safe for multiple writers. Without the flag, production response caching is disabled.
4. Keep compression enabled. Defaults are 16 active fills, 32 queued fills, 100 ms admission wait, 2 s Mongo pool wait. Tune using real traffic and the protected counters; do not remove limits to make a benchmark appear successful.
5. Repeat tests from a separate load-generator machine against the actual available Hostinger resources, network/TLS/logging configuration and Atlas tier. Include unique searches, publication/suspension writes, login, messaging, uploads and worker activity. Run longer steady tests and soak tests with CPU/memory headroom.

The remaining target gap requires measurements on the actual host. A single-process cached-public-read result cannot qualify every endpoint or guarantee 10,000 RPS. Until those gates pass, use the measured 2,000 RPS local public-read check as evidence for this narrow workload only, not a production capacity promise.
