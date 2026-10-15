# Single instance load test

## Search response size and compression

`GET /properties/search` defaults to the compact `cards` view (one photo, no description,
parcel geometry, videos or disclosures). It still returns an array, defaults to 100 results,
and exposes the next page in `X-Next-Cursor`. Use `limit=20` for a smaller page, pass the
returned `cursor` to continue, and request `/properties/:id` for details. Clients that need
the previous full search payload can explicitly use `view=full`.

Gzip and Brotli JSON buffers are generated once per cache fill and reused on cache hits.
Compression is enabled unless `PUBLIC_JSON_COMPRESSION=false`. Clients must advertise
`Accept-Encoding`; a plain Autocannon run tests uncompressed JSON. Browsers negotiate
and decompress automatically. Run this from `server/` to test compressed responses:

```powershell
npx autocannon -c 10 -d 10 --renderStatusCodes -H "Accept-Encoding=gzip" http://localhost:5000/properties/search
```

Use `Accept-Encoding=br` for Brotli or `Accept-Encoding=identity` for the uncompressed
comparison. Keep the URL, result count and connection count identical when comparing
throughput; repeat with `view=full` to compare the old response shape.

Local comparison on 15 October 2026, using the running API at port 5000, the same
100 listings, 10 connections, and sequential 10-second runs after warming each URL:

| Response | Body bytes | Requests/sec | p99 latency |
| --- | ---: | ---: | ---: |
| Full view, identity | 128,203 | 2,146.81 | 9 ms |
| Default cards, identity | 64,679 | 4,281.80 | 5 ms |
| Default cards, gzip | 3,960 | 5,347.20 | 4 ms |

All three runs returned only HTTP 200, with zero errors or timeouts. Brotli body size
was 3,446 bytes in a separate response probe. Body sizes exclude HTTP headers.
These are short local warm-cache measurements, not sustained production capacity.

Follow-up after a reported run with zero successful responses: the remote-MongoDB
cold path fetched 100 rows, then fetched another batch just to determine whether a
next page existed. Search now fetches up to 101 rows per batch and deduplicates owner
IDs, reducing a normal 100-result page from four database reads to two. A fresh
service read measured 474 ms with 100 results and the same 3,960-byte gzip body.

The final 45-second HTTP run at 10 connections, without explicit warmup, crossed
multiple cache expirations: 271,841 HTTP 200 responses, 6,041.47 requests/sec,
1.30 ms average latency, 6 ms p99, 524 ms maximum, zero errors/timeouts/non-2xx.
The original failing status was not captured in the supplied output and could not
be reproduced. Keep `--renderStatusCodes` enabled when diagnosing a recurrence;
zero 2xx responses indicate an error run, not successful search throughput.

## Current cache implementation (12 October 2026)

See [implementation results](../../PERFORMANCE_IMPLEMENTATION_RESULTS.md). Current `profile-local.cjs` runs write unique `load/runs/<timestamp>-<mode>/` directories; older fixed-folder instructions below describe historical runs. Test sources are versionable; generated results remain ignored.

From `server/`, with local MongoDB and k6 installed:

```powershell
npm run test:public-cache
npm run test:performance
npm run load:home
npm run load:users-10k
npm run load:pool-matrix
npm run load:pm2
npm run load:pm2-max
```

`load:users-10k` is a bounded five-second offered-load attempt, not proof of 10,000 independent users. It exits nonzero when the target is not met. Pool tests exit nonzero on failed thresholds. Autocannon and k6 execute in separate processes from the API.

Reproduce the 30-second cache-expiry check:

```powershell
$env:PROFILE_HOME_STEADY='1'
$env:DURATION='30s'
$env:PREALLOCATED_VUS='80'
$env:LOAD_ENCODING='gzip'
try { node load/profile-local.cjs } finally {
  Remove-Item Env:PROFILE_HOME_STEADY, Env:DURATION, Env:PREALLOCATED_VUS, Env:LOAD_ENCODING
}
```

Use a fresh shell or clear other `PROFILE_*` flags before selecting a workload. Run functional checks separately from performance tests. These harnesses create disposable loopback databases and remove them; generated fixture tokens must never be committed. The Redis fallback test uses a refused loopback connection and an injected store for payload tests, not a real Redis service.

`load:pm2` runs two workers in an isolated PM2 daemon, comparing a read-only cached snapshot with cache-disabled hot reads at an offered 10,000 RPS. It stops its workers after testing. See [PM2 results and cluster limitations](../../LOCAL_PM2_CLUSTER_REPORT.md). This benchmark does not enable production cross-process cache invalidation.

`load:pm2-max` sweeps cached snapshot worker counts 2, 3, 4, 6, 8, 10, 12 (capped at logical CPU count). Memory checks and two consecutive throughput gains below 5% stop expansion. See [laptop worker sweep](../../LOCAL_PM2_WORKER_SWEEP.md): four workers performed best; eight were tested. This is a short benchmark, not an automatic production configuration.

## Current representative read baseline

From the repository root, run `npm --prefix server run build` then `npm --prefix server run load:production`. The runner creates a unique disposable database, 200 user accounts and 10,000 published listings, creates their indexes, starts one API process and runs `production.js` through the full HTTP middleware. It cleans up the database and temporary token file afterward. Set `RPS` (default 50) and `DURATION` (default 30s) for other steps. Results and machine/workload metadata are saved as `production-baseline.json` and `production-environment.json`.

The fixed mix is 50% search, 20% property details, 15% profile, 10% own listings and 5% admin summary, with rotating accounts. Every result is checked for actual successful data. Thresholds fail on errors, dropped iterations or latency above the configured budgets. This is a read baseline: it excludes password hashing, uploads, workflow writes, worker traffic and large conversation histories. See the [production plan](../../PRODUCTION_READINESS_PLAN.md) for full release qualification.

Latest local run: 1,500 requests at 50/s for 30s, 0 errors, 0 dropped iterations, overall p95 10.03 ms. Per-route p95: search 6.90 ms; details 5.29 ms; profile 4.57 ms; own listings 11.42 ms; admin summary 10.95 ms. This does not establish maximum capacity.

## Local bottleneck profiling (2026-10-12)

The optimization implementation and newest comparison are documented in `../../PERFORMANCE_FIXES.md`. `local-results/` and `local-followup/` are the unchanged original baseline. `after-results/` and `final-results/` are intermediate tuning runs; `tuned-results/` is an intermediate equality-lookup run; `release-results/` contains the final implementation, and `steady-results/` isolates virtual-user startup by preallocating all 80 users. To reproduce the latest stages, run `npm run build`, set `$env:PROFILE_RELEASE='1'`, run `node load/profile-local.cjs`, then `Remove-Item Env:PROFILE_RELEASE`. The functional paging/concurrency/privacy guards run with `node load/test-performance.cjs` after building. Run functional tests separately from load tests to avoid CPU contention.

See `../../LOCAL_BOTTLENECK_REPORT.md` for the measured findings and limitations. The profiler explicitly connects to loopback MongoDB, seeds a unique disposable database, and deletes that database and temporary tokens when finished. It never reads `.env`. It uses the compiled real app and default authentication limits.

Run from `server/` with local MongoDB and k6 available:

```powershell
npm run build
node load/profile-local.cjs
$env:PROFILE_FOLLOWUP='1'
node load/profile-local.cjs
Remove-Item Env:PROFILE_FOLLOWUP
```

The first run saves `load/local-results/`; the follow-up saves `load/local-followup/`. Reruns overwrite these directories' result files. The first run deliberately stresses large lists and can consume about 2 GB of API memory. Results cover short 20-second arrival-rate stages, not a soak test. The 80-VU cap bounds generator resources; dropped iterations are failures, not successfully served traffic. Failed performance thresholds are saved in each stage's exit code; the harness still completes diagnostics and cleanup. Its overall exit status is not a performance gate. A `peakRSS` of zero on a short individual probe means the 250 ms sampler did not fire, not zero memory usage.

## Historical exploratory runs

The results below predate auth rate limiting. The old `single-instance.js` repeatedly logs in from one source IP and now intentionally encounters 429 responses under the default policy; do not weaken production limits to reproduce those runs. The current `route-smoke.js` includes the new readiness route (49 routes); the saved historical smoke result covered 48.

These scripts are intended for a disposable local database. `single-instance.js` creates a test account and a draft listing in `setup()`; never point it at production.

Start one API process with `MONGO_URI` set to a disposable database, `PORT=5055`, and `SUBMISSION_WORKER_ENABLED=false`. Then run from `server/`:

```powershell
k6 run --summary-export load/summary.json load/single-instance.js
$env:LEVELS='150,250,400'; k6 run --summary-export load/summary-high.json load/single-instance.js
$env:WORKLOAD='search'; $env:LEVELS='100,200,400'; k6 run --summary-export load/summary-search.json load/single-instance.js
k6 run --summary-export load/summary-routes.json load/route-smoke.js
```

`single-instance.js` runs 12 representative routes (including login, public property search, property workspace, profile, inquiries, and documents list), with one second of think time per virtual user. `route-smoke.js` sends requests to every listed route definition for 10 seconds. Most protected route probes intentionally receive 4xx because they have no credentials or valid workflow payload; this is a routing and middleware smoke test, **not** a capacity measurement of those business handlers.

## Results (2026-10-12, local Windows host, one Node process and local MongoDB)

| Workload | Peak VUs | Requests | Rate over full ramp | Error rate | p95 latency |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mixed, ramp 10/25/50/100 | 100 | 2,318 | 32.6/s | 0% | 439 ms |
| Mixed, ramp 150/250/400 | 400 | 5,599 | 100.2/s | 0% | 2,442 ms |
| Search only, ramp 100/200/400 | 400 | 9,660 | 172.8/s | 0% | 4.6 ms |
| All route definitions, unauthenticated smoke | 48 | 480 | 47.7/s | 0 server errors | 10.6 ms |

The search fixture had one published listing, so the search result is a light data-set baseline. The mixed test reused one account across virtual users and includes repeated bcrypt logins. Rates shown include ramp-up and ramp-down; they are not steady-state maximum throughput. At 400 VUs, the mixed p95 exceeds 2 seconds despite no errors. Test with production-like data, distinct user accounts, and a steady plateau before making a deployment capacity commitment.
