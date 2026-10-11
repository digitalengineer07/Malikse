# MalikSe code audit — 10 October 2026

**Update, 11 October 2026:** The findings below record the original audit. Fixes and regression coverage are described in [FIXES.md](FIXES.md). `reproduce.cjs` now runs the fixed-behavior regression suite; the original reproduction results are retained as historical evidence.

Reviewed the Express routes, models, authentication, verification workflow, uploads, Expo screens, client services/state, mapping components, configuration and maintenance/test scripts. Generated bundles, dependencies and binary assets were not treated as authored application source. This is a broad code audit, not a guarantee that every possible bug has been found. Browser/device interaction, deployment configuration and load testing were not performed.

26 findings are listed below. Twelve backend findings were reproduced with actual routes/models or installed libraries against a uniquely named temporary MongoDB database. Other findings are supported by the cited code paths; conditional deployment issues are explicitly marked. Application source was not changed.

## Original validation

| Check | Result |
|---|---|
| Server `npx tsc --noEmit` | Passed |
| App `npx tsc --noEmit` | Failed: 6 diagnostics |
| App `npm run lint` | Failed: 39 errors, 27 warnings |
| Broader direct ESLint scan, excluding generated bundle results | 40 errors, 29 warnings; includes additional files outside the Expo command scope |
| Server `npm run test:workflow` | Failed at `testWorkflow.ts:57`: missing required photo, expected 200 but received 400 |
| `node audit/reproduce.cjs` | 12 bug reproductions confirmed; temporary database and fixtures removed |

The original reproduction script asserted the faulty behavior. Its results remain in `reproduction-results.json` and `lint-results.json` as historical evidence. The current `reproduce.cjs` entry point runs the fixed-behavior regression suite described in `FIXES.md`, using the server dependencies and a uniquely named temporary database on the configured MongoDB connection.

## Findings

### 1. [P1] Unauthenticated photo endpoint reads files outside the photo directory

**Location:** `server/src/index.ts:44–47`. **Evidence:** reproduced over HTTP with a harmless sibling fixture.

The decoded route parameter is joined directly to `photoDirectory`, then passed to `sendFile`. A filename containing an encoded slash and `..` escapes that directory. The audit request `/property-photos/..%2Fprivate.txt` returned a sibling fixture without authentication. In the real directory this can expose ownership uploads with known filenames and other readable, non-hidden server files. Restrict filenames to the generated UUID/image format and enforce resolved-path containment before serving.

### 2. [P1] Wishlist exposes private properties and verification reports

**Location:** `server/src/routes/user.routes.ts:47–49, 56–71`. **Evidence:** reproduced.

The toggle accepts any property ID, and the GET endpoint populates the entire property without publication checks or a public projection. An unrelated user who knows a draft ID can save it and retrieve its private report notes, history, ownership fields and document IDs. Even normally saved published listings disclose internal reports. Validate eligibility when saving and use publication/suspension filters plus `publicFields` when reading.

### 3. [P1] Refresh-token rotation does not invalidate older tokens

**Location:** `server/src/routes/auth.routes.ts:131–142` (also registration/login hash creation). **Evidence:** reproduced with installed bcrypt/JWT libraries.

Bcrypt truncates inputs after 72 bytes. These JWTs have the same prefix for a given user, while changing timestamps/signatures occurs later. Two different signed tokens compared equal against the same bcrypt hash in the audit. Previously issued, still-unexpired refresh tokens therefore continue to match after rotation or a later login. Hash the complete token with a suitable full-input digest, add a unique token identifier and rotate atomically.

### 4. [P1] Inquiry endpoint bypasses offer eligibility and reveals private sellers

**Location:** `server/src/routes/inquiry.routes.ts:9–28, 38–39`. **Evidence:** reproduced.

Unlike `/deals/:propertyId/offer`, `/inquiries` does not check the user role, demo KYC, publication/approval status, seller suspension or positive finite offer amount. This is the endpoint the live offer UI uses. A non-KYC buyer submitted a negative offer against another user's draft, then obtained the seller's mobile from `/inquiries/sent`. Apply shared offer/publication validation before creating an inquiry and define contact-disclosure permissions explicitly.

### 5. [P1] Work is assigned to deactivated reviewers

**Location:** `server/src/services/propertyWorkflow.ts:26`; `server/src/routes/admin.routes.ts:18`; `server/src/routes/property.routes.ts:109`. **Evidence:** automatic selection reproduced; other paths traced.

Staff selection checks role/password but ignores `isActive` and `isSuspended`. The audit's only advisor was deactivated and still selected. Manual assignment accepts the same account, and seller resubmission retains an existing advisor without checking availability. Since authentication rejects inactive staff, these listings cannot progress without admin intervention. Filter active staff and handle assignments when staff are disabled or corrections are resubmitted.

### 6. [P1] Editing a profile removes the session's `user.id`

**Location:** `server/src/routes/user.routes.ts:23–28`; `app/components/AccountProfileScreen.tsx:34–35`. **Evidence:** response format reproduced.

Authentication returns `{ id, ... }`, but profile update returns Mongoose JSON with `_id` and no `id`. The frontend replaces the auth-store user with that response. Message ownership checks, reviewer eligibility and account-dependent reloads then use an undefined ID until the profile is fetched through auth again. Return the same user DTO everywhere or normalize the response before storing it.

### 7. [P1] Deal detail exposes private verification data to the buyer

**Location:** `server/src/routes/deal.routes.ts:45`. **Evidence:** reproduced.

The buyer is authorized to read their deal, but `.populate("propertyId")` includes the complete private property. Advisor/verifier reports, history and document identifiers bypass the public-property projection. Select only public fields for buyers; preserve private detail only for authorized owner/admin views.

### 8. [P2] Issued document links remain usable after account suspension

**Location:** `server/src/routes/document.routes.ts:54–57`. **Evidence:** reproduced.

The download route reloads the actor but checks neither suspension nor staff activation. A previously issued link still downloaded an ownership document after the owner was suspended. The exposure lasts until the link's five-minute expiry. Apply the same account-status checks as `authGuard` when redeeming the link.

### 9. [P1] Missing JWT configuration silently enables known signing secrets

**Location:** `server/src/routes/auth.routes.ts:8–9`; `server/src/middleware/auth.middleware.ts:9`; `server/src/routes/document.routes.ts:15`. **Evidence:** static, conditional on missing environment variables.

The service starts with public fallback signing secrets. In that configuration, someone who knows an account ID can mint an access token; the DB role lookup does not protect against impersonating a real active admin. Production startup should reject missing secrets. This audit did not assume the configured deployment actually uses the fallback.

### 10. [P2] Sellers can rewrite completed deals

**Location:** `server/src/routes/deal.routes.ts:72–75`. **Evidence:** reproduced.

The owner may set accepted/rejected/countered regardless of the current status. A completed fixture was successfully changed to rejected, which also changes financial/reporting aggregates. Enforce allowed transitions from the stored status, with an atomic condition preventing concurrent overwrites.

### 11. [P2] Admin transaction lookup omits a seller's deals

**Location:** `server/src/routes/admin.routes.ts:186`. **Evidence:** reproduced.

Deal documents use `ownerId`, but the query searches `sellerId`. A seller with an existing deal received an empty deals list. Use `ownerId` for the seller branch.

### 12. [P2] Staff verification history always searches the wrong field

**Location:** `server/src/routes/admin.routes.ts:198`. **Evidence:** reproduced.

The query uses `history.userId`; workflow events are stored in `verificationHistory.actorId`. Existing review events therefore do not appear in the staff history panel. Query the actual event path and, if the panel is intended to show completed reviews, filter review actions appropriately.

### 13. [P2] Property audit endpoint returns HTTP 500

**Location:** `server/src/routes/admin.routes.ts:208`. **Evidence:** reproduced.

The endpoint populates `history.userId`, which is absent from the schema. Mongoose's strict populate rejects it. It also selects `history` instead of `verificationHistory`. Read the actual history array and resolve its actor IDs without populating a nonexistent schema path.

### 14. [P2] Admin property links use the public page for private listings

**Location:** `app/app/admin/users.tsx:86`; `app/app/admin/staff.tsx:127,135`. **Evidence:** route trace.

These links navigate to `/property/[id]`, which uses the public endpoint and returns 404 for drafts, pending reviews, rejected properties and suspended sellers' listings, even for an admin. Navigate to `/verification/[id]`, as the main admin property queue already does.

### 15. [P2] Admin deal amounts render blank

**Location:** `app/app/admin/users.tsx:100`. **Evidence:** schema/UI comparison.

The UI reads `deal.agreedPrice`, which does not exist in the Deal schema or endpoint response. Existing deals render a rupee symbol without an amount. Display the appropriate `offerAmount`/`counterAmount` for the actual model.

### 16. [P2] Profile update accepts an empty required name

**Location:** `server/src/routes/user.routes.ts:22–27`. **Evidence:** static.

The update has no request validation and does not enable `runValidators`. The profile editor allows an empty name and arbitrary email, although registration enforces a nonempty name and valid email. This persists invalid account data; later document saves can fail required-name validation. Validate the request and enable model validators.

### 17. [P1] Messages remain visible after logout

**Location:** `app/app/(tabs)/messages.tsx:94–99`; `app/app/(tabs)/messages.web.tsx:71–76`. **Evidence:** state/lifecycle trace; not exercised on a device.

When `user` becomes null, the effect stops loading but does not clear conversations, the selected chat or draft text. These tab screens have no auth redirect. If the messages tab remains mounted during logout, returning to it can display the previous account's private conversations while signed out. Clear account-scoped state on account changes and gate rendering by authentication.

### 18. [P2] Message previews and activity ordering revert on every poll

**Location:** `app/app/(tabs)/messages.tsx:125–127`; `app/app/(tabs)/messages.web.tsx:102–103`. **Evidence:** mapping/poll trace.

Polling reconstructs preview/time from the original inquiry rather than the latest message. Sending a reply briefly updates the preview optimistically, then the next five-second poll restores the original text/date. Mobile sorting likewise uses inquiry creation time, so active conversations remain buried. Derive previews and ordering from the last message, falling back to the initial inquiry.

### 19. [P2] Unread views cannot show newly received messages

**Location:** `app/app/(tabs)/messages.tsx:128`; `app/app/(tabs)/messages.web.tsx:104`. **Evidence:** data-flow trace.

Every fetched conversation is assigned `unread: false`, and no path marks it true. Unread counts and filters stay empty even after new incoming messages. Persist/read last-seen state and compare it with incoming message timestamps.

### 20. [P2] Web message sorting changes only the label

**Location:** `app/app/(tabs)/messages.web.tsx:66, 163–181, 585`. **Evidence:** static.

The toggle updates `sortOrder`, but the conversation array is only filtered, never sorted using that state. It also concatenates sent and received lists, so default overall ordering is not chronological. Sort the combined filtered list by activity timestamp and the selected direction.

### 21. [P2] Saved listings do not refresh when returning to the tab

**Location:** `app/app/(tabs)/saved.tsx:71–103`; `app/app/(tabs)/saved.web.tsx:48–80`. **Evidence:** lifecycle trace.

Wishlist loading depends only on the `user` object. After visiting Saved once, changing a heart on a property page and returning to the retained tab does not refetch the wishlist. Use focus-based refresh or shared invalidation after wishlist mutations.

### 22. [P2] Document download URLs use HTTP behind a TLS proxy

**Location:** `server/src/routes/document.routes.ts:45`; `server/src/index.ts` middleware setup. **Evidence:** conditional static trace.

Links use `req.protocol`, but Express proxy trust is not configured. With TLS terminated at a reverse proxy and HTTP forwarded to Node, document links become `http://...` even when the app/API is HTTPS. Unlike photo uploads, the document route does not honor `PUBLIC_API_URL`. Links may be blocked or expose the bearer query token over HTTP. Build links from a validated configured public origin, or configure proxy trust to match the deployment.

### 23. [P2] Offer errors are rendered behind the still-open modal

**Location:** `app/components/PropertyWorkspaceScreen.tsx:97–101`. **Evidence:** component-tree trace.

The error text lives on the underlying property page. Failed submissions leave the offer modal open, and the modal contains no error display. A network failure or self-offer rejection therefore appears to do nothing. Render submission errors inside the offer sheet and retain the entered amount for retry.

### 24. [P2] Workflow regression test never reaches verification checks

**Location:** `server/src/scripts/testWorkflow.ts:47–57`. **Evidence:** executed and failed.

The draft fixture has no photo, but `/submit` now requires one. The first intended successful submission returns 400, preventing the later correction, approval, concurrency and document checks from running. Add a valid photo fixture/upload before submission and cover the missing-photo rejection separately. The second property fixture needs the same treatment.

### 25. [P2] Review UI enables approval without required notes

**Location:** `app/components/PropertyWorkspaceScreen.tsx:165–172`; `server/src/routes/advisor.routes.ts:54` (notes validation). **Evidence:** client/server validation comparison.

With a signature and all checks selected, the UI says “All set” and enables approval even if notes are empty. The server requires at least five characters for every decision, including approval, so that action fails. Include notes in the approval requirements and readiness message.

### 26. [P2] URL maintenance script logs database credentials

**Location:** `server/fixUrls.ts:8`. **Evidence:** static; script was not executed.

The script prints `MONGO_URI` verbatim. When it includes credentials, they are copied into terminal or CI logs. Log connection status or a redacted host/database instead.

## Type-check failures

These six diagnostics are independently verified and block a clean frontend type check:

| File | Problem |
|---|---|
| `app/app/(tabs)/saved.web.tsx:59` | Numeric `roadWidth` assigned to a string-only field |
| `app/app/(tabs)/saved.web.tsx:426` | `SavedPropertyItem` does not declare `image` |
| `app/components/MarketplaceScreen.tsx:95` | `AppTheme.shadows.medium` does not exist |
| `app/components/PublicPropertyDetails.tsx:40` | `Listing` passed where `Property` requires `id` |
| `app/components/PublicPropertyDetails.tsx:57` | `AppTheme.shadows.medium` does not exist |
| `app/components/VerifiedHomeScreen.tsx:85` | Referenced `smallCircle` style does not exist |

The lint diagnostics are preserved separately; they should not all be interpreted as independent runtime bugs. Several are React compiler/hook rules or unused declarations.

## Suggested repair order

1. Close file traversal and private-data disclosures; fix refresh-token hashing and fail-closed secret configuration.
2. Unify eligibility checks and active-reviewer assignment; normalize profile DTOs.
3. Repair broken admin queries/routes and account-state cleanup.
4. Restore the workflow test and frontend type/lint checks; then verify the messaging, saved-list and modal fixes in web and native runtimes.
