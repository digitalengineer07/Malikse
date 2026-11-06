# Hostinger startup and proxy configuration

Build with `npm run build` and start with `npm start` (`dist/index.js`).
The listener opens before MongoDB and region-count initialization. `/health`
reports liveness; `/ready` and API routes return 503 until initialization completes.
Startup failures still close the listener and exit with an error.

Configure the reverse proxy in the hosting environment, then redeploy/restart:

- Prefer `TRUSTED_PROXIES` with the actual ingress IPs/CIDRs.
- Alternatively, for a verified fixed path of exactly one proxy with direct access
  to the Node port blocked, set `TRUST_PROXY_HOPS=1` and leave `TRUSTED_PROXIES`
  empty. Use the actual hop count if the verified path contains more proxies.
- Do not set both options. Leaving both empty keeps direct-access behavior.

Both Fastify and the Express fallback use the same trust policy. A hop count
must match every ingress path; an incorrect count can permit spoofed client IPs.
The logs alone do not establish Hostinger's proxy addresses or hop count.
After deployment, verify that separate client IPs receive separate auth rate-limit
buckets and that prepending an arbitrary forwarded IP cannot reset a bucket.

Local regression check (no MongoDB required):
`npm run build && node load/test-hosting-startup.cjs`.

# MongoDB read replica

The API uses the MongoDB replica set in `MONGO_URI`. Verify that the deployment
has a secondary and that the URI discovers the full replica set. Set
`MONGO_READ_REPLICA=true` in the API environment, then restart
the API. Startup checks that a secondary accepts commands; readiness stays off
if it cannot. Leave the flag false for a standalone local MongoDB server.
Run `npm run db:verify-replica` from `server/` to verify property and chat reads
against a secondary without changing database contents.

Public property search, details, locations, region counts, saved properties,
and owner listing pages use the secondary. Listing mutations and authorization
checks use the primary. Conversations read the newest six from the primary and
older conversations from the secondary. Opening a conversation reads its newest
six messages from the primary; “Load older messages” fetches up to 50 at a time
from the secondary. Replica reads may briefly lag writes; an incomplete message
page returns 503 with `Retry-After` rather than advancing the pagination cursor.

For a local throughput run, keep `PUBLIC_RESPONSE_CACHE_ENABLED=true` and
`REQUEST_LOGS=false`. If the configured Redis server is unavailable, set
`REDIS_CACHE_ENABLED=false`; the bounded in-process cache remains active for
its full TTL. Restart the API after changing these settings. To compare MongoDB
primary and secondary read speed, disable the response cache in both runs.
Production response caching still requires the documented single-writer contract.
