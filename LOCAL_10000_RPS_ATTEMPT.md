# Local 10,000 RPS attempt

Run: 2026-10-12, one 5-second k6 constant-arrival-rate stage at 10,000 iterations/s. Each iteration made one HTTP GET. The workload used the existing mixed route profile: 50% property search, 20% property detail, 15% user profile, 10% own properties, and 5% admin summary. The disposable database contained 10,000 properties, 1,000 users, and 300 inquiries. One API process, local MongoDB, and k6 shared a Ryzen 5 5600H PC with 7.36 GiB RAM. k6 was capped at 80 virtual users to bound local resource use.

| Measure | Result |
| --- | ---: |
| Scheduled iterations | 50,001 |
| Requests actually sent and completed | 1,849 |
| k6 reported request rate | 360.3/s |
| Dropped before sending | 48,152 (96.3%) |
| HTTP failures among sent requests | 0 |
| Successful response checks | 1,849 / 1,849 |
| Completed request latency p95 | 320.4 ms |
| API event-loop utilization | 90.1% |
| API event-loop delay p95 / max | 114.6 / 139.9 ms |
| API process CPU | 94.4% of one core |
| MongoDB command latency p95 | 113 ms |
| API peak resident memory | 292 MiB |

k6 reported `Insufficient VUs, reached 80 active VUs and cannot initialize more`. The dropped iterations were never sent to the API. The 10,000 RPS objective was not reached; this run does not establish the server's maximum throughput because the 80-VU cap and load generator competed with the API and MongoDB on the same PC. The delivered workload was already near one CPU core of API work and showed substantial event-loop and database delay. The zero-error and p95 values apply only to sent requests.

Raw results: `server/load/attempt-10000-rps/mixed-10000.json` and `server/load/attempt-10000-rps/profile.json`. The disposable database was removed after the run. To repeat this bounded attempt: from `server`, set `PROFILE_10K=1`, `DURATION=5s`, and `PREALLOCATED_VUS=40`, then run `node load/profile-local.cjs` after building the server.
