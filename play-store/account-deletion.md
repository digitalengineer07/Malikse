# Account deletion implementation

Implemented 2026-11-07; deployment verification remains outstanding.

Operator: **Malikse powered by AgHomesIndia**.

Public URL after deployment: https://malikse.devoxa.in/delete-account

App path: Account > Delete account. Users can also open the public page without installing or signing into the app, then reauthenticate using their registered email/mobile and password and type DELETE. Staff accounts require administrative removal. Password recovery remains available through the existing forgot-password flow.

Account access is revoked immediately after the durable request. A private receipt allows status checks. Accepted/token-paid deals defer cleanup until staff resolve the obligation. Other cleanup retries automatically. Limited transaction records and a 90-day unlinked receipt remain; shared files used by other listings are preserved. Provider/backup retention is not yet confirmed.

Canonical user-facing copy: `website/routes/delete-account.tsx` and `website/routes/privacy-policy.tsx`. Operational contract and test instructions: [server/ACCOUNT_DELETION.md](../server/ACCOUNT_DELETION.md).

The configured support address is a labeled dummy, `support@malikse.example`. Replace it with a monitored address before launch. Do not claim store-policy or legal compliance based only on implementation; verify hosted URLs, disclosures, retention and the full release separately.
