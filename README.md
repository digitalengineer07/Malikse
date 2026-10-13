# MalikSe — Verified Owner-to-Buyer Property Marketplace

See [the production readiness plan](PRODUCTION_READINESS_PLAN.md) for the complete endpoint audit, applied hardening, deployment configuration and remaining release gates.

The [10,000 RPS implementation plan](IMPLEMENTATION_PLAN_10000_RPS.md) specifies the ordered changes and qualification gates for one Hostinger Business API deployment with MongoDB Atlas.

MalikSe uses four roles: **User** (buying and selling), **Advisor**, **Verifier**, and **Admin**.

## Current account and verification flow

- Login and registration open the verified marketplace. The Profile button opens the signed-in account's role dashboard; **My profile** there opens account details and logout.
- Users complete the explicitly labeled demo KYC step, then fill in property details, location/boundaries, and optional ownership documents. Web supports boundary drawing; mobile supports GPS capture or manual coordinates.
- The final submission saves a draft, uploads photos and optional documents, then durably queues the submitted details. The app shows the queued state until a worker assigns Advisor review. Failed uploads retain the draft.
- New submissions are assigned to available Advisors in round-robin order. Advisor approval assigns an available Verifier using a separate round-robin counter. Corrections retain the previous Advisor when that account remains eligible. If no reviewer exists, the property stays unassigned and can be claimed after a staff account is created. Admin can assign or reassign pending reviews.
- Advisors and Verifiers see their assigned properties, seller records, protected documents, checklists and reports. Unassigned queues show only summaries until claimed.
- Both stages can approve, request corrections, or reject with signed notes. Seller corrections restart Advisor review; previous reports remain in history. Rejected listings cannot be resubmitted through this flow.
- Only final Verifier approval publishes a listing. Public search and details require both recorded approvals and expose neither private seller contact details nor documents/reports. Fully Verified is not a legal-title guarantee.
- Submitted or published listings cannot be silently edited. Reviewer decisions use version checks, preventing duplicate approvals or concurrent overwrites. History stores actor, role, timestamp, old/new status and report snapshots.
- Ownership documents are optional and restricted to the owner, assigned reviewers and Admin, with expiring download links. KYC remains a demo. OTP, payments, legal title guarantees and other planned requirements are not implemented by this workflow.

### Roles

- **User:** browse, create listings, correct/resubmit and track reviews.
- **Advisor:** first-stage review; cannot publish.
- **Verifier:** final review and publication after Advisor approval.
- **Admin:** create staff accounts, assign reviews and inspect all property history; cannot bypass final Verifier approval.

### Verify the workflow

With MongoDB available, run `npm --prefix server run test:workflow`. The test uses a uniquely named temporary database and deletes only its own test database and uploaded fixture when finished. It exercises role restrictions, assignment, both correction loops, duplicate approvals, optional documents, protected downloads and publication.

Run `npm --prefix server run test:security` for the audit regression suite. It also uses a unique temporary database and checks private-data access, photo traversal, token replay/concurrent rotation, active-reviewer assignment, profile validation, deal transitions, document-link revocation and unread-message tracking. Downloads in both suites stay on their local test server.

## 🛠 Tech Stack

- **Frontend**: React Native (Expo SDK 57), TypeScript, Expo Router.
- **Web Support**: React Native Web with Leaflet integration for property pins.
- **State Management**: Zustand (Auth, Language, Listing Filters).
- **Backend**: Node.js (Express) REST API.
- **Database**: MongoDB (via Mongoose) for users, properties, deals, and document metadata.
- **Authentication**: JWT-based session management (Access + Refresh token rotation) with bcrypt hashing.

## 🏗 Project Structure

```text
malikse/
├── app/                 # Mobile application (Expo / React Native for Android & iOS)
│   ├── app/             # App screens & navigation
│   ├── components/      # Mobile UI components
│   ├── src/             # Services, stores, types
│   └── package.json     # App dependencies and commands
├── website/             # Standalone website application (Web interface)
│   ├── app/             # Website routes & pages
│   ├── components/      # Website UI components
│   ├── src/             # Services, stores, types
│   └── package.json     # Website dependencies and commands
└── server/              # Node.js + Express backend
    ├── src/             # API routes, models, middleware
    └── package.json     # Backend dependencies and commands
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account (or local MongoDB)

### Setup Instructions

1. **Install Dependencies**:
   ```bash
   # Install frontend dependencies
   npm --prefix app install

   # Install backend dependencies
   npm --prefix server install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the `server` directory and fill in your credentials:
   ```env
   # JWT Secrets
   JWT_ACCESS_SECRET=<unique-private-random-secret>
   JWT_REFRESH_SECRET=<different-private-random-secret>

   # MongoDB
   MONGO_URI=your_mongodb_connection_string
   PORT=5000
   ```
   Supply actual random signing secrets; the server rejects missing secrets, known development defaults and matching access/refresh secrets. For production, also set `NODE_ENV=production` and `PUBLIC_API_URL=https://your-api-host.example` to the API's externally reachable HTTPS origin (no path). Set `PUBLIC_API_URL` behind a TLS proxy even outside production so document/photo URLs use the correct scheme. It is deliberately not inferred from untrusted forwarding headers.

   The audit fixes replace bcrypt refresh-token hashes with full-token digests and atomic rotation. Existing refresh sessions must sign in again after the upgrade. Existing access tokens retain their normal expiry. Inquiry read timestamps need no migration; old incoming messages start unread until viewed. Seller/buyer phone numbers are no longer exposed through inquiries; conversations continue inside the app.
   Set `ADMIN_NAME`, `ADMIN_MOBILE`, and `ADMIN_PASSWORD` (at least 6 characters) in `server/.env` to create the first Admin. `ADMIN_EMAIL` is optional. Configure the app API address in `app/.env`; the example is in `app/.env.example`. Expo Go on a phone uses the Metro host for a localhost API URL, so the phone and server should be on the same network.

   Create the Admin once:
   ```bash
   npm --prefix server run seed:admin
   ```
   The seed is idempotent for the configured Admin mobile and does not overwrite an existing password.

3. **Start the Backend Server**:
   ```bash
   npm --prefix server run dev
   ```

4. **Run the Standalone Website**:
   ```bash
   npm --prefix website run dev
   ```
   Starts the website on `http://localhost:8082`. Any UI changes made in `website/` will only affect the website and will not alter the mobile app UI.

5. **Run the Mobile Application**:
   ```bash
   # Start Expo bundler (Expo Go / QR code)
   npm --prefix app start

   # Run on Android emulator / device
   npm --prefix app run android
   ```
   Any UI changes made in `app/` will only affect the mobile application and will not alter the website UI.

Users register from the app and are signed in immediately. The Admin signs in with the seeded mobile number and password, then clicks Profile and opens **Advisors and Verifiers** on the Admin dashboard to create staff accounts. Staff sign in through the same login screen with the credentials the Admin set. Registration does not create staff or Admin accounts.

---
**Note:** This project is adapted from an earlier GIS/drone codebase (Landroid). All previous mapping layers and AI modules have been removed to focus entirely on the verified property marketplace functionality.

## Submission workers, secondary indexes and search cache

The queue and shared assignment counters use MongoDB, so no Redis service is required. The job is embedded in the property: `POST /properties/:id/submit` atomically changes its status to `queued` and returns **202 Accepted**. Draft details and file uploads are saved before this step. Queued details cannot be edited. The existing private workspace endpoint exposes progress; My listings refreshes automatically while queued.

Workers lease jobs for 60 seconds, retry failures with exponential backoff and jitter up to five attempts, and fence completion writes using a unique lease token. Expired leases can be recovered after a restart. Exhausted jobs return to `correction_required` with feedback, allowing the seller to check and resubmit. Queue acceptance includes a SHA-256 digest of the submitted details in the audit trail. Passwords continue to use bcrypt and refresh tokens use SHA-256 digests.

By default, each API instance runs one worker, polling each second and processing at most ten jobs per poll. For separate worker deployment, set `SUBMISSION_WORKER_ENABLED=false` on the API and run `npm --prefix server run worker:submissions` against the same MongoDB database. After a production build, use `node server/dist/scripts/submissionWorker.js` with the server environment loaded. Keep at least one worker running. Multiple workers may run safely; no strict global FIFO ordering is promised during retries.

Round-robin counters persist per role and are incremented atomically. Only active, unsuspended staff with login credentials qualify. With an unchanged eligible roster, new assignments rotate evenly. Corrections that retain a reviewer do not consume a turn. Retries, concurrent review conflicts, manual assignments and roster changes can affect exact totals. No eligible reviewer leaves work unassigned for claim or Admin assignment.

Three additive MongoDB secondary indexes support location/title text search, property type with newest-first ordering, and price ranges. Startup builds missing named indexes for existing data before accepting traffic; no old indexes are dropped. The queue also has a polling index. Text search now matches indexed words (including district, state, block, mauza and title), rather than arbitrary substrings. Price ranges combined with newest-first sorting may still require an in-memory sort; index presence is not a throughput guarantee.

Search returns an array with `page` (1–100) and `limit` (1–100, default 100), ordered by `createdAt` and `_id` descending. Both browse screens use 50-result pages. This is bounded offset pagination; concurrent publications can move results between pages.

The shared MongoDB cache keeps only candidate IDs for 15 seconds, keyed by a SHA-256 hash of normalized filters and pagination. TTL expiry is checked explicitly, independently of MongoDB cleanup timing. Current public details, filters, approvals and seller availability are rechecked for every response, including cache hits. Publication invalidates cached searches; a concurrent refill, account reactivation or out-of-band update can delay discovery by up to the TTL. Private workspaces and documents are never cached. `X-Search-Cache: HIT/MISS` reports cache use. Identical misses share work within each process, with at most 50 distinct in-flight fills per process; cache read/write failures fall back to authoritative search. This reduces repeated search work but still requires database reads on a hit.

Run `npm --prefix server run test:infrastructure` for isolated temporary-database tests of concurrent assignment, queue leases/retries, cache expiry/privacy, filter validation and secondary-index execution plans. Also run the workflow and security suites. These checks validate correctness on fixtures, not production capacity.

## Local performance fixes

See [PERFORMANCE_FIXES.md](PERFORMANCE_FIXES.md) for implemented changes, current benchmark results, API pagination changes and deployment prerequisites. The original measurements remain in [LOCAL_BOTTLENECK_REPORT.md](LOCAL_BOTTLENECK_REPORT.md).
