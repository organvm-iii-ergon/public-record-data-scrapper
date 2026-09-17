# Verification repair follow-up — 2026-09-17 UTC

This supersedes the strict-server failure status in verification.md, while retaining the earlier diagnostic as baseline evidence. It is not a deployment or merge receipt.

## Implemented repairs

- Strict server compilation now passes with real Express 5 scalar parameter validation, schema-owned parsed query access, numeric Zod 4 output defaults, installed SDK-compatible types, and missing middleware declaration packages.
- Database writes now use RETURNING rows and the actual rows-array adapter contract, instead of reading a nonexistent rowCount property. Normalized company names use the returned string.
- Consent revocation now binds the channel parameter for broad opt-outs and checks contact ownership before inserting a channel revocation marker. Channel-specific revocation preserves the broad grant for other channels.
- Replaced global TRUNCATE hooks with a separately invoked real PostgreSQL integration suite. Each test rolls back its writes. The audit test retains the immutable trigger and uses a held client/savepoint for its expected rejection. CI requires an explicit integration run after migrations; missing TEST_DATABASE_URL is an error, not a skip.
- Replaced narrative tests that asserted locally constructed values without invoking NarrativeService with actual service-output tests. Added SendGrid transport success, provider-error, missing-credential, and network-error tests.
- Harness receipts now require strict coverage and database integration, and hash relevant environment configuration. Coverage is not disabled to produce a green receipt.

## Observed validation

Canonical local toolchain: Node 24.19.0 and npm 11.9.0.

- Root TypeScript, strict server TypeScript, formatting, and lint: pass.
- Server suite: 102 files passed; 1,603 tests passed; six existing conditional tests skipped.
- Strict coverage command: exit 1. Statements 76.42%, branches 64.11%, functions 77.48%, lines 77.44%; existing thresholds remain 80/75/80/80.
- Native PostgreSQL 16 isolated cluster: fresh migration of all checked-in migrations passed; second migration run reported no pending migrations.
- Real database integration: four tests passed, including persisted consent readback, tenant rejection, rows-array writes, and immutable audit rejection. Transaction teardown verifies the test tenant is absent. The native database was stopped after verification.
- Receipt tests: five passed. Focused workflow/migration policy tests: seven passed.
- Build:render passed.

## Remaining acceptance work

Coverage is still an explicit failing gate; this head is not eligible for a green merge receipt. The largest untested surfaces include Twilio, Plaid, SendGrid sending, webhook/job routes, and utility/error paths. Continue meaningful behavior tests rather than lowering thresholds or removing production code from coverage.

The rest of the restoration plan remains required: credentials, security, deployed tenant session and data contracts, lane/feature integration, staging/prod resource writes, browser acceptance and rollback proof. No cloud resources, branch protection, merges, or deployments were changed in this packet. The no-mock requirement applies to every runtime surface, including remaining inferred/default narrative facts, and is not satisfied merely by the frontend bundle guard.

Both restoration worktrees are retained for the ongoing authorized implementation. No private records or credentials are included in this evidence.
