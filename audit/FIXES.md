# Audit fixes — 11 October 2026

All 26 findings from `BUG_REPORT.md` have been addressed. The six frontend type errors and the lint errors/warnings have also been resolved. Changes are local and have not been deployed.

## Fix coverage

| Audit issue | Implemented change |
|---|---|
| 1. Photo traversal | Dedicated photo router restricts names to UUID image filenames and checks directory containment. Normal uploads/downloads remain supported. |
| 2. Wishlist disclosure | Saving requires an eligible published property. Reads apply publication/account-status filters and the public projection, including for old saved entries. |
| 3. Refresh rotation | Full-token SHA-256 digests, unique JWT identifiers and atomic compare-and-replace prevent replay and concurrent reuse. Legacy bcrypt token hashes are rejected. |
| 4. Inquiry bypass | Both offer paths share user/KYC/publication/seller-status/amount validation. Inquiry responses expose participant names, not mobile numbers. |
| 5. Inactive reviewers | Automatic/manual assignment requires active staff. Resubmission rechecks the preferred advisor. Deactivation releases pending work to the unassigned queue and records history. |
| 6. Profile ID | Auth/profile endpoints share a user DTO with `id`; the client profile service returns `UserProfile`. |
| 7. Deal disclosure | Buyers receive a public property projection; owners/admin retain their authorized private view. |
| 8. Document revocation | Download redemption checks suspension and activation in addition to property access and token expiry. |
| 9. JWT defaults | Startup rejects missing/default secrets and identical access/refresh secrets. |
| 10. Deal states | Explicit transitions protect terminal deals, validate counter amounts and reject concurrent overwrites. |
| 11. Seller transactions | Query uses `Deal.ownerId`. |
| 12. Staff history | Query uses `verificationHistory.actorId` and review actions. |
| 13. Audit endpoint | Returns actual `verificationHistory` without populating an undefined schema path. |
| 14. Admin navigation | Admin user/staff property links open the private verification workspace. |
| 15. Deal amounts | Admin view displays `counterAmount` or `offerAmount`. |
| 16. Profile validation | API validates and normalizes names/emails with model validators enabled; the editor shows validation/server errors. |
| 17. Logout privacy | Messages are gated by authentication; account-keyed child components discard conversations, selection and draft state on logout/account changes. |
| 18. Message activity | Shared activity calculation uses the newest message for previews and timestamps. |
| 19. Unread messages | Per-participant read timestamps persist in MongoDB. Authorized acknowledgments use a monotonic update; open conversations acknowledge only fetched activity. Polling stops when the screen loses focus. |
| 20. Web sort | Combined sent/received conversations sort by actual activity and the selected order. |
| 21. Saved refresh | Both saved screens reload on focus and show a loading indicator. |
| 22. HTTPS documents | Photo/document links share a validated configured public origin; production requires HTTPS. |
| 23. Offer errors | Submission errors are displayed inside the offer sheet, with the entered amount retained; numeric validation rejects invalid amounts. |
| 24. Workflow tests | Fixtures include photos, missing-photo rejection is asserted separately, and document downloads target the isolated local server. |
| 25. Review notes | Approval readiness and button validation require the same minimum notes length as the backend. |
| 26. Credential logging | URL maintenance logs connection status without the database URI. |

Type fixes align saved-property image/road-width types, provide the map's required property ID and use existing theme/style keys. Lint fixes include committed-state synchronization for map refs, stable animation instances, effect lifecycle fixes and unused-import cleanup. Generated bundles are excluded from lint; application rules remain enabled.

## Validation completed

| Check | Result |
|---|---|
| Server TypeScript, `npx tsc --noEmit` | Passed |
| App TypeScript, `npx tsc --noEmit` | Passed |
| App ESLint, `npx eslint app components src hooks constants --max-warnings 0` | Passed: zero errors or warnings |
| `npm --prefix server run test:workflow` | Passed: 62 HTTP assertions plus workflow/history assertions |
| `npm --prefix server run test:security` | Passed: 66 HTTP/configuration checks plus model/activity assertions |
| Expo export, `--platform all` | Web, Android and iOS bundles exported successfully |
| `git diff --check` | Passed |

Security regression coverage uses real routes and models, including successful operations as well as denied requests, concurrent refresh/deal transitions, inactive staff, private-property projections, HTTPS link generation, invalid profiles and persistent unread state. Each suite creates and deletes only its own unique test database and document fixtures. `regression.cjs` is the maintained security suite; `reproduce.cjs` forwards to it. Baseline audit JSON is historical evidence.

No interactive browser session, native-device test or deployment was performed. Bundle export verifies compilation, not device behavior. Frontend data calculation is regression-tested; navigation, modal rendering and focus/account lifecycle changes were checked in code and through type/lint/bundle validation.

##  Deployment notes

- Configure distinct private `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values. Production also requires `PUBLIC_API_URL` set to the externally reachable HTTPS API origin without a path. Outside production, set it whenever using a TLS-terminating proxy.
- Existing refresh sessions require sign-in after this upgrade. Existing access tokens keep their normal expiry.
- No data migration is required for inquiry read timestamps. Existing incoming messages start unread until viewed.
- Previously disabled staff with old pending assignments can be reassigned by Admin. New deactivations release pending work automatically; correction resubmissions reselect an active advisor.
