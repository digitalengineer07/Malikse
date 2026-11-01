# Audit remediation — 2026-11-01

Changes are in the local main checkout. No production deployment, database
collection deletion, credential rotation, or production migration was performed.

## Findings reconciled

| Report item | Result |
| --- | --- |
| 1.1, 2.1 fallback HMAC | Removed placeholder-secret verification; new OTP hashes use the configured secret. A regression rejects a stored placeholder-secret hash. This was not a universal login bypass: verification also needed a matching stored challenge hash. |
| 1.2 OTP logging | Removed full OTP logging and made delivery failures fail closed except explicit nonproduction development/test modes. |
| 1.3, 5.4, 6.1 suspended owners | Replaced global suspended-ID enumeration with owner joins in public visibility, staff queues and wishlist paths. Pagination sorts before the join and limits after visibility filtering. |
| 1.4 refresh expiry | Added explicit expiry, rotation and atomic replay protection. No TTL index on User: MongoDB TTL deletes the entire user document, not a token field. |
| 2.2 private photos | Require publication plus an enabled owner, or authenticated property access. New uploads carry property metadata. Both clients fetch protected photos with authorization. |
| 2.3 document URLs | Removed JWTs from query strings. Browser downloads use hashed, single-use, 60-second tickets with access rechecked on consumption. Bearer downloads remain supported. |
| 2.4 demo KYC | Disabled production self-approval. Production requires staff identity approval, with reviewer, timestamp and notes; admin UI and client identity status were updated. This is manual review, not integration with an external KYC provider. |
| 2.5 buyer cancellation | Buyers can cancel their own offered deals; state/version checks still protect terminal and concurrent transitions. |
| 2.6 registration resend | Added rate-limited resend with challenge rotation, cooldown and delivery checks. Both clients use it. |
| 3.1 compression | Gzip remains enabled; Brotli is opt-in. Existing compression was asynchronous, not synchronous work on the main event loop. |
| 3.2 password hashing | Native bcrypt in the existing bounded worker pool; bcryptjs-compatible hashes remain readable. The old implementation already had a bounded queue. |
| 3.3, 6.2 location suggestions | Moved matching, grouping, ranking and limiting into MongoDB aggregation instead of transferring 500 documents for JavaScript scanning. |
| 3.4 region count keys | Length-prefixed keys replace repeated JSON serialization; the rebuild yields periodically. |
| 3.5 auth lookup cache | Intentionally retained fresh account reads so suspension and role changes take effect without a cache revocation delay. |
| 3.6 submission polling | Empty polls back off to 5, 15 and 30 seconds; local enqueue wakes the worker immediately; shutdown clears timers. |
| 3.7 synchronous filesystem | Async directory creation and upload cleanup; directory creation is memoized. |
| 4.1 dynamic require | Replaced request-handler require with static imports. |
| 4.2 admin summary cache | Retained the existing bounded five-second per-process snapshot. PM2 workers can show different snapshots within that window; it is not an authorization cache. |
| 4.3 property default | New properties default to draft. |
| 4.4, 4.5 debug scripts | Removed unused root debug scripts; archived the URL migration as text. No migration was executed. |
| 5.1 AdvisorReport | Removed the unreferenced model source. No stored collection was dropped. |
| 5.2 SearchCache | Removed runtime index setup for this legacy cache; retained the model because legacy benchmark/infrastructure scripts still reference it. Runtime public caching uses the current memory/Redis path. |
| 5.3 unused invalidation export | Removed the unused export/import. Active generation invalidation remains. |
| 5.5, 5.6 route wrappers | Retained: these render working screens or intentionally redirect. File length does not make a route dead. |
| 6.3 wishlist | Removed suspended-user enumeration and bounded the aggregation. The existing linear passes are not quadratic; ordering and visibility behavior are preserved. |
| Expo scaffolding | Removed unreferenced hello-wave, haptic-tab, parallax-scroll-view and external-link components and the unused image helper. Kept referenced themed-view. |

## App behavior carried forward

The app uses the website's Bihar search data, location suggestions and map
behavior. On first launch it preloads integrity-checked map libraries into
persistent storage, initial Bihar/home results and up to six property photos.
Failed map downloads retry. Downloads begin when the app first opens, not during
Android installation. Feature code remains in the APK; map tiles, Places and
fresh server data still require network access.

## Verification

- Backend TypeScript build and app/website TypeScript checks passed.
- Profile screens now distinguish staff review, approved identity and development
  demo status; they no longer describe staff approval as government verification.
- Website production export passed. A local HTTP smoke check served the built
  entry points for home, profile, KYC and admin users successfully; this does not
  substitute for signed-in browser interaction tests.
- Security regression: 81 HTTP/configuration checks plus model/UI assertions.
- OTP tests: expiry, attempts, cooldown, resend, concurrency, replay, placeholder
  hash rejection, provider failure and verified login passed.
- Public cache tests: warm reads, visibility/invalidation, cursor, compression,
  Redis failure and admission controls passed.
- Region/suggestion tests passed against a disposable local database.
- Runtime test: default gzip round-trip, no default Brotli, bounded empty-poll
  backoff, immediate enqueue wake and worker shutdown passed.
- Native map tests: bridge, marker updates, layers, HTML escaping, Places and
  inline cached libraries passed.
- Startup cache tests: integrity, offline persistent reuse, request coalescing,
  corruption recovery and retry passed.

Database tests used isolated local databases with secondary reads disabled;
these results do not establish production replica throughput or mobile device
performance. No physical-device smoke test was available.

## Release notes and remaining limits

Deploy server and clients together for protected photo/document handling.
Install updated server dependencies and build before starting it. Run the normal
`npm run db:indexes:prod` migration during deployment to create the download-ticket
TTL index. Expiry is enforced by the route even before that cleanup index exists.

Production OTP delivery must be configured; production demo KYC no longer grants
listing eligibility. Staff should approve identity only after their review.

Legacy photo files without property metadata must authorize every matching
private reference. More than 100 ambiguous references fail closed; normal new
uploads are associated with their original property.

Submission enqueue wakes workers in the current process. Other PM2 processes
can wait up to 30 seconds for their next idle poll; atomic leases prevent duplicate
claims. Admin summary snapshots remain per-process for up to five seconds.

The APK is ARM64, using the existing local development signing setup. Use release
credentials for distribution and smoke-test login/OTP, maps, uploads, protected
documents, identity review and chat on supported devices.
