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
