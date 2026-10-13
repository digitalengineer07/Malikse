# Autocannon: user home property requests

Run on 2026-10-12. The user home screen calls `GET /properties/search?limit=50&view=cards`; type, location, price, and next-page actions use that endpoint with query parameters. Opening a property calls `GET /properties/:id`. Each request shape was preflighted for a populated 200 response, then tested separately for 5 seconds with 20 concurrent connections using autocannon.

| Home request | Completed requests/s | Median | p97.5 | p99 | Errors / timeouts / non-2xx |
| --- | ---: | ---: | ---: | ---: | ---: |
| Default cards | 272.6 | 63 ms | 159 ms | 213 ms | 0 / 0 / 0 |
| Type filter | 252.8 | 73 ms | 139 ms | 156 ms | 0 / 0 / 0 |
| Location text search | 95.6 | 180 ms | 455 ms | 600 ms | 0 / 0 / 0 |
| Price filter | 256.2 | 71 ms | 202 ms | 284 ms | 0 / 0 / 0 |
| Next page with cursor | 309.4 | 59 ms | 122 ms | 132 ms | 0 / 0 / 0 |
| Property detail | 796.0 | 24 ms | 35 ms | 37 ms | 0 / 0 / 0 |

Location search was the slowest tested path. Its MongoDB command p95 was 371 ms; the other list shapes were 56–85 ms and detail was 11 ms. These are throughput measurements at 20 concurrent connections, not maximum sustainable capacity or a 10,000 RPS claim. Autocannon reports p97.5 rather than p95, so p97.5 is shown directly.

The fixture had 10,000 published properties and 1,000 users. One API process, local MongoDB, and autocannon shared the same Ryzen 5 5600H PC. Each case was preflighted, which warmed the 15-second candidate-ID cache before the measured run. Results do not represent a cold cache, hosted Atlas latency, Hostinger hardware, image downloads, or client rendering. The disposable database was removed after the run.

Raw data: `server/load/autocannon-home-results/profile.json`. Reproduce with `npm run load:home` from `server` while the local MongoDB service is running.
