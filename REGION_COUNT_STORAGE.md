# Stored area counts

`GET /properties/regions` now reads `regioncounts`, a separate MongoDB collection, rather than aggregating listings. It stores state, district and pincode totals for all property types together and for each individual type. A compound index selects the current generation, level, parents and property type. Existing response fields and map behaviour are preserved.

`regioncountstates` holds the active generation, source revision and refresh lease. Completed generations are published with a single conditional metadata update. Concurrent writes invalidate a refresh's revision; partial or superseded snapshots are not published. Multiple API processes coordinate through the database lease. Readers briefly cache the active generation for one second and retain the existing compressed response cache.

Relevant Property/User model writes persist a dirty revision before and after the mutation. A background job coalesces those changes and rebuilds the summaries. It includes only fully published listings whose owner is active and not suspended. This implementation performs a full aggregation during a **background refresh**, rather than maintaining incremental counters. Ordinary count requests never recount properties. Counts are eventually consistent: readers retain the last completed snapshot during refresh, normally for roughly one second plus refresh time. Sustained catalogue writes or database failures can extend this delay; no new snapshot is shown until a complete refresh succeeds.

At startup, the API creates the summary indexes and requests a rebuild before listening. A database lease prevents overlapping refresh writers; another active worker may finish the refresh. The background job retries pending work. A fresh database without a completed snapshot returns a retryable 503 for counts. Recent old snapshots are kept for at least a minute for in-flight readers; older generations are cleaned up after publication. Startup rebuild also reconciles writes made while the API was stopped.

For manual reconciliation after a direct MongoDB import or change that bypasses the Mongoose models:

```powershell
cd server
npm run db:region-counts
```

The script uses `MONGO_URI`, or the local `malikse` database when not configured. Raw collection writes, external writers, and Mongo shell edits must run this rebuild or restart the API afterward. Property listing search and address suggestions still query listings; the new collections serve area totals.

Validation: `npm run test:regions` verifies unchanged counts, compound-index use, zero Property/User reads for uncached count requests, type filters, owner visibility, sold/deleted listings, approval changes, pincode moves, and rejection of an interrupted snapshot publication. `npm run test:public-cache` verifies the existing caching and visibility regression suite. The local `malikse` database was backfilled with 204 summary rows on 13 October 2026; no Atlas database was changed.
