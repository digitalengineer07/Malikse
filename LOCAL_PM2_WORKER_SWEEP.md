# Laptop PM2 worker sweep

12 October 2026. **Four workers produced the best result in this test. Eight workers ran successfully, but were slower.** Eight is the highest count tested, not a proven maximum the laptop can start.

## Measured results

Same sweep, five-second offered load of 10,000 RPS for each worker count, gzip home cards, 1,000 autocannon connections:

| PM2 workers | Reported RPS | Client completed | Client errors/timeouts | Sum of worker peak RSS | Minimum free RAM |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 | 4,745 | 23,721 | 50 | 361 MiB | 523 MiB |
| 3 | 6,040 | 30,198 | 0 | 482 MiB | 702 MiB |
| **4** | **6,348** | **31,740** | **0** | **592 MiB** | **990 MiB** |
| 6 | 5,405 | 27,020 | 0 | 740 MiB | 776 MiB |
| 8 | 5,046 | 25,231 | 0 | 958 MiB | 652 MiB |

Timeouts are included in errors. Every observed response was HTTP 200; all stages made zero Mongo read commands after warm-up. No stage met 10,000 RPS. RPS is the generator's sample-average metric, not a full-wall-time quotient.

The laptop has a Ryzen 5600H, six physical cores, twelve logical CPUs and approximately 7.36 GiB usable RAM. Initially only about 800 MiB was free. Free memory changed during the run as Windows and other programs changed their working sets; these values are observations, not fixed per-worker memory budgets. Summed worker peak RSS excludes PM2, MongoDB, the generator and other applications, and individual peaks need not be simultaneous.

Combined sampled worker CPU rose from approximately 3.6 cores at four workers to 4.9 cores at eight, while throughput fell. The API, cluster coordinator, load generator and MongoDB all share the laptop. CPU contention and scheduling/generator overhead are plausible contributors; this experiment does not isolate them. It does establish that increasing the worker count did not improve this workload after four.

The two-worker result differs from the previous approximately 6,147 RPS run. Background load and short-run variation prevent treating these values as exact capacity limits. Four workers is the best candidate for a longer confirmation run on this laptop, not a production sizing guarantee. Hostinger has a different available resource allocation.

## Stop decision

The runner planned counts 2, 3, 4, 6, 8, 10 and 12. It stopped after both six and eight workers reduced throughput. Ten and twelve were not tested. All workers participated in each stage; warm-up checked their distinct process IDs.

Memory checks reserve startup headroom, halt the generator below 256 MiB free RAM and stop expansion if a completed stage falls below 384 MiB. No memory stop was triggered in this run. More processes are not evidence of more request capacity.

## Scope and reproduction

This is a **read-only cached snapshot** in a uniquely named disposable local database, with per-worker ten-connection Mongo pools and no Redis. It does not test multi-worker writes, independent per-user pacing, unique queries, authentication or uploads. Live cluster caching still requires cross-process invalidation; see [cluster limitations](LOCAL_PM2_CLUSTER_REPORT.md).

Run from `server/`:

```powershell
npm run load:pm2-max
```

The runner builds the API, seeds fixtures, uses an isolated PM2 daemon, sweeps workers and saves per-worker counters. It exits nonzero when the offered request target fails. It stops its workers/daemon and removes the disposable database afterward. Existing applications are untouched. No benchmark API instances remain running after this test.

Raw evidence: `server/load/runs/2026-10-12T15-45-33-317Z-local-profile/pm2-report.json`, per-stage `autocannon.json` and worker snapshots. Backend build and changed JavaScript syntax checks passed.
