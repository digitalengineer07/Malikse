# MalikSe Implementation Context

This document records only the work currently implemented in the MalikSe repository. It is intended as a handoff reference for future development.

## Project Structure

```text
malikse/
├── app/       # Expo / React Native application, including web support
├── server/    # Express, TypeScript, and MongoDB backend
├── website/   # Reserved for a future standalone website
├── MalikSe_Requirements.md
└── README.md
```

The Expo application and backend server have been separated into their own child folders. The `website` folder is reserved for later work.

## Authentication and Accounts

- Registration and login use the real backend API.
- Passwords are hashed with bcrypt.
- Authentication uses JWT access and refresh tokens.
- Protected backend routes require a valid bearer token.
- Dummy login behavior was removed.
- A newly registered person receives the single `user` role. Registration does not ask the person to choose buyer or seller because the same account can browse and list properties.
- Users are signed in after successful registration.
- Login opens the verified-property marketplace instead of a dashboard.
- The Profile action opens the dashboard associated with the signed-in role.
- The account profile displays backend user data and includes logout.
- KYC is explicitly implemented as a dummy/demo state only; it does not perform real identity verification.

## Admin Seed and Staff Accounts

The backend contains an idempotent Admin seed script at `server/src/scripts/seedAdmin.ts`.

The configured development Admin is:

- Name: `Admin`
- Mobile: `1111111111`
- Password: `admin123`

The values are read from `server/.env` through `ADMIN_NAME`, `ADMIN_MOBILE`, and `ADMIN_PASSWORD`. `ADMIN_EMAIL` is optional. Run the seed with:

```bash
npm --prefix server run seed:admin
```

The Admin can create Advisor and Verifier accounts. Public registration cannot create Admin, Advisor, or Verifier accounts. Staff use the normal login screen with credentials created by the Admin.

## Implemented Roles and Dashboards

### User

- Browse published, verified properties.
- Create and save property drafts.
- Submit a property for Advisor verification.
- View personal listings and their current verification status.
- Edit and resubmit a draft or a listing returned for correction.
- Open account details and log out.

### Advisor

- View assigned Advisor review tasks.
- Claim an unassigned Advisor task.
- Inspect the submitted property, seller details, parcel boundary, optional documents, and verification history.
- Submit a signed checklist/report.
- Approve the property, request corrections, or reject it.
- Advisor approval moves the property to Verifier review and does not publish it.

### Verifier

- View assigned Verifier review tasks.
- Claim an unassigned Verifier task.
- Inspect property information, previous Advisor review, optional documents, parcel boundary, and history.
- Submit a signed checklist/report.
- Approve the property, request corrections, or reject it.
- Final Verifier approval publishes the property as verified.

### Admin

- Create Advisor and Verifier accounts.
- View role and workflow totals.
- View properties and their complete verification history.
- Assign or reassign pending Advisor and Verifier work.
- Inspect property and review details.
- Admin cannot bypass the required final Verifier approval to publish a property.

## Property Listing Flow

The listing UI is implemented as a lightweight three-step flow:

1. Enter property and ownership details.
2. Select the property location and draw its parcel boundary.
3. Add optional ownership documents, accept consent, and submit.

Property documents are optional. A listing can be submitted without document uploads.

The implemented property statuses are:

- `draft`
- `pending`
- `advisor_verified`
- `correction_required`
- `rejected`
- `verified`
- `sold`

The implemented workflow is:

```text
Draft
  → Pending Advisor verification
  → Pending Verifier approval
  → Verified and published
```

At either review stage, a reviewer can request a correction or reject the property. A correction returns the listing to the seller. After the seller edits and resubmits it, Advisor review starts again. Previous reports and status changes remain in the verification history.

New submissions are assigned to the available Advisor with the smallest pending queue. Advisor approval similarly assigns an available Verifier. If no matching staff account exists, the task remains unassigned and can be claimed later or assigned by an Admin.

Only properties with completed Advisor and Verifier approvals are returned by public property search and shown as published listings.

## Workflow Protection

- Only the property owner can edit a draft or correction-required listing.
- Submitted and published properties cannot be silently edited.
- Advisor actions are restricted to properties in the Advisor stage.
- Verifier actions are restricted to properties that already passed Advisor review.
- Reviewer decisions use document-version checks to prevent duplicate approvals and concurrent overwrites.
- Verification history records the actor, role, timestamp, previous status, new status, action, and report snapshot.
- Public property responses omit private seller details, documents, and internal review history.
- Offers can only be created for published verified properties.

## Documents

- Property document upload is optional.
- Uploaded document access is protected.
- The property owner, assigned reviewers, and Admin can access the relevant documents.
- Document downloads use expiring protected links.
- Buyers and public marketplace visitors do not receive private ownership documents.

## Maps and Parcel Display

- Listing creation provides a map for selecting and drawing the property parcel.
- The reusable map picker and map preview use the same shared parcel-map configuration from `app/src/utils/parcelMap.ts`.
- Property views display only the saved property parcel boundary on the map.
- Read-only property maps do not show unrelated property pins or place markers.
- If a property has no saved boundary, the UI states that no parcel boundary was recorded.
- The listing editor retains boundary drawing handles and measurements required to create or edit a parcel.

## Frontend Routing and UI Flow

- Registration no longer contains Buyer/Seller selection cards.
- Login and registration route to the verified-property marketplace.
- Marketplace results are loaded from the backend and contain only published verified properties.
- The Profile action routes to the dashboard for the current role.
- Role dashboards link to real property queues and account/profile screens.
- Seller, Advisor, Verifier, and Admin screens use the backend workflow and status values.
- The profile screen includes logout and clears the authenticated session.

## Backend Endpoints Implemented

The backend exposes implemented routes under:

- `/auth` for registration, login, token refresh, account profile, and demo KYC state.
- `/properties` for public verified search, owner listings, drafts, updates, submission, and protected property details.
- `/verification` for Advisor and Verifier queues, task claiming, and review reports.
- `/admin` for staff management, dashboard totals, property tracking, and reviewer assignment.
- `/documents` for protected property-document upload and download.
- `/deals` for verified-property offer operations.

## Validation Completed

- The backend workflow test passed with 60 HTTP assertions plus database state, concurrency, access-control, and history checks.
- The workflow test covers role restrictions, assignment, Advisor and Verifier correction loops, rejection, duplicate approval protection, optional documents, protected downloads, and final publication.
- Frontend TypeScript validation passed with `tsc --noEmit`.
- Targeted lint checks passed for the workflow and shared map files.
- Browser smoke testing covered Admin login, marketplace routing, dashboard access, property queues, property workspace, and logout.

Run the backend workflow test with MongoDB available:

```bash
npm --prefix server run test:workflow
```

## Current Implementation Limits

- KYC is a labeled demo implementation.
- Property documents are optional.
- The user interface is a functional workflow skeleton rather than a complete visual design.
- The standalone `website` application has not been built; only its folder is reserved.
- Real OTP delivery, payments, legal-title verification, and production media storage are not part of the current implementation.

## Verified home and public browsing UI

- `/home` is the entry destination after the opening screen and authentication. `/search` remains available for filtering.
- Home uses the public verified-property endpoint, with a Leaflet overview map on web. Price markers open full listings; property cards open a slide-up preview first.
- Property photos come from the backend. Missing photos are explicitly labeled; no substitute listing data is created.
- The public detail screen presents photos, price, area, disclosures, parcel map and the existing offer workflow. Private reviewer screens retain their existing workflow.
- The top header contains static branding and the language toggle. Saved is accessed from the user dashboard, not the bottom navigation.
- The dashboard has an architectural hero and bottom navigation. Its hero image is decorative.
- Saved-property routes no longer show seeded dummy listings. Account saving has no backend endpoint yet, and this limitation is shown in the UI.
- The home overview map is web-only, consistent with the existing parcel-map implementation. Native displays a fallback and listing cards.
