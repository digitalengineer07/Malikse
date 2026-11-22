# Account deletion and privacy remediation addendum — 2026-11-07

This supplements, and does not replace, PRODUCTION_AUDIT_2026-11-07.md. The earlier production-readiness findings remain unless explicitly resolved here.

Implemented password-confirmed buyer/owner deletion in the app and public website, durable cleanup with retries and private status receipts, immediate account revocation, accepted/payment deal holds, transactional guards against new offers/acceptance for deleting accounts, and deletion visibility for administrators. Added the public privacy policy with the supplied operator name and a clearly labeled dummy mailbox.

Validation: server build and deletion integration tests; replica-set deletion/acceptance test; existing 54-request assigned-workflow regression; website typecheck, four navigation tests and production build; app typecheck and recommendation regression; browser inspection of both public pages. Native device testing and live deployment remain outstanding.

Production follow-up: replace dummy contact, confirm backup/provider retention and legal disclosures, configure shared persistent uploads where applicable, monitor deletion jobs and resolve held deals, verify published deep links. Other audit blockers are not resolved by this feature.

See ../server/ACCOUNT_DELETION.md for the operational contract.
