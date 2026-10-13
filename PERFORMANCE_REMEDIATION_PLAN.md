# Performance implementation plan

Date: 12 October 2026. Status: core public-read implementation completed and locally tested; deployment qualification remains open. See [implementation and measured results](PERFORMANCE_IMPLEMENTATION_RESULTS.md) for current status. This document preserves the original design and pre-implementation findings below; it supersedes earlier capacity assumptions and the earlier exclusion of Redis in `IMPLEMENTATION_PLAN_10000_RPS.md`.

## 1. Target and available resources

Target: 10,000 active users, each starting one API request per second: **10,000 RPS**. Retain one Node API process. Plan around approximately 2 CPU cores and 2 GB RAM available from the user's shared Hostinger allocation; these are budgeting assumptions, not dedicated reservations. MongoDB Atlas M10 is a future deployment choice. Redis must be a separate service with its own memory budget and low network latency to the API; Atlas is not a Redis service.

The target is unproven. A single Node main thread can remain the limit even with two CPU cores available. At 10,000 RPS, a 70% main-thread CPU budget leaves approximately 70 microseconds per request. Cache hits, HTTP middleware, encoding and logging must all fit the measured CPU budget. Redis cannot guarantee this target on the shared host.

Qualify public browsing and the complete application separately. A home-page cache benchmark cannot establish login, upload, messaging or write capacity. The full route inventory is in `PRODUCTION_READINESS_PLAN.md`; use current source and `PERFORMANCE_FIXES.md` to distinguish completed work from historical findings.

## 2. What the measurements actually establish

- The latest five-second home overload verification completed 1,746 responses: 1,247 HTTP 200 and 499 HTTP 503. The database connection pool timed out under load. Changing 400 to 503 corrected error classification; it did not increase capacity.
- That run used 1,000 generator connections and prepared 2,746 requests. It did not deliver the intended 50,000 requests or simulate 10,000 simultaneously connected users. Autocannon's raw `requests.sent` accounting was inflated in that configuration and must not be used as delivered traffic.
- Earlier per-route autocannon runs placed the generator in the API process. Their shared event loop contaminates the API CPU/latency comparison; rerun them with a separate generator before ranking endpoint capacity precisely. Location search remains a justified investigation because it uses text search plus sorting and substantial database work.
- Search currently caches candidate IDs for 15 seconds, but every hit still performs an aggregation with a live owner join. Cold searches also enumerate unavailable owners. Therefore a 99% candidate-cache hit rate would still generate approximately one aggregation per HTTP request.
- Cards already use a smaller projection and cursor pagination. Existing `Map` caches and request coalescing are useful foundations; they are not full response caches.

Evidence: `LOCAL_10000_USERS_1RPS_REPORT.md`, `PERFORMANCE_FIXES.md`, and the raw results in `server/load/`.

## 3. Decisions on the suggested techniques

| Suggestion | Decision | How it addresses this application |
| --- | --- | --- |
| JSON compression | Implement and benchmark | Reduce response bytes after reducing fields; cache serialized/compressed public responses so repeated hits do not repeat the work. |
| Redis | Implement for public read responses | Remove MongoDB work from valid warm-cache hits, with explicit visibility invalidation and bounded fallback. |
| Ten database pools | Do not create ten independent clients | Reuse the existing Mongo client. Benchmark 10, 25, 50 and 100 connections within its pool. More clients multiply connection load. |
| B+ tree | Use MongoDB's built-in ordered indexes | MongoDB manages its B-tree indexes. Design compound/partial indexes for the actual filters and ordering; no custom tree in application code. |
| Hash map | Retain and improve | Use bounded `Map` caches for local response buffers and in-flight work; use Redis keys for the larger cache. Do not replace Mongo range/sort indexes with hashed indexes. |
| Bloom filter | Defer unless exact-ID misses justify it | Optional rejection of definitely absent property IDs. It cannot evaluate price ranges, free text, sorting or permission checks. An exact bounded negative cache is simpler initially. |

MongoDB documents client reuse and its built-in index structure: [MongoClient reuse](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/), [MongoDB indexes](https://www.mongodb.com/docs/manual/indexes/).

## 4. Implement in this order

### P0 — trustworthy measurement and overload controls

Files: `server/load/profile-local.cjs`, `server/load/users-10000-autocannon.cjs`, `server/src/middleware/runtime.middleware.ts`, `server/src/index.ts`.

1. Move every load generator to a separate process locally and a separate host for final qualification. Record actual duration, generator, API/DB versions, pool settings and worker activity; remove stale k6 labels and default durations from autocannon metadata.
2. Count requests at server ingress and completion, with status and route labels. Reconcile generator starts, connection failures, cancellations, queued work and server counts. Treat request preparation as a different event from sending. Save unique result directories per run.
3. Measure pool checkout wait and failures, in-use connections, query duration, cache hits by layer, cache-fill concurrency, response bytes, compression CPU, event-loop delay, RSS and CPU throttling. Aggregate metrics; never label metrics with user IDs, raw search text or arbitrary URLs.
4. Add a bounded admission queue around public search cache fills and expensive queries. Start experiments with 16 concurrent public fills and 32 queued fills with a 100 ms queue deadline. Keep protected reads/writes and background jobs in separately limited work classes sharing the same client. These are starting values to benchmark.
5. Return 503 with `Retry-After` when capacity is exhausted. Add cancellation/deadlines so disconnected clients do not leave unlimited work. Rejections count as failures against the 10,000-RPS target.

Acceptance: counters reconcile; a burst cannot grow queues or memory without limit; one overloaded public endpoint leaves capacity for valid account and write operations. Existing security/workflow tests continue to pass.

### P1 — smaller JSON and compression

Files: `server/src/app.ts`, `server/src/routes/property.routes.ts`, `server/src/services/propertySearch.ts`, `app/src/types/property.types.ts`, `app/src/services/propertyService.ts`, the home and marketplace screens.

1. Define a public card DTO: ID, title, type, display location, price, area, badges, thumbnail and fields actually used by the preview. Inspect the preview before removing fields. Move large geometry, full media arrays, descriptions and review/history data to detail/workspace responses where appropriate. Maintain current field contracts or change the app and API together.
2. Compare 20/30-card initial pages against the current 50-card page. Preserve cursor traversal; select the page size from UX and total browsing-request measurements. Smaller pages can increase request count.
3. Add standard HTTP compression for eligible public JSON above 1 KB. Start gzip at level 1; compare levels 1 and 4 and Brotli at modest quality. Negotiate `Accept-Encoding`, include `Vary: Accept-Encoding`, retain an identity representation and exclude already compressed files and sensitive token responses. Higher compression spends more CPU. [Express compression options](https://expressjs.com/en/resources/middleware/compression/)
4. Serialize a public cache entry once and generate compressed variants asynchronously on cache fill. Bound compression concurrency and account for all variants in cache memory. Do not gzip/stringify the same hot payload on every request. Use either proxy compression or API compression for a response, avoiding duplicate work.
5. Preserve `X-Next-Cursor` and content type across identity/gzip/Brotli responses. Verify browser and React Native decoding. Optional ETags must include representation/catalogue version and cannot bypass visibility checks.

Acceptance: decoded data and paging match the current contract; record actual bytes, ratio, CPU and p95. Adopt compression only when the combined bandwidth/CPU result helps the target allocation. A 50% byte reduction is an experiment goal, not a promised result. No custom binary JSON format is required.

### P2 — Redis response caching and bounded local hash maps

Proposed files: `server/src/services/redis.ts`, `publicResponseCache.ts`, `publicCacheGeneration.ts`; update `searchMemory.ts`, `propertySearch.ts`, property routes and all public-visibility mutation paths.

Read path:

```text
Validate/canonicalize public query
  -> current visibility generation and mutation barrier
  -> L1 bounded Map of serialized public responses
  -> Redis response cache
  -> one coalesced, admitted Mongo query on a miss
  -> allowlisted DTO + next cursor -> serialize/compress -> cache -> reply
```

Initial tuning values, subject to measurement:

| Layer | Starting policy |
| --- | --- |
| L1 inside API | 32 MiB byte cap across buffers/metadata; 2-second TTL; LRU eviction; never unlimited |
| Redis public response cache | Separate 256 MiB starting cache allocation; TTL 15 seconds with jitter; memory/eviction alerts |
| Empty-result cache | At most 2 seconds, versioned with publication changes; no cached operational errors |
| In-flight map | One promise per canonical key for the complete query and serialization; bounded distinct keys and waiter count |
| Redis connection | Reused client, TLS/credentials, bounded command deadline and reconnect backoff; avoid unlimited offline command queues |

Redis service memory includes overhead and provider constraints; measure the actual dataset before selecting a paid size. Configure a cache-only eviction policy such as `allkeys-lfu`; keep durable jobs, sessions or revocation records out of an evictable response-cache namespace/service. [Redis eviction policies](https://redis.io/docs/latest/develop/reference/eviction/)

Key example: `public:v3:<deployment>:<boot>:<generation>:search:<hash>`. The hash includes canonical type, location mode/value, budget, cursor, limit and response view. Version compressed variants explicitly. Exclude tokens and user data; public-cache code can only accept allowlisted public DTOs. Protected workspace/profile/document responses cannot use this cache.

On cache fill, cache the final page and cursor, not just IDs. A valid L1 or Redis hit should perform **zero MongoDB commands**. Coalesce through serialization/compression, not only candidate selection. An expired/missing Redis key is a bounded cache miss, not a reason to issue unlimited Mongo queries. Start with the local in-flight map for the one-process deployment; a distributed fill lock is only necessary if a separate process also fills these keys.

At 10,000 public RPS and 99% full-response hits, 100 requests/s reach the miss path before coalescing. That is illustrative arithmetic; hit rate, query diversity, writes and invalidation frequency must be measured. It does not imply a 99% hit rate for the complete application.

### P3 — make response caching safe for visibility changes

This is a prerequisite to enabling P2 in production. Current hits recheck owners live; removing that query without replacement could show a suspended owner's listing.

1. Centralize all publication, unpublication, owner suspension/reactivation, account deletion, public-field edits and photo changes. Cover `transition`, admin status routes, photo updates, submission processing, imports and scripts. Use desired-state mutations and version checks so a retry cannot undo a suspension.
2. For the single API process, implement a public-write barrier and generation counter. Before a visibility mutation, raise the barrier, advance the generation and discard local snapshots. Reads during the barrier wait briefly or receive a controlled 503. Fill operations capture a generation and cannot install or serve results after that generation changes.
3. After the Mongo write completes, advance the generation again and release the barrier. Old Redis keys are unreachable because the generation is part of every key; TTL removes them later. A failed/ambiguous write also advances the generation and forces fresh reads. Concurrent mutations use a counter/serialization scheme so one cannot prematurely release another's barrier.
4. Use a unique boot namespace, so a crash after a DB commit cannot cause the restarted process to trust pre-crash Redis snapshots. This deliberately requires cache warmup on restart. Do not use Redis Pub/Sub alone as the correctness mechanism.
5. All visibility writers must participate. Offline migrations require maintenance mode and namespace rotation. If writers outside this process are needed later, introduce a durable mutation/outbox protocol and verified invalidation before enabling shared response reuse; an asynchronous change stream alone cannot promise immediate revocation.
6. If Redis fails, open a circuit breaker and use bounded live reads with current visibility checks, or 503 when that capacity is exhausted. Do not serve an unverifiable stale snapshot after a visibility change. Old keys must stay unreachable on Redis recovery.
7. Initially retain `Cache-Control: no-store` for client/proxy HTTP caching of these responses while using application-controlled caches. Client in-memory cards already have a freshness window; invalidate them after relevant local mutations and revalidate on return. Do not claim immediate removal from an offline user's screen. CDN caching is a later option only with a defined purge/revocation contract.

Acceptance tests must interleave a cache fill with suspend/unpublish, simulate a DB commit followed by process failure, reconnect Redis with old entries, and test two concurrent mutations. Requests started after a successful suspension acknowledgement must never return that owner's listing. Test DTO privacy and page completeness as well as speed.

### P4 — query/index changes and database pool tuning

Files: `server/src/services/marketplace.ts`, `propertySearch.ts`, `server/src/models/Property.model.ts`, `server/src/scripts/createIndexes.ts`, `server/src/index.ts`, home/marketplace filters.

**Search:** use normalized exact state/district identifiers for location selections. Keep free-text input on a clearly separate path; never silently convert arbitrary text to district equality. Compare the existing `$text` path with Atlas Search when that deployment is available, preserving language and matching semantics. Text indexes do not supply sort order, so adding an ordinary index alone will not remove that path's sort cost. [Text-index restrictions](https://www.mongodb.com/docs/v8.0/core/indexes/index-types/index-text/text-index-restrictions/)

On a cold fill, replace the unbounded unavailable-owner `$nin` list with bounded candidate batches and indexed owner lookups. Continue until the requested page plus one eligible item is found, with a total work limit/deadline and a cursor based on the last scanned candidate. Test long runs of suspended owners to prevent skipping eligible results. Cache the completed public result after the visibility barrier checks.

**Indexes:** inventory existing indexes first. Test partial indexes whose predicate is the full publication filter, with candidate keys `{createdAt:-1,_id:-1}`, `{type:1,createdAt:-1,_id:-1}`, and `{stateKey:1,districtKey:1,createdAt:-1,_id:-1}`. Reuse current indexes when equivalent. For budget queries compare sort-before-range versus range-before-sort with realistic selectivity; a price-range index does not automatically satisfy newest-first ordering. Use `explain('executionStats')`, examined/returned ratios and sort spill evidence to select indexes. Additive migrations only; remove redundant indexes later after usage evidence and review. [Index strategy and ESR](https://www.mongodb.com/docs/v8.0/applications/indexes/)

**Pools:** keep one Mongoose/MongoClient instance; the driver manages pools per Mongo server. Do not create ten independent API clients. Test `maxPoolSize` 10, 25, 50 and 100 after caching is effective, and choose the smallest size that meets latency and throughput with spare capacity. Start at the existing 50 maximum, `minPoolSize` 0–5, `maxConnecting` 2 and bounded checkout waits. These values need deployment testing. Include background workers and other apps in the total connection budget. A ten-connection pool may be sufficient after offloading reads, but reducing to ten before that would likely increase waits. [Driver pool options](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/)

Use `in-use connections ≈ DB operations/second × mean time holding a connection` as a diagnostic, not a sizing guarantee. Increase the pool only when checkout wait is high and the database has spare CPU/I/O capacity. The documented M10 example has 1,500 connections per node and M10 has new-connection rate limits; these are limits, not database throughput promises. Verify the selected provider/tier and avoid connection churn. [Atlas limits](https://www.mongodb.com/docs/atlas/reference/atlas-limits/)

Acceptance: no full-collection scan on common exact-location/type/default page paths; explain results show bounded work on representative distributions; pool wait stays within the request SLO; invalidation correctness remains intact.

### P5 — Bloom filter only if the data supports it

First measure how much DB time is spent on syntactically valid but nonexistent property IDs. Reject malformed IDs before I/O and try a small, short-lived negative-result cache first. With only 10,000 fixture records, an exact ID set may be simpler than a probabilistic structure.

If absent-ID traffic consumes at least 10% of read DB time and a benchmark shows a net benefit, evaluate a Redis Bloom filter of **all existing property IDs**. A positive result still requires normal cache/database lookup and visibility checks. A negative result may skip DB work only when the filter is initialized and its insert coverage is known to be current. New IDs must be inserted before their creation is acknowledged or made visible; failed filter updates disable the negative shortcut. Rebuild with a versioned key and account for concurrent inserts. Standard Bloom filters cannot safely delete individual elements; periodic rebuilds handle deleted records.

Missing, evicted, stale or rebuilding filters must fall back to normal lookup. Never use the filter for authorization or to declare a fuzzy/text/range search empty. Verify provider support before adopting Redis Bloom commands. [Bloom filter behavior](https://redis.io/docs/latest/data-types/probabilistic/bloom-filter/)

Acceptance: zero valid IDs rejected during inserts, rebuilds, failures and restarts; measured DB savings exceed Redis and maintenance overhead. Otherwise leave this feature disabled.

## 5. Apply the right policy to the remaining endpoints

| Endpoint group | Planned treatment |
| --- | --- |
| Public search/detail | P1–P5; primary optimization target |
| Profile, `/auth/me`, account edits | Retain live authorization and request-scoped user reuse; small DTOs; never share public snapshots |
| Mine, wishlist, workspace, reviewer/admin lists | Existing pagination/projections; verify indexes; optional actor/version-scoped data cache after live authorization; bounded histories |
| Inquiries/messages | Preserve atomic writes and access checks; replace repeated polling with bounded incremental reads; migrate embedded messages to indexed pages if growth requires it |
| Dashboard summaries/workloads | Coalesced short snapshots; eventual materialized nonfinancial counters only when aggregation cost warrants them |
| Login/register/refresh/logout | Retain bounded password workers, rate limits and atomic session rotation; never cache passwords/tokens as public data; test separately from browsing |
| Drafts/reviews/offers/status writes | Conditional versions, desired-state updates, actor-scoped idempotency and cache invalidation after successful mutations |
| Photos/documents | Thumbnail/object-storage delivery for public media; separate upload limits; private documents require authorization on every access; no shared public cache |
| Submission jobs, migrations, health | Keep DB/CPU budgets; index and deadline jobs; dependency-free liveness and meaningful readiness; include jobs in mixed-load qualification |

Redis does not replace MongoDB as the source of truth. Writes, sensitive access and account revocation retain authoritative checks.

## 6. Qualification and rollout

Implement P0, then P1, develop P2/P3 together, then P4. P5 is conditional. Complete each correctness gate before treating its performance results as releasable.

1. Capture comparable baselines with separate generator processes, realistic property/owner distributions and valid success assertions. Include repeated popular queries, high-cardinality misses, exact and free-text location, paging, visibility mutations, login and write traffic. Vary identities correctly; a rotating header is not a simulation of authenticated sessions.
2. Compare compression off/on, L1 off/on, Redis off/on, cold starts, warm reads and pool sizes. Report successful RPS separately from all responses. Do not equate zero network errors with zero HTTP failures.
3. Ramp 100, 250, 500, 1,000, 2,000, 5,000 and 10,000 offered RPS, stopping when sustained resource/error gates fail. Use at least five minutes per qualifying stage, then a 30-minute soak at the passing rate. Short five-second bursts only diagnose overload.
4. For the exact user model, run a sufficiently provisioned external generator with 10,000 logical users paced at one request/s and staggered starts. Record missed deadlines when responses take over one second; do not silently reduce traffic by waiting for responses before scheduling the next arrival. Also test synchronized bursts separately. Do not require one TCP connection per user unless validating that connection model specifically.
5. Proposed acceptance gates: at least 99.9% successful valid requests; public-read p95 ≤200 ms and p99 ≤500 ms; general reads p95 ≤500 ms; ordinary writes p95 ≤1 s; no scheduled-arrival drops, pool timeouts, growing queue or sustained memory growth. Keep at least 30% observed CPU/memory headroom within the available quota. Set the production capacity from the last passing sustained workload, not an extrapolation.
6. Exercise Redis failure/restart, Mongo slowdown, mass invalidation, query diversity spikes and visibility changes during fills. A failing cache may reduce capacity but must not expose private data or overwhelm MongoDB.
7. Enable response caching, compressed variants and query changes independently with feature flags. On regression, disable the affected feature and retain admission limits; falling back to unlimited live database work is not a safe rollback. Confirm restart/rollback behavior before the deployed test.

No 10,000-RPS claim until the actual Hostinger allocation plus Atlas/Redis passes these gates. If fully cached responses still exhaust the single API's CPU/network budget, document that ceiling. Further progress may require a larger allocation, edge response delivery with a valid revocation policy, or additional API capacity; those are deployment decisions, not benefits implied by adding data structures.
