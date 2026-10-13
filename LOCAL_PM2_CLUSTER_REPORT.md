# Local PM2 cluster test — 12 October 2026

Follow-up: [laptop worker sweep](LOCAL_PM2_WORKER_SWEEP.md) tested up to eight workers; four achieved the best throughput in that run.

## Result

Two PM2 workers improved the reported cached-home throughput from the earlier single-process **3,045 RPS** to **6,147 RPS**. **The 10,000 RPS target still failed.** This is a short overload experiment, not a production capacity qualification.

| Configuration | Client completed | Reported RPS | Client errors / timeouts | Non-2xx | Mongo reads |
| --- | ---: | ---: | ---: | ---: | ---: |
| Earlier single process, cached | 18,269 | 3,045 | 0 / 0 | 0 | 0 |
| PM2, two workers, cached snapshot | 30,734 | 6,147 | 2 / 2 | 0 | 0 |
| PM2, two workers, cache disabled | 25,498 | 5,101 | 0 / 0 | 0 | 106 |

Timeouts are included in errors; these are not four separate failures. RPS is autocannon's sample-average rate, not client-completed divided by total wall time. The before/after runs happened at different times on the same PC, so this is an approximate comparison, not an isolated CPU scaling measurement.

## Configuration

- PM2 7.0.4, two cluster workers, one shared loopback port, explicit round-robin scheduling.
- Ten Mongo connections maximum per worker: up to twenty application pool connections in total, plus monitoring connections.
- Ryzen 5600H Windows PC; API workers, PM2, local MongoDB and separate autocannon process share resources. No CPU affinity or two-core hard limit was imposed.
- 10,000 listing fixtures, gzip, `/properties/search?limit=50&view=cards`.
- Offered 10,000 RPS for five seconds with 1,000 generator connections. Rotating identifiers model aggregate demand; this does not prove 10,000 independent users each maintaining one request per second.
- No Redis, no submission worker, no request logging, no concurrent writes. Cached mode exposes only GET/HEAD against a disposable local database. It is a fixed-snapshot experiment.

The first warm-up attempt detected that Windows was sending requests to only one worker and was discarded. After switching to round-robin, both workers were verified before measurement. Cached stage received 15,856 and 15,880 requests respectively.

## Bottlenecks and counter boundaries

Cached workers used approximately 104% and 100% of one core over their sampled windows. Event-loop p95 was around 51 ms. Combined sampled peak worker RSS was approximately 435 MiB, excluding PM2, MongoDB and the generator. Cached worker database reads were zero; database pool enlargement cannot resolve that measured CPU limit.

Cached mode prepared 31,736 requests. Workers received and completed 31,736; the client observed 30,734 completions and two timeouts. Requests completed by a server after the client deadline are not successful client responses.

Cache-disabled mode prepared/received 26,498 requests. Workers recorded 25,678 finished responses and 820 aborted responses; the client observed 25,498 completions. Aborts occurred as the overload generator stopped with requests outstanding. Zero client errors does not mean all offered requests were delivered or completed.

Cache-disabled mode retained identical-request coalescing: 53 shared fills served the hot-query workload using 106 Mongo reads. It does **not** represent thousands of unique uncached searches per second. Both workers saturated approximately one core. Corrected overload latency distributions are in the raw output; they include autocannon coordinated-omission correction and should not be described as simple observed request latency.

## Cluster deployment limitation

Existing cache generation invalidation is local to each process. Do not enable the single-writer cache contract for a live multi-worker deployment: another worker can retain a stale public response after a publication, sale or suspension. Keep `PUBLIC_RESPONSE_CACHE_ENABLED=false` for live cluster writes until shared, fail-closed invalidation is implemented and tested. The fixed read-only cached benchmark is not that implementation.

Redis connectivity alone would not solve this: the current keys include per-process boot/generation namespaces. Auth rate limits also remain process-local, so clustering changes the aggregate limit. Live deployment needs shared limits and cross-worker visibility tests in addition to throughput qualification. PM2's [cluster documentation](https://pm2.keymetrics.io/docs/usage/cluster-mode/) likewise requires attention to process-local state.

## Reproduction and cleanup

From `server/`:

```powershell
npm run load:pm2
```

The command builds, seeds a unique loopback database, starts an isolated PM2 daemon with two workers, warms each worker, runs cached and cache-disabled attempts, saves counters, stops its daemon/workers and removes its database. A missed target causes a nonzero exit. Existing user PM2 apps are not touched. PM2's Windows client may retain IPC handles, so the runner exits explicitly after cleanup.

Source: `server/load/pm2-profile.cjs`, `pm2-worker.cjs`, `run-pm2.cjs`.

Completed evidence: `server/load/runs/2026-10-12T15-31-43-920Z-local-profile/pm2-report.json` and each stage's `autocannon.json`. Generated output is ignored by Git. Build and script syntax checks passed. Test workers and the disposable database were removed; no production app was deployed or left running.
