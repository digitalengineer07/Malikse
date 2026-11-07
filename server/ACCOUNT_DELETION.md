# Account deletion operations

Implemented 2026-11-07. Public website: https://malikse.devoxa.in.

## Entry points

- Website `/delete-account`; app Account > Delete account (`/delete-account`). Buyer/owner accounts only. Staff accounts require administrator-led reassignment and removal.
- `POST /account-deletion`: registered `identifier` (email or 10-digit mobile), `password`, and `confirmation: "DELETE"`. Password reauthentication is mandatory, including when already signed in. Returns HTTP 202 with `reference`, private `receipt`, status and timestamps. Duplicate requests are safe while the account exists.
- `POST /account-deletion/status`: `reference` and `receipt`; no login required. Treat the receipt as private. Completed receipts expire after 90 days through MongoDB TTL cleanup. Rotating JWT_REFRESH_SECRET invalidates existing receipts.
- `GET /admin/account-deletions`: authenticated administrator queue. Admin user lists also flag deletion requests.

## Processing and retention

The durable request immediately disables the account and revokes sessions. The server worker checks every 10 seconds and starts cleanup after a 60-second drain period. This is a scheduling interval, not a completion SLA. Leases and retry backoff allow recovery after interruption. Monitor pending/processing age, attempts and awaiting_deals jobs.

Accepted or token-paid deals hold cleanup in `awaiting_deals`. Assigned staff/admin must resolve them through the normal deal workflow. New offers/acceptance reject deleting accounts. Never edit financial state directly to bypass the hold.

Cleanup removes the user, their owned properties, KYC files and chunks, unshared photos, property documents, inquiries/messages, saved/search/activity data, push registrations, notifications, password resets and pending registration records. Shared photos remain for surviving listings. Limited deal records remain with the deleted buyer/owner link replaced, free-text history and payment references removed; other participants and transaction amounts/status/dates remain. A completed job drops its user/contact linkage.

The worker cannot erase provider logs, exports, backups or independent copies. Their retention schedule remains an operator decision and must be documented before launch. Backups restored into service must reapply completed deletion operations; maintain an appropriately protected operational process outside the 90-day receipt store.

## Deployment

Deploy server and clients together. Startup creates the AccountDeletion unique/queue/TTL indexes before starting the worker. MongoDB replica-set support is required by the existing transactional deal workflow. Every worker must see the same persistent local upload volume if legacy/local files are used; GridFS is shared through MongoDB. Run one server instance for local-file storage unless shared storage is configured.

Configure `VITE_PRIVACY_CONTACT_EMAIL` with a monitored mailbox. The user-requested default `support@malikse.example` is deliberately nonfunctional and labeled as a placeholder. Set app `EXPO_PUBLIC_WEBSITE_URL=https://malikse.devoxa.in`. Configure the website host to serve SPA deep links `/privacy-policy` and `/delete-account`; verify both externally after deployment. This implementation has not been deployed by this task.

## Verification

`npm run test:account-deletion` builds and exercises isolated local MongoDB fixtures. `node load/test-account-deletion.cjs --replica` uses the workflow-test replica set on port 27028 and additionally checks acceptance rejection during deletion. Tests cover credential/role gates, private receipts, idempotency, revocation, deal holds, partial failure and retries, concurrent workers, shared files, related records, buyer-only cleanup and rate limits. Existing assigned-workflow regression passed (54 HTTP requests). Website typecheck/tests/build and app typecheck/recommendation checks passed. Native device UI and production infrastructure have not been tested.
