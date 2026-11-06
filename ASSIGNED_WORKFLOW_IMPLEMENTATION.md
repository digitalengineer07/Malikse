# Assigned staff marketplace implementation

## Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Public browsing, search, maps and details require no login; only verified, available properties are discoverable. |
| FR-02 | Separate trending, newly published and personalized recommendation feeds. Personalization uses search preferences and wishlist; guests use locally stored preferences. |
| FR-03 | Sign-in is required for wishlist and account actions; approved KYC gates selling, offers and buyer chat. |
| FR-04 | Private KYC upload supports pending, approved, correction and rejection states. Existing Admin identity review records the decision and notes. |
| FR-05 | Sellers supply details, location, photos, optional ownership documents, declaration and optional Advisor ID. Failed uploads retain the created draft. |
| FR-06 | A valid supplied Advisor receives the submission; otherwise an eligible Verifier receives it. Unavailable explicitly supplied IDs show an error. No staff availability leaves work queued/unassigned. |
| FR-07 | One assigned reviewer checks the property and approves, requests correction or rejects. Approval publishes; correction edits and resubmits the same listing with history preserved. |
| FR-08 | Offers and buyer chats go to the currently assigned Advisor or Verifier. Owners cannot access buyer conversations or perform offer transitions. |
| FR-09 | Buyer and assigned staff negotiate with recorded amounts and history. A party cannot accept its own counterproposal. |
| FR-10 | Acceptance atomically reserves one deal. Cancellation releases it. Assigned staff completion marks the property sold and closes competing offers. |
| FR-11 | Sold properties cannot receive new offers/chat messages or appear as available recommendations/search results. Existing conversation history is read-only. |
| FR-12 | Preserve Admin profile, property, staff registration, suspension, assignment, transactions and audit facilities. |
| FR-13 | Website first, then app screens follow the supplied ten HTML references with live API data, validation and loading/error/empty states. |

## Nonfunctional requirements and implementation

- Authorization is enforced in API routes, including current staff assignment after reassignment, active accounts, KYC and participant access.
- Public property projections exclude private owner details and verification evidence. KYC downloads require authorization or an expiring, single-use ticket with actor access rechecked.
- MongoDB transactions prevent competing reservations, concurrent sale closure and message/assignment races. Offer request keys protect retries.
- Durable notification records cover deal and message events; a leased worker retries delivery with backoff.
- Paginated lists and indexed public queries bound normal reads. Trending deduplicates daily signals and retains engagement for 30 days.
- Responsive React Native screens support website and app; semantic labels, disabled states and keyboard-aware forms are included. Full accessibility certification and device testing remain release checks.
- Review and deal history retain actors, timestamps and decisions. Migration defaults to read-only reporting.

## Implementation order and files

1. Backend: single reviewer assignment/publication; staff-only chats and offers; transactional reservations and sale closure; KYC upload/review; recommendation feeds; notification outbox.
2. Website: `website/components/MalikseMarketplace.tsx` and corresponding routes implement home, search/map, post, profile, listings, KYC, wishlist, chats, detail and deal screens.
3. App: `app/components/MalikseMarketplace.tsx` and routes apply the same behavior with native safe areas and keyboard handling.
4. Integration: adapted original workflow/security tests and added `server/load/test-assigned-workflow.cjs` for the new end-to-end rules.

## Recommendation rules

New sorts by first publication (legacy fallback: creation date). Trending uses the last seven days: view 1, search-result engagement 2, saved property 5, with daily actor/property/kind deduplication. Personalized results combine saved property location/type/budget with recent search preferences; recent verified properties fill sparse results. All modes apply public availability and active-owner eligibility. These initial weights are fixed in code, not an Admin setting.

## Rollout sequence

1. Back up the database and rehearse migration against a staging copy. Confirm replica-set transaction support and eligible staff accounts.
2. Run `npm --prefix server run db:migrate-assigned-workflow` for a dry run. Inspect affected listings and existing active deals before applying.
3. In a maintenance window run `npm --prefix server run db:migrate-assigned-workflow -- --apply`. Legacy dual assignments retain the Verifier, and intermediate `advisor_verified` listings return to pending single review. Historical reports are preserved.
4. Reconcile legacy accepted/completed deals and reservations explicitly before enabling new offer traffic. The property migration does not infer a winning buyer from historical deals. Legacy owner conversations remain stored but are excluded from new buyer/staff inboxes; they are never silently reassigned.
5. Create indexes with the repository index tooling; rebuild region counts. Deploy backend before website and app clients. Start submission and notification processing.
6. Smoke-test guest discovery, KYC upload/review, both assignment paths, correction, offer/counter/reservation, staff sale closure and sold removal. Monitor notification retries and unavailable staff.

## Verification and limits

Validated locally on 2026-11-06:

- Assigned workflow: 54 HTTP checks plus model assertions, including KYC ticket privacy and replay protection.
- Original workflow suite adapted to single review: 55 HTTP checks.
- Security regression: 81 HTTP/configuration checks plus model and unread-state assertions.
- Server build and both frontend TypeScript checks passed; website export and Android Hermes export passed.
- Browser verification: guest home recommendations, search/map/list, property details, protected-chat sign-in redirect, narrow-screen home layout.

The workflow test now creates local account fixtures instead of invoking registration SMS providers. Registration/OTP is covered by the separate existing OTP suite, which was not rerun for these changes. Android Expo export validates bundling, not an installed APK or physical-device behavior. No production migration or deployment has been performed.

The HTML files are design references; user-written requirements override conflicting owner-direct negotiation and dual-review text. KYC approval is manual, not an external identity-provider integration. Payments and automatic offer/reservation expiry are not implemented; there is no agreed expiry duration. Existing local demo KYC remains nonproduction-only on the server. Old production-readiness/load plans describe earlier architecture and must be requalified before a production rollout.

## Website runtime update

The website now uses Vite and React Router with browser APIs for file selection, geolocation, UUIDs and local storage. Expo SDK packages, Metro configuration and Expo route layouts have been removed from `website/`. Existing React Native Web UI components are retained. Website deployments use `VITE_API_BASE_URL` rather than `EXPO_PUBLIC_API_BASE_URL`; the app continues to use Expo independently. See `website/README.md`.
