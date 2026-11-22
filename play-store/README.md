# MalikSe Google Play publication pack

Prepared 7 November 2026 from the current app and server source. Package: `com.devoxa.malikse`.

This pack contains draft publication content, not an assertion that the app is ready for submission. No accounts were created, policies published, or Play Console declarations submitted.

| File | Purpose | Status |
| --- | --- | --- |
| privacy-policy.md | Public privacy policy copy | Business/contact/retention details required |
| account-deletion.md | Public deletion page copy and implementation requirements | Deletion functionality not found; implement before publishing claims |
| data-safety.md | Evidence-based Play Console worksheet | Confirm production SDKs, sharing and transport |
| store-listing.md | Title, short/full descriptions, release notes | Copy prepared |
| support-contact.md | Public support text and response templates | Working mailbox required |
| reviewer-access.md | App access instructions and fixture checklist | Dedicated accounts must be provisioned and tested |
| screenshots/README.md | Screenshot sequence, captions and capture status | Preview captures are not Android release captures |

## Required business inputs

- `[LEGAL_ENTITY]`: registered business or individual responsible for MalikSe. Do not infer this from a folder name.
- `[BUSINESS_ADDRESS]`, `[SUPPORT_EMAIL]`, `[PRIVACY_EMAIL]`, `[PUBLIC_WEBSITE]`.
- `[PRIVACY_URL]`, `[DELETION_URL]`: actual public HTTPS pages; proposed paths are `/privacy` and `/delete-account` on your chosen website.
- `[EFFECTIVE_DATE]`, `[DELETION_COMPLETION_PERIOD]`, `[BACKUP_RETENTION_PERIOD]`.
- `[RETENTION_SCHEDULE]`: specific retained categories, reasons and durations, including any completed-deal or dispute records.
- `[PROCESSOR_LIST_AND_LOCATIONS]`: actual hosting/database, authentication, email, map, push and storage providers.
- Dedicated reviewer accounts and safe sample listings, with credentials entered privately in Play Console.

## Release blockers discovered

1. Account creation is present, but no user account-deletion endpoint or in-app deletion control was found in the inspected account routes and services. A policy page alone does not meet this requirement.
2. Production provider settings and deployed data flows have not been audited. Installed SDKs alone do not establish whether data is collected.
3. Screenshots from the browser preview must be replaced by captures from the final Android build before submission. Do not show actual customer messages, IDs or KYC documents.
4. Support email, legal identity, retention commitments and reviewer credentials are unconfirmed.

## Official references checked

- User data and privacy policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Data safety definitions: https://support.google.com/googleplay/android-developer/answer/10787469
- Listing assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Reviewer access: https://support.google.com/googleplay/android-developer/answer/15748846

Recheck the final Android release and all versions still distributed on Play against the declarations before submitting.
