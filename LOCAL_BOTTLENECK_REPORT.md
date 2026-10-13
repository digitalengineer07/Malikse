# Local API bottleneck report — 12 October 2026

## Conclusion

The highest tested passing mixed browsing rate was **150 requests/second**, with **16.07 ms p95**, no HTTP errors, and no dropped iterations over 20 seconds. This is a short local baseline, not certified sustained capacity. At a requested 250/s the test dropped scheduled work; at 500–1,000/s completed traffic plateaued around 300–309/s. **10,000 users each sending one request/second is not supported by these results.**

The most urgent bottleneck is unbounded list responses. The admin property list failed badly at only 2 requests/second with 10,000 listings. Ordinary browsing results cannot be used to size the whole application.

## Environment and method

- One Node 22.14.0 API process; local MongoDB 7.0.14; k6 on the same Windows PC.
- Ryzen 5 5600H, 12 logical CPUs, 7.36 GiB total RAM. Other desktop applications remained open.
- Unique disposable database: 1,000 user accounts plus admin; 10,000 verified properties owned by 200 accounts; 300 inquiries with 30 messages each. These are synthetic records, not real customer data.
- Actual compiled application, authentication and default rate limits; Mongo pool 50. Development runtime with request logs off. Submission worker disabled.
- Each k6 stage schedules arrivals for 20 seconds, with 30 preallocated and at most 80 virtual users, 10-second request timeout and 15-second graceful stop. Thresholds: p95 <500 ms, HTTP errors <1%, all content checks pass, zero dropped iterations.
- Mixed workload: 50% public search (50 results), 20% property details, 15% profile, 10% own listings, 5% admin dashboard. Search cache expires during the run. Accounts and properties rotate.
- Recorded Node process CPU, RSS, event-loop delay/utilization and successful Mongo command counts/durations. CPU percentage uses one core as 100%; background runtime threads can take it above 100%. This is not whole-PC CPU utilization.
- Follow-up used a fresh API process/database and tested 100/s and 150/s, password hashing and plain-object versus hydrated-document loading.
- Both disposable databases and temporary token files were removed. No production endpoint or Atlas database was targeted.

## k6 results

| Workload | Requested RPS | Completed HTTP requests | Observed RPS* | p95 | HTTP failure rate | Dropped iterations | Result |
|---|---:|---:|---:|---:|---:|---:|---|
| Mixed | 50 | 1,000 | 49.97 | 11.01 ms | 0% | 0 | Pass |
| Mixed, fresh follow-up | 100 | 2,001 | 100.02 | 10.90 ms | 0% | 0 | Pass |
| Mixed, fresh follow-up | 150 | 3,001 | 149.96 | 16.07 ms | 0% | 0 | Pass |
| Mixed | 250 | 4,931 | 246.46 | 332.93 ms | 0% | 70 | Fail: dropped work |
| Mixed | 500 | 6,060 | 300.04 | 368.63 ms | 0% | 3,941 | Fail: dropped work |
| Mixed | 1,000 | 6,247 | 309.17 | 356.89 ms | 0% | 13,754 | Fail: dropped work |
| Distinct uncached price searches | 250 | 4,440 | 219.26 | 426.74 ms | 0% | 561 | Fail: dropped work |
| Admin property list | 2 | 41 | 1.37 | ~10 seconds | 85.37% | 0 | Fail: timeouts |
| Large inbox, after admin overload | 10 | 144 | 4.88 | ~10 seconds | 100% | 56 | Fail; recovery-contaminated |

*Observed RPS is k6's rate across the run including completion time. Completed HTTP requests include failures. The 80-VU ceiling constrains offered load under increasing latency; dropped iterations are requests never sent, not successful requests. These runs do not establish an exact server maximum. The inbox stage followed the admin stage without a recovery barrier, so its failure rate cannot be presented as isolated inbox capacity. A fresh single inbox request still measured 247 ms and 2.79 MB.

## Measured bottlenecks and fixes

### 1. Critical: unbounded admin property list

`server/src/routes/admin.routes.ts`, GET `/admin/properties`.

- One request returned **11,670,391 bytes**, took **1.61 seconds**, and required 4 find commands plus 11 cursor getMore commands.
- At 2/s: 35 of 41 requests failed; API RSS peaked at **1,465 MiB**. Event-loop p95 was **2,118 ms**, maximum **3,299 ms**.
- A separate three-repeat comparison loaded identical 10,000-property results with and without Mongoose hydration. Median read time: **1,021 ms hydrated vs 361 ms lean**. Median JSON serialization: **344 ms vs 95 ms**. Both serialized to the same byte count; this supports hydration/serialization as significant contributors, not a complete CPU flamegraph attribution.

**Fix first:** cursor pagination, default 25–50 and hard maximum 100; explicit list-field projection; `.lean()` for read-only results; fetch full details on demand. Update frontend list consumers with the new pagination contract. Do not use compression as a substitute for bounding results. Apply the same pattern to admin users, own listings and staff task lists.

### 2. High: conversation lists include every message

`server/src/routes/inquiry.routes.ts`, GET `/inquiries/received` and `/inquiries/sent`.

- 300 conversations × 30 messages produced **2,788,991 bytes** and 247–262 ms for a single request.
- The overload sequence reached **1,881 MiB API RSS** and a **6.07-second maximum event-loop delay** during the inbox stage. Admin backlog and memory pressure confound its isolated throughput.

**Fix:** paginate conversation summaries; return last message, unread state and participants only. Move message history to a separate paginated endpoint. Avoid returning the entire conversation after each new message. Use bounded projections and lean reads.

### 3. High: public search cache still performs database work on every hit

`server/src/services/propertySearch.ts` and `server/src/services/marketplace.ts`.

- Measured warm search: **3 find commands**; cold search: **4 finds + 1 update**. A hit checks unavailable owners, reads cached IDs, then fetches visible property data.
- Distinct price searches at 250/s completed ~219/s and dropped 561 iterations.
- Mixed load at 250/s consumed **94.9% of one CPU core**. At 500/s, event-loop p95 reached **108 ms** and successful Mongo command p95 **103 ms**. Client-observed Mongo command time includes Node scheduling delays; it is not pure database engine time.

**Fix:** smaller card DTOs and bounded result counts; coalesce duplicate refreshes; design a public-response cache with reliable invalidation for suspension, verification and edits. Cache public data only. A MongoDB ID cache is not an independent memory cache. Preserve immediate visibility and authorization semantics when optimizing; do not simply omit the owner checks. Existing global cache deletion on published-property transitions is a source-level invalidation-storm risk, not measured in these read tests.

### 4. High: deep pagination and broad text searches do disproportionate work

- First-page indexed query: **50 keys / 50 documents examined** for 50 results.
- Deep-page representative query: **10,000 keys examined** for 100 returned records; 106 ms in explain. Actual HTTP page-100 probes took **248–291 ms**. The explain query intentionally isolates status/sort/skip and is simpler than the full visibility query.
- Broad `Patna` text query: **10,000 keys / 20,000 document examinations** for 50 results, followed by a sort. All fixture properties are in Patna, deliberately modeling a broad city search; examinations can count repeat document visits.

**Fix:** use `(createdAt, _id)` cursors instead of deep `skip`; use normalized location IDs and matching compound indexes for city/district filters; reserve free text for actual text search. Compare exact query plans before adding indexes. The existing newest-list index already works for first-page reads.

### 5. High: password hashing stalls the event loop

`server/src/routes/auth.routes.ts` uses `bcryptjs`.

- Fresh follow-up: **10 simultaneous successful logins completed in 718 ms**, with **592 ms maximum/p95 event-loop delay** and 10 database reads plus 10 updates.
- Default login limiter stayed enabled; only ten logins were sent. This was a finite concurrency probe, not sustained login capacity.

**Fix:** benchmark compatible native bcrypt or a bounded worker-thread hashing pool; retain cost/security settings and rate limits. Bound the queue and reject overload predictably. Preserve existing password-hash compatibility. Do not reduce password cost to improve benchmark numbers.

### 6. Medium: dashboard recalculates whole-collection totals

GET `/admin/dashboard/summary`: authentication find plus 3 aggregate commands per request. Property aggregation examined all **10,000 documents**. A single response took ~16 ms locally, so it is not currently the worst route, but work grows with stored data and poll rate.

**Fix:** cache aggregate snapshots with a documented freshness window, or maintain counters with reconciliation. Test writes and concurrency before relying on counters.

### 7. Medium: duplicated user reads and multi-query write paths

- Profile: 2 finds (auth middleware and handler).
- Successful inquiry/offer creation: 4 finds + 1 insert each.
- Wishlist toggle: 4 finds + 1 update; read: 4 finds.
- Follow-up write probes succeeded: inquiry/offer HTTP 201; wishlist/profile HTTP 200. These are single-request diagnostics, not write throughput results.

**Fix:** share a minimal verified account context within a request where practical; retain live suspension checks. Avoid unneeded populates and full documents. Benchmark realistic read/write contention before assigning write capacity.

## Home navigation delay

The earlier app change already renders cached results while refreshing. Source review confirms `VerifiedHomeScreen.tsx` still requests a refresh each focus; `propertyService.ts` uses a bounded Map without a freshness policy or in-flight request coalescing. Server responses currently use `Cache-Control: no-store`.

Next improvement: define a freshness window, reuse an in-flight request for identical filters, retain visible results during refresh, cancel stale requests, and invalidate after relevant mutations. The local API tests did **not** reproduce the mobile navigation/render path, so they do not establish the cause of every reported spinner.

## Source-reviewed risks not load-validated here

- Submission worker processes at most 10 jobs per one-second polling tick, sequentially; actual capacity depends on job time. Worker was disabled in this test.
- Upload buffers, GridFS streaming, local document-file delivery, verification transitions, global cache invalidation under concurrent writes, large wishlists and staff history queries require dedicated fixtures/tests.
- Axios refresh has no general timeout; refresh failure handling and duplicate retries can amplify transient outages. Client networking was not exercised by k6.
- Production logging/TLS/proxy overhead, Hostinger allocations and Atlas network/pool/tier limits were not measured.

The complete route inventory is in `PRODUCTION_READINESS_PLAN.md`. This run load-tested seven distinct GET routes (including search variants), probed additional reads and five write operations, and tested login concurrency. It does **not** claim successful capacity testing of all 49 routes. Earlier unauthenticated route smoke results are not business-handler capacity evidence.

## Implementation order and acceptance criteria

1. **Bound admin/list and inbox payloads.** Cursor pagination, summary DTOs, lean reads; preserve role checks. Repeat current fixtures and require no timeout/drop and p95 <500 ms at the previously failing offered rates. Validate old/new client contract compatibility.
2. **Reduce public search cost.** Card DTO, cursor pagination, location queries, safe caching/invalidation, and frontend refresh deduplication. Test cold/warm cases and visibility changes. Require no stale private/suspended listings.
3. **Remove hashing stalls.** Bounded off-thread/native hashing with unchanged security behavior; verify concurrent health/read latency during login load.
4. **Bound background work and dashboard calculations.** Queue backlog/age, request timeouts/cancellation, short-lived summaries and per-route metrics. Verify recovery after overload, not only successful steady traffic.
5. **Repeat identical local benchmarks, then realistic write/media/worker scenarios and a soak test.** Use an external load generator and actual single-deployment hardware/Atlas tier before claiming deployment capacity. Increase offered load only while zero drops, acceptable errors/latency and resource headroom hold.

## Reproduction and evidence

- `server/load/profile-local.cjs`: local-only seeding, instrumentation, k6 orchestration and cleanup.
- `server/load/local-profile.js`: authenticated populated-response arrival-rate scenarios.
- `server/load/local-results/`: first run, per-stage k6 JSON, process telemetry and query plans in `profile.json`.
- `server/load/local-followup/`: fresh-process lower-rate tests, hashing results, hydration comparison and successful write probes.
- Instructions: `server/load/README.md`.

No application performance fixes were applied during this measurement pass. `npm run build` passed before running the tests. Application edits that existed before this pass remain in place.
