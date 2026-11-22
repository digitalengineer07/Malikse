# Google Play reviewer access

Status: instructions prepared; credentials and fixtures have NOT been created. Enter credentials privately in Play Console > App content > App access, not in source control or the public listing.

## App access selection

Some functionality is restricted. Browsing public verified properties does not require sign-in. Wishlist, posting, offers and conversations use an account; posting/offers require approved KYC.

## Account slots to provision

| Account | Needed access | Private fields to enter in Console |
| --- | --- | --- |
| Buyer/seller review user | Approved KYC, safe sample wishlist, listing and conversation | [REVIEW_USER_IDENTIFIER], [REVIEW_USER_PASSWORD] |
| Assigned Advisor | Assigned sample property, offer/chat and deal controls if accessible in this app | [REVIEW_ADVISOR_IDENTIFIER], [REVIEW_ADVISOR_PASSWORD] |
| Assigned Verifier | No-Advisor-ID sample assignment and review controls if accessible in this app | [REVIEW_VERIFIER_IDENTIFIER], [REVIEW_VERIFIER_PASSWORD] |

Provide additional role access only if those features are reachable in the submitted app. Do not grant reviewers the normal production super-admin account. If admin functionality is part of the app, provision a dedicated restricted review environment and document its access too.

## Copy for reviewer instructions

MalikSe is a property marketplace. You can browse the Home and Search screens without signing in. The Home screen includes recommendations, new listings and trending properties.

To test protected features, open Profile, choose Sign in / Register, and sign in using the supplied buyer/seller review credentials. This account must already have completed the review fixture's identity-verification step; reviewers should not need to provide personal identity documents or wait for a manual KYC decision.

Use the sample listing [REVIEW_PROPERTY_TITLE/ID] to test saving a property, viewing details, submitting an offer and opening its conversation. Offers and buyer chats go to the Advisor or Verifier assigned to the property, not directly to the owner.

To inspect posting, open Post and use sample property information and the supplied non-sensitive fixture documents [FIXTURE_ACCESS_INSTRUCTIONS]. Use [REVIEW_ADVISOR_ID] to test advisor assignment; leave it blank to test verifier assignment. Submissions remain private until reviewed.

Use the assigned staff account for review decisions and buyer conversations. Use only [DISPOSABLE_REVIEW_DEAL] to test closing a deal and marking a property sold. This must not affect a real customer property. Sold properties stop appearing as available listings.

Account deletion is available at [IMPLEMENTED_IN_APP_DELETION_PATH] and [DELETION_URL]. Provide a disposable review account for this test and a separate reusable account so deletion does not lock reviewers out of all features.

For review access problems contact [SUPPORT_EMAIL].

## Provisioning acceptance checks

- Credentials are active, reusable, accessible at all times and from outside your location. They do not require access to your personal phone, OTP inbox or an expiring invite.
- Use normal dedicated accounts and safe fixtures. Do not add a global hardcoded password, hidden security bypass, or a different app experience designed to evade review.
- Pre-approve only synthetic review KYC records in the intended review environment. Never upload another person's identity document for this purpose.
- Ensure the submitted build can reach the fixtures without changing its API URL manually; isolate destructive sample actions from real records.
- Include non-approved KYC/correction fixtures if needed to inspect those flows, alongside the approved account.
- Verify every role and instruction against the exact signed release build; keep access working throughout review and subsequent updates.

Official access requirements: https://support.google.com/googleplay/android-developer/answer/15748846
