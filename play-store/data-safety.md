# Data safety worksheet

Draft based on source inspection, not an importable Play Console CSV. Complete the actual Console questionnaire using the final Android build and deployed services. Do not submit unresolved fields as “No”.

## Top-level answers

| Question | Prepared answer |
| --- | --- |
| Does the app collect user data? | Yes. Account, KYC, listing, chat and activity data leave the device. |
| Is all user data encrypted in transit? | Unconfirmed. Verify API, media/document links, maps, email/auth and SDK endpoints in the production build. HTTPS in the EAS API setting alone is insufficient. |
| Can users request account deletion? | Not ready to claim. Implement and test the in-app and public web routes first. |
| Account creation methods | Email/mobile identifier and password are present; verification challenges exist. Verify which Google/Firebase login options are actually enabled before selecting additional methods. |
| Independent security review | No review established; do not claim certification. |

## Data types and purposes

“Optional” below means guests can use public browsing without providing that data, or can decline the related feature. It does not mean KYC is optional when making an offer. Confirm the Console definitions and final behavior. Persistent records below are not processed only ephemerally.

| Play data category/type | Evidence and collection | Purpose | Optionality / remaining verification |
| --- | --- | --- | --- |
| Personal info: name | User.name | Account management; app functionality | Optional for browsing; required for registration |
| Personal info: email address | User.email and registration/reset flows | Account management; developer communications | Depends on selected sign-in method |
| Personal info: phone number | User.mobile | Account management; verification | Depends on selected sign-in method |
| Personal info: user IDs | User IDs, account links on offers/chats/devices | Account management; app functionality | Optional for guest browsing |
| Personal info: address | Uploaded KYC/property ownership documents may contain a personal address | App functionality; fraud prevention, security and compliance where actually used | Optional feature; review accepted documents |
| Personal info: other info | KYC identity numbers, verification records and document contents | App functionality; identity verification/fraud prevention | Required for protected features; confirm exact document fields |
| Photos and videos: photos | Property photos and image KYC uploads | App functionality | User-initiated uploads |
| Photos and videos: videos | Property model has videos[] | App functionality | Confirm actual Android video upload/use before declaring collected |
| Files and docs | Identity and property PDFs/documents | App functionality; verification | User-initiated, necessary for review features |
| Messages: other in-app messages | Inquiry.message and messages[] | App functionality | Optional conversations; persisted on server |
| App activity: in-app search history | SearchPreference.searches | Personalization; app functionality | Confirm whether logged-out searches also leave device |
| App activity: app interactions | Engagement view/search/save events, wishlists | Personalization; app functionality; analytics for aggregate trending | Some guest events may be automatic; inspect actor generation before choosing optional |
| App activity: other user-generated content | Listing descriptions, review submissions and offer terms | App functionality | User-initiated |
| Financial info: other financial info | Offer amounts and negotiated deal terms | App functionality | User-initiated; no payment-card collection established |
| Financial info: purchase history | Completed Deal records | App functionality | Confirm actual completed-transaction records and category applicability |
| Location: precise location | Foreground location acquisition and persisted property latitude/longitude | App functionality | Device permission optional; determine personal location versus non-personal property coordinates and all map transmissions |
| Location: approximate location | Search areas, address and possible provider IP-derived location | App functionality; personalization where used | Confirm provider behavior; do not assume IP always means collected location |
| Device or other IDs | Expo push tokens linked to account/platform | Developer communications; app functionality | Notification registration path must be checked, including denied permission |
| App info/performance: diagnostics/crash logs | No complete telemetry audit performed | Select only purposes actually used | Confirm SDK and infrastructure telemetry; do not mark “not collected” from absence of explicit app calls alone |

No evidence was established for contacts, microphone/audio recordings, health data, payment-card/bank details, advertising IDs, SMS inbox access or installed-app inventory. Confirm the merged Android manifest and SDK behavior before marking those absent.

## Sharing decisions

- Public property listing content is disclosed to browsing users. Determine whether the specific user-initiated sharing exception applies and ensure the upload/publication flow makes disclosure clear.
- Offers and messages are routed to assigned Advisors or Verifiers. Determine whether each recipient acts solely on behalf of the operator under appropriate terms; independent recipients may require a sharing declaration.
- Authorized administrators review KYC. Do not describe KYC as visible to every advisor or buyer.
- Expo push, hosting/database, email/authentication and map services may qualify as service providers only where they process solely on your behalf under the applicable arrangement. A third party's independent use may require “shared”.
- Firebase is installed, but configuration/installation alone does not prove active collection. Inventory its enabled products and data disclosures in the shipped app.
- Map-related code references Google Maps/Places, Indian Open Maps and unpkg; authentication UI references Unsplash. Verify network requests, recipients, SDK policies and transmitted identifiers. Third-party asset fetches can expose network metadata.
- Do not answer “No data shared” until these recipient relationships and exemptions are resolved for each data type.

## Source evidence

`server/src/models/{User,Property,Document,Inquiry,Deal,Engagement,SearchPreference,PushDevice}.model.ts`; `server/src/routes/{auth,user,kyc,document}.routes.ts`; `server/src/services/pushNotifications.ts`; `app/components/MalikseMarketplace.tsx`; `app/components/AccountAuthScreen.tsx`; `app/src/services/mapAssets.ts`; `app/src/utils/{googlePlacesScript,regionBoundaryLayer}.ts`.

Official definitions: https://support.google.com/googleplay/android-developer/answer/10787469
