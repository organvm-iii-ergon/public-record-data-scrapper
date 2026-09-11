# Deployment evidence matrix

This matrix is the durable repository receipt for #235 and the deployment portion
of #239. It separates repository-owned checks from human/platform controls. Do
not mark a deployment gate complete from code review alone; every row needs an
attributable, redacted receipt for each target environment.

## Status vocabulary

| Status              | Meaning                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `repo-green`        | Proved by repository code, tests, or CI on the named commit.                                           |
| `external-blocked`  | Waiting on a secret, identity provider, database role, or platform permission outside this repository. |
| `ready-for-receipt` | Repository validation exists; rerun it after the external owner supplies the prerequisite.             |
| `complete`          | A redacted receipt proves the control in the target environment.                                       |

## Per-environment matrix

| Control                                                          | Owner                              | Local/dev           | PR preview          | Staging            | Production         | Required receipt                                                                              |
| ---------------------------------------------------------------- | ---------------------------------- | ------------------- | ------------------- | ------------------ | ------------------ | --------------------------------------------------------------------------------------------- |
| CI Gate, typecheck, build, tests                                 | This repo                          | `repo-green`        | `repo-green`        | `repo-green`       | `repo-green`       | GitHub run URL and exact commit SHA.                                                          |
| Secret scan and dependency validation                            | This repo                          | `repo-green`        | `repo-green`        | `repo-green`       | `repo-green`       | GitHub run URL and exact commit SHA.                                                          |
| `JWT_SECRET` configured                                          | Environment owner                  | `ready-for-receipt` | `external-blocked`  | `external-blocked` | `external-blocked` | Secret-store key presence only; never the value.                                              |
| Auth token contains `org_id` or configured namespaced equivalent | Auth0 / Access owner               | `ready-for-receipt` | `external-blocked`  | `external-blocked` | `external-blocked` | Decoded test-token claim shape or `deploy:verify` receipt with token redacted.                |
| Webhook signing secrets configured                               | Environment owner                  | `ready-for-receipt` | `external-blocked`  | `external-blocked` | `external-blocked` | Secret-store key presence for Stripe, Twilio, SendGrid, and Plaid/AWS provider as applicable. |
| Runtime database role is non-owner and lacks `BYPASSRLS`         | Database owner                     | `ready-for-receipt` | `external-blocked`  | `external-blocked` | `external-blocked` | `deploy:verify` database-role result against the app connection string.                       |
| Migrations 014-019 applied with owner/migration role             | Database owner                     | `ready-for-receipt` | `external-blocked`  | `external-blocked` | `external-blocked` | Migration run log plus schema/readback receipt, with credentials redacted.                    |
| `organizations.subscription_tier` to data-tier mapping approved  | Product owner                      | `ready-for-receipt` | `external-blocked`  | `external-blocked` | `external-blocked` | Approval note naming the accepted mapping and commit/test receipt.                            |
| Cloudflare account and Workers inventory                         | Credential owner                   | `ready-for-receipt` | `ready-for-receipt` | `complete`         | `external-blocked` | Sanitized provisioning receipt with account and Workers reads.                                |
| Cloudflare D1/KV/R2/Access inventory and reconciliation          | Credential owner                   | `ready-for-receipt` | `external-blocked`  | `external-blocked` | `external-blocked` | Sanitized provisioning receipt. Current known blocker: D1 inventory 401/code 10000.           |
| D1 migrations and live Worker verification                       | This repo after credential receipt | `ready-for-receipt` | `external-blocked`  | `external-blocked` | `external-blocked` | Staging/prod workflow artifact with schema readback and live verification.                    |
| Production promotion                                             | Human release owner                | n/a                 | n/a                 | n/a                | `external-blocked` | Manual approval plus production workflow URL.                                                 |

## Commands that create repo-owned receipts

```bash
npm run typecheck
npm test
npm run test:server -- --run
npm run build:render
npm run deploy:verify
npm run smoke
```

For Cloudflare, use the protected GitHub workflow receipts from
`.github/workflows/deploy-cloudflare.yml`. External Cloudflare 401/403 capability
denials are not source failures when the workflow records a sanitized blocker
receipt and skips remote mutation.

## Close rule

#235 can close only after the rows above are complete for the deployment target
that PR #234 or its successor promotes to. #239 remains open until the broader
Cloudflare platform migration has live staging/prod receipts or is superseded by
a new documented deployment architecture decision.
