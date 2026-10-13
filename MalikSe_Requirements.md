# MalikSe — Functional Requirements

### Verified Owner-to-Buyer Property Marketplace

## 1. User Roles

The system shall support exactly four roles:

1. **User**
2. **Advisor**
3. **Verifier**
4. **Admin**

### 1.1 User

A registered User can perform both buyer and seller activities.

The User can:

* Browse publicly listed properties without logging in.
* Register/login to the platform.
* Add properties to Wishlist after registration.
* Complete KYC verification.
* List a property for sale after completing KYC.
* Purchase a property after completing KYC.
* Search and filter properties.
* View property details.
* Contact the seller through the platform.
* Submit offers.
* Track their property listings and transactions.
* View the verification status of their own property.
* Manage their profile and documents.

A User does **not** need an account simply to browse publicly available property listings.

---

# 2. Authentication & Registration

### FR-2.1 Public Browsing

Users shall be able to:

* Open the website without logging in.
* Search properties.
* Filter properties.
* View publicly available property information.
* View verified property information and verification badges.

### FR-2.2 Registration

Registration shall be required for:

* Adding a property to Wishlist.
* Listing a property.
* Buying a property.
* Making an offer.
* Contacting the owner where authentication is required.
* Booking a site visit.
* Other transaction-related activities.

### FR-2.3 Login

The system shall support:

* Mobile OTP authentication.
* Email verification.
* Secure session/token management.
* Role-based access control.

---

# 3. User KYC

KYC shall be mandatory for users who want to buy or sell property.

### FR-3.1 KYC Requirement

A User must complete KYC before:

* Listing a property for sale.
* Purchasing a property.
* Proceeding with a property transaction.

### FR-3.2 KYC Information

The system may collect:

* Name
* Address
* Profile photo
* PAN/KYC documents
* Required ownership/identity documents

### FR-3.3 Property Ownership Verification

For a seller, the system shall verify that the identity of the User matches the relevant ownership/registry documents.

### FR-3.4 Joint Ownership

The system shall support multiple joint owners for a single property.

### FR-3.5 Consent

The User shall digitally accept:

* Consent documents
* Terms & Conditions
* Seller declaration where applicable

### FR-3.6 Aadhaar

Any collection or storage of Aadhaar information shall be implemented only after appropriate legal and data-protection review.

---

# 4. Property Listing

Only a KYC-completed User shall be able to create a property listing.

### FR-4.1 Property Information

The seller shall provide:

* Property type

  * Land
  * Flat
  * House
  * Shop
  * Office
* State
* District
* Block/Circle
* Mauza
* Police-station number
* Khata number
* Khesra/Plot number
* Holding number
* Total area
* Sellable area
* Boundary details
* Road width
* Price
* Negotiable/non-negotiable status
* Google Maps location/GPS coordinates

### FR-4.2 Property Media

The seller shall be able to upload:

* Property photographs
* Videos
* Drone footage

### FR-4.3 Property Documents

The seller shall upload applicable documents including:

* Registry documents
* Mutation/Dakhil-Kharij
* Rent/Lagan receipt
* LPC/Jamabandi
* Property map
* Other ownership documents

### FR-4.4 Property Declaration

The seller shall disclose:

* Existing loans
* Property disputes
* Possession issues
* Other relevant ownership/property issues

---

# 5. Property Visibility & Status

A newly submitted property shall not immediately become publicly visible as an approved listing.

The property shall move through defined verification states.

### Property Status Flow

**Draft → Submitted → Advisor Verification → Advisor Correction Required / Advisor Rejected / Advisor Verified → Verifier Verification → Verifier Correction Required / Verifier Rejected / Fully Verified → Published**

Only properties that successfully complete the required verification process shall receive the **Fully Verified** status.

The system shall maintain the complete verification history.

---

# 6. Two-Level Property Verification

Every seller property shall go through two verification stages:

### Stage 1 — Advisor Verification

The Advisor shall verify the property and supporting information.

The Advisor may check:

* Owner identity
* Ownership documents
* Registry information
* Document clarity
* Property location
* Actual possession
* Road/access availability
* Boundary details
* Property area
* Joint-owner consent
* Declared disputes
* Existing loans/mortgages
* Other required property information

The Advisor shall:

* Visit the property where required.
* Perform GPS check-in.
* Capture GPS-tagged photographs/videos.
* Complete the verification checklist.
* Prepare an inspection report.
* Digitally sign/submit the verification report.
* Mark the property as:

  * **Verified by Advisor**
  * **Correction Required**
  * **Rejected**

Only an Advisor-verified property can proceed to the Verifier.

---

# 7. Verifier Verification

The Verifier performs the second and final property verification stage.

The Verifier shall review:

* Property documents.
* Information submitted by the seller.
* Advisor verification report.
* Advisor's site inspection information.
* Property location.
* Ownership information.
* Boundary and area information.
* Other required verification details.

The Verifier shall be able to:

* Approve the property.
* Request corrections.
* Reject the property.

### Final Verification

If the Verifier approves the property:

**Property Status = Fully Verified**

The system shall then make the property eligible for public verified listing.

The system shall store:

* Advisor who verified the property.
* Advisor verification date/time.
* Verifier who verified the property.
* Verifier verification date/time.
* Verification reports.
* Verification history.

---

# 8. Advisor Role

The Advisor shall have a dedicated dashboard/mobile-friendly panel.

The Advisor can:

* Login to the Advisor dashboard.
* View assigned properties.
* View seller information required for verification.
* Contact the seller.
* Navigate to the property using maps.
* Perform GPS check-in.
* Upload site photographs/videos.
* Complete verification checklists.
* Review property documents.
* Create an inspection report.
* Digitally sign the report.
* Request corrections.
* Reject a property.
* Verify a property.
* View previously completed verification tasks.

The Advisor cannot perform the final verification of their own verification work.

---

# 9. Verifier Role

The Verifier shall have a dedicated dashboard.

The Verifier can:

* Login to the Verifier dashboard.
* View properties awaiting final verification.
* View Advisor verification reports.
* View uploaded property documents.
* Review Advisor site inspection information.
* Review property details.
* Request corrections.
* Reject properties.
* Approve properties as Fully Verified.
* View verification history.

The Verifier shall be responsible for the **final verification stage**.

---

# 10. Admin Role

The Admin shall have complete administrative control over the platform.

### FR-10.1 User Management

Admin shall be able to:

* View all registered Users.
* View User profiles.
* View KYC status.
* View seller/buyer activity.
* Block/suspend users where required.
* View user property listings.
* View transaction information.

### FR-10.2 Advisor Management

Admin shall be able to:

* Register Advisors.
* Create Advisor accounts.
* Activate/deactivate Advisors.
* View all Advisors.
* View Advisor workload.
* View Advisor verification history.
* See which properties were verified by each Advisor.

### FR-10.3 Verifier Management

Admin shall be able to:

* Register Verifiers.
* Create Verifier accounts.
* Activate/deactivate Verifiers.
* View all Verifiers.
* View Verifier workload.
* View Verifier verification history.
* See which properties were finally verified by each Verifier.

### FR-10.4 Property Management

Admin shall be able to:

* View all properties.
* View verified properties.
* View unverified/pending properties.
* View rejected properties.
* View properties awaiting Advisor verification.
* View properties awaiting Verifier verification.
* View property documents.
* View verification reports.

### FR-10.5 Verification Tracking

For every property, Admin shall be able to see:

| Information                | Admin can see |
| -------------------------- | ------------- |
| Seller                     | Yes           |
| Property                   | Yes           |
| Property status            | Yes           |
| Advisor                    | Yes           |
| Advisor verification date  | Yes           |
| Advisor report             | Yes           |
| Verifier                   | Yes           |
| Verifier verification date | Yes           |
| Verifier report            | Yes           |
| Correction history         | Yes           |
| Rejection history          | Yes           |
| Complete audit history     | Yes           |

---

# 11. Public Property Search

Property browsing shall not require login.

A visitor shall be able to:

* Search properties.
* Filter properties by location.
* Filter by price/budget.
* Filter by property type.
* Filter by area.
* View property details.
* View property photos/media.
* View property location on a map.
* Filter for Fully Verified properties.

Sensitive seller information and protected documents shall not be publicly exposed.

---

# 12. Wishlist

A visitor can browse properties without an account.

However, adding a property to Wishlist shall require registration/login.

### Wishlist Flow

**Visitor → Click Wishlist → Login/Register → Add Property to Wishlist**

A registered User shall be able to:

* Add properties to Wishlist.
* Remove properties from Wishlist.
* View saved properties.

---

# 13. Buying Property

A User must have a completed KYC before proceeding with the purchase process.

The buyer shall be able to:

* Search properties.
* View property details.
* Contact the owner through the platform.
* Request a site visit.
* Ask questions.
* Submit an offer.
* Receive offer responses.
* Accept/reject applicable deal terms.
* Proceed with token/payment processes where enabled.
* Track transaction status.

---

# 14. Selling Property

A User must have:

1. A registered account.
2. Completed KYC.
3. Required ownership/property documents.

The seller can then:

* Create a property listing.
* Upload property documents.
* Submit the property for verification.
* Respond to Advisor correction requests.
* View Advisor verification status.
* Respond to Verifier correction requests.
* View final verification status.
* Receive buyer offers.
* Accept, reject, or counter an offer.

---

# 15. Owner–Buyer Communication

The seller's personal mobile number shall not be publicly displayed by default.

The system shall provide controlled communication between buyer and seller.

Features may include:

* Contact request
* In-app chat
* Call functionality
* Site visit request
* Video meeting
* Advisor participation where required

The system shall maintain appropriate communication records.

---

# 16. Offer & Deal Management

The system shall support:

* Buyer offer submission.
* Seller Accept/Reject/Counter-Offer.
* Digital consent.
* Deal status tracking.
* Token payment where enabled.
* Payment receipts.
* Commission calculation.
* Deal confirmation.
* Commission invoice.
* Probable registry date.
* Sold status after deal completion.
* Cancellation/refund rules.

The current business requirement specifies a **1% commission + applicable tax**, which should be displayed to the parties before deal processing.

---

# 17. Verification Badges

The system may display separate verification indicators such as:

* Identity Verified
* Ownership Documents Checked
* Site Visited
* Advisor Verified
* Verifier Verified
* Fully Verified

The platform shall clearly explain what each badge means.

**"Fully Verified" must not be represented as a guarantee of legal title.**

---

# 18. Admin Dashboard

The Admin dashboard shall provide:

### Users

* Total Users
* KYC-completed Users
* Pending KYC
* Blocked Users

### Advisors

* Total Advisors
* Active Advisors
* Assigned verification tasks
* Completed verification tasks

### Verifiers

* Total Verifiers
* Active Verifiers
* Pending final verifications
* Completed final verifications

### Properties

* Total properties
* Pending properties
* Advisor verification pending
* Verifier verification pending
* Fully Verified properties
* Rejected properties
* Sold properties

### Verification Tracking

Admin shall be able to trace:

**Property → Seller → Advisor → Advisor Report → Verifier → Final Verification → Current Status**

---

# 19. Audit Trail

The system shall maintain an audit trail for important activities.

The audit trail should record:

* User who performed the action.
* Role of the user.
* Action performed.
* Property/user affected.
* Date and time.
* Previous status.
* New status.
* Relevant verification report/document.
* Correction/rejection reason where applicable.

This allows Admin to determine exactly who performed each verification action.

---

# 20. Role Permission Summary

| Feature                    |     User     |    Advisor    |    Verifier   | Admin |
| -------------------------- | :----------: | :-----------: | :-----------: | :---: |
| Browse properties          |       ✓      |       ✓       |       ✓       |   ✓   |
| Register                   |       ✓      | Admin creates | Admin creates |   ✓   |
| Login                      |       ✓      |       ✓       |       ✓       |   ✓   |
| Wishlist                   |       ✓      |       —       |       —       |   ✓   |
| Complete KYC               |       ✓      |       —       |       —       |  View |
| List property              |       ✓      |       —       |       —       |  View |
| Buy property               |       ✓      |       —       |       —       |  View |
| Advisor verification       |       —      |       ✓       |       —       |  View |
| Final verification         |       —      |       —       |       ✓       |  View |
| Request correction         |       —      |       ✓       |       ✓       |   ✓   |
| Reject property            |       —      |       ✓       |       ✓       |   ✓   |
| View all users             |   Own data   | Assigned data | Assigned data |   ✓   |
| Manage Advisors            |       —      |       —       |       —       |   ✓   |
| Manage Verifiers           |       —      |       —       |       —       |   ✓   |
| View all properties        | Own listings |    Assigned   |    Assigned   |   ✓   |
| View verification history  | Own property |    Own work   |    Own work   |   ✓   |
| View who verified property | Own property |    Own work   |    Own work   |   ✓   |
| Manage platform            |       —      |       —       |       —       |   ✓   |

---

# 21. Core Property Verification Workflow

The complete workflow shall be:

**User Registration**

↓

**User Completes KYC**

↓

**User Creates Property Listing**

↓

**Property Submitted**

↓

**Advisor Assigned**

↓

**Advisor Checks Documents & Property**

↓

**Advisor Site Visit**

↓

**Advisor Verification Report**

↓

**Advisor Approves / Correction Required / Rejects**

↓

**If Approved → Verifier Review**

↓

**Verifier Reviews Property + Advisor Report**

↓

**Verifier Approves / Correction Required / Rejects**

↓

**Fully Verified**

↓

**Property Published**

↓

**Buyer/User Browses Property**

↓

**KYC Required for Purchase**

↓

**Offer / Deal Process**

↓

**Property Sold**

---

# 22. Security & Data Protection

The system shall:

* Use HTTPS/SSL.
* Enforce role-based access control.
* Protect KYC documents.
* Encrypt sensitive data at rest and in transit.
* Watermark sensitive uploaded documents.
* Prevent unauthorized downloading of registry documents.
* Maintain secure document access.
* Require 2FA for Admin accounts.
* Maintain an immutable audit trail.
* Restrict Advisors and Verifiers to their permitted verification data.

---

# 23. Important Business Rule

The system must distinguish between:

**Public Property Visibility** and **Transaction Eligibility**.

A visitor may browse properties without logging in.

However:

**Wishlist → Registration required**

**Sell Property → Registration + KYC required**

**Buy Property → Registration + KYC required**

**Property Verification → Advisor → Verifier**

**Final Property Approval → Verifier**

**Advisor/Verifier Management → Admin**

**Complete Verification History → Admin**

---

# 24. Current Role Hierarchy

The system shall use the following operational structure:

**ADMIN**
↓
**ADVISOR + VERIFIER**
↓
**USER**
    ↳ Buyer
    ↳ Seller

Buyer and Seller are **not separate system roles**. They are two activities that the same registered User can perform.
