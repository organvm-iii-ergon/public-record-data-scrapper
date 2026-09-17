# Coverage and provider contract repair — 2026-09-17 UTC

This supersedes the coverage blocker in verification-v2.md. It is not a merge or deployment receipt.

Added behavior tests for provider transports, query binding, circuit recovery, tenant-scoped job access, health prerequisites and audit attribution/redaction. These use isolated test adapters; no synthetic business records were added to runtime and no external messages, calls or payments were sent.

The tests exposed and repaired raw Twilio date_created mapping and malformed acknowledgements, Plaid account_filters shape and fabricated request identifiers, explicit SendGrid tracking opt-outs, and audit tenant attribution and manual-change secret redaction.

Provider contracts: [Twilio messages](https://www.twilio.com/docs/messaging/api/message-resource), [Twilio calls](https://www.twilio.com/docs/voice/api/call-resource), [Plaid Link](https://plaid.com/docs/api/link/).

Observed strict server run on Node 24.19.0/npm 11.9.0: exit 0; 111 files and 1,734 tests passed, six pre-existing conditional skips. Statements 85.50%, branches 75.48%, functions 89.48%, lines 86.73%. Existing coverage thresholds and production coverage scope remain intact. Exact-head clean-tree preflight is required separately before submission.

Remaining restoration acceptance includes edge security and tenant/session contracts, actual provider verification, private data migration, CLAVIS delivery, resource writes, seven feature PR repairs, lane governance and production browser acceptance. Audit middleware still requires authoritative before-state and durable ordered appends in the audit feature work. These tests do not establish live provider behavior or deployed parity.

Both isolated restoration checkouts are retained. No credentials or private records are included.
