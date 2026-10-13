# Local attempt: 10,000 users at one home request per second

Date: 2026-10-12. This target is **10,000 requests per second**. The five-second target was 50,000 requests to `GET /properties/search?limit=50&view=cards`. Autocannon ran in a separate process from the single API process and was configured for an aggregate 10,000 RPS. It rotated synthetic anonymous user IDs and had 1,000 concurrent HTTP connections. The API and local MongoDB shared the same Ryzen 5 5600H PC. The database fixture had 10,000 properties and 1,000 registered users; the synthetic visitors were anonymous browsing identities, not registered accounts.

| Measure | Initial run | Diagnostic run | After status fix |
| --- | ---: | ---: | ---: |
| Target requests in five seconds | 50,000 | 50,000 | 50,000 |
| Completed responses | 1,555 | 2,018 | 1,746 |
| Completed responses/s | 311.0 | 403.6 | 349.2 |
| HTTP 200 | 1,009 | 1,673 | 1,247 |
| HTTP 400 | 546 | 345 | 0 |
| HTTP 503 | 0 | 0 | 499 |
| Generator-prepared requests | 2,555 | 3,018 | 2,746 |
| Median response latency | 1,120 ms | 1,002 ms | 1,054 ms |
| p99 response latency | 2,889 ms | 2,439 ms | 2,550 ms |
| API event-loop delay p95 | 126 ms | 136 ms | 177 ms |
| API CPU as percent of one core | 92% | 139% | 123% |

The captured 400 body was `Timed out while checking out a connection from connection pool`. The test API's MongoDB pool was capped at 50 connections with a 2-second wait timeout. The search route was changed to return HTTP 503 with `Retry-After: 1` and a generic busy message for this pool timeout. The verification run confirmed 499 HTTP 503 responses and no HTTP 400 responses. The correction does not increase throughput.

The target failed. Only 1,746 responses completed in the post-fix run; 1,247 were successful. The 1,000-connection generator cap means this was an offered aggregate-rate test, not 10,000 simultaneous open client connections. Only the prepared requests reached the point of being built by autocannon, so the test did not actually deliver 50,000 requests or exercise 10,000 distinct visitors. Autocannon's `requests.sent` field overcounts by 9,000 here because its rate accounting adds ten initial requests for each of 1,000 connections; use `preparedRequests` and completed response counts instead.

This local test does not measure the Hostinger shared plan or MongoDB Atlas M10. Its main finding is that this local single-API plus MongoDB setup cannot serve the target, and the database connection pool is one observed overload point. A true 10,000 simultaneous-client validation needs a separate load-generator host and a staging copy of the intended deployment.

Raw outputs for the initial and post-fix runs: `server/load/users-10000-results/autocannon-first.json`, `profile-first.json`, `autocannon.json`, and `profile.json`. The diagnostic figures are recorded in the table. Every disposable database was removed. The repeatable command is `npm run load:users-10k` from `server`; it exits nonzero when the target is missed.
