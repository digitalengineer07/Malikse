# Local load retest — 12 October 2026

One API process, local MongoDB, and autocannon ran on the same laptop. The disposable database contained 10,000 published properties and 1,000 users; it was removed after each run. Redis was unavailable, so public responses used the in-process cache. Results do not predict Hostinger or Atlas performance.

Raw runs:

- `server/load/runs/2026-10-12T17-15-28-370Z-autocannon-home-results/profile.json`
- `server/load/runs/2026-10-12T17-17-37-677Z-users-10000-results/profile.json`
- `server/load/runs/2026-10-12T17-17-37-677Z-users-10000-results/autocannon.json`

## Endpoint comparison

Each route was preflighted for a populated HTTP 200 response, then measured for five seconds at 20 connections with gzip accepted. The preflight filled the public response cache, so this table measures **warm, exact-query cache hits**. Autocannon reports p97.5, not p95.

| Route | Completed requests/s | Median ms | p97.5 ms | Errors/timeouts/non-2xx |
| --- | ---: | ---: | ---: | ---: |
| Home default cards | 3433 | 5 | 12 | 0/0/0 |
| Home type filter | 3249 | 5 | 12 | 0/0/0 |
| Home text location | 3225 | 5 | 12 | 0/0/0 |
| Home price filter | 2715 | 6 | 17 | 0/0/0 |
| Home next page | 2878 | 6 | 13 | 0/0/0 |
| Property detail | 3503 | 5 | 13 | 0/0/0 |
| Home state filter | 3008 | 6 | 13 | 0/0/0 |
| Home district filter | 3245 | 5 | 13 | 0/0/0 |
| Home pincode filter | 3147 | 6 | 12 | 0/0/0 |
| Home address filter | 3288 | 5 | 12 | 0/0/0 |
| Region counts: state | 3787 | 4 | 14 | 0/0/0 |
| Region counts: district | 3757 | 4 | 14 | 0/0/0 |
| Region counts: pincode | 3694 | 4 | 15 | 0/0/0 |
| Suggest: state | 3469 | 5 | 14 | 0/0/0 |
| Suggest: district | 3361 | 5 | 13 | 0/0/0 |
| Suggest: pincode | 3299 | 5 | 15 | 0/0/0 |
| Suggest: address | 3452 | 5 | 15 | 0/0/0 |

The warm Home price filter had the lowest measured throughput. Because all these routes made zero MongoDB commands during their measured stages, differences reflect response size, HTTP/JSON work, cache lookup, scheduling, and measurement variation, not database query speed.

## Cold single-request probes

These are one request per route, not p95 distributions. They identify candidates for further cold-load testing.

| Route | End-to-end ms | Mongo commands | Mongo command p95 ms |
| --- | ---: | ---: | ---: |
| Deep search, page 100 | 613 | 201 finds | 3 |
| Default Home search | 118 | 2 finds | 70 |
| Region counts: district | 73 | 1 aggregate | 70 |
| Region counts: pincode | 66 | 1 aggregate | 62 |
| Region counts: state | 61 | 1 aggregate | 57 |
| Text location search | 54 | 2 finds | 45 |
| Suggest: state | 22 | 2 finds | 6 |
| Suggest: district | 16 | 2 finds | 5 |
| Suggest: pincode | 15 | 2 finds | 3 |
| Direct address search | 14 | 2 finds | 5 |
| Suggest: address | 12 | 2 finds | 3 |

**Slowest cold endpoint:** page-number deep search. Its implementation advances through 100-record MongoDB batches and owner checks until it reaches page 100, producing 201 MongoDB finds for this single request. Cursor paging avoids this repeated traversal. The initial/default search and region aggregates are the next meaningful cold costs in this fixture. Search suggestion and address timings are favorable here because the fixture has uniform locations and matching records appear early; arbitrary addresses or larger real datasets need separate evaluation.

## 10,000 RPS offered-load attempt

Autocannon offered 10,000 requests/s for five seconds to the warm Home cards route with 1,000 connections. It completed **23,819 requests**, averaging **3,970 requests/s**; median latency was **125 ms**, p97.5 **288 ms**, p99 **349 ms**. It reported no HTTP errors, timeouts, or non-2xx responses. Only **24,819** requests were prepared against the planned 50,000, so this run did not generate the full target load. The deficit cannot be attributed solely to the API.

The API measured **24,819 L1 cache hits, zero MongoDB commands**, event-loop utilization **94.5%**, event-loop delay p95 **40 ms**, and about **110% of one core** of CPU during the stage. This identifies local HTTP/cache-hit processing and shared-machine load generation as the observed warm-path bottleneck. MongoDB was not the bottleneck for this exact cached query. There is no evidence from this run that one Hostinger instance can sustain 10,000 RPS, nor does it establish a maximum server-only rate because generator, API, and MongoDB shared the laptop.

To reproduce: from `server/`, run `npm run load:home` and `npm run load:users-10k` with local MongoDB running. Both scripts build the API and create/remove unique disposable databases. The 10,000 RPS command exits nonzero when its target is not met.
