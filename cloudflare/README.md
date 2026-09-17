# ucc-mca-edge — Cloudflare edge foundation

The strangler-pattern base for migrating this platform (Express + BullMQ + Redis + Postgres + Vite SPA) to an all-Cloudflare, $0-floor, edge-native architecture.
The ideal-form target is in [`../docs/logos/telos.md`](../docs/logos/telos.md).

Everything here is **self-contained** under `cloudflare/` (plus one GitHub
Actions workflow). It does not touch the root `package.json`, `server/`,
`apps/`, or `packages/`.

```
cloudflare/
  package.json            # self-contained deps + scripts
  wrangler.toml           # bindings, crons, [env.staging] / [env.production]
  README.md               # this file
  migrations/
    0001_init.sql         # D1 starter schema (orgs, prospects, jobs, FTS5)
  workers/api/
    tsconfig.json
    src/
      index.ts            # Hono app: /health, /api/prospects; default { fetch, scheduled }
      types.ts            # Env (bindings + secrets) + Identity
      auth.ts             # Cloudflare Access JWT verify + orgScope (#234 logic)
      db.ts               # typed D1 helpers (all/first/run)
      scheduled.ts        # Cron handler + D1 jobs drain ($0 queue)
```

For verification contracts, background cron trigger testing, and D1 binding proof, see [`../docs/staging-deploy-and-cron-verification.md`](../docs/staging-deploy-and-cron-verification.md).

## Staging activation

Credential provisioning and delivery are owned by [Limen CLAVIS / #320](https://github.com/4444J99/limen/issues/320).
This repository owns the resources, migrations, Worker and live acceptance under
[#239](https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/239).
Use the existing protected `CLOUDFLARE_API_TOKEN` Actions secret. Its presence alone
does not prove D1, KV, R2 or Access authority.

The staging workflow uses Node 24.19.0/npm 11.9.0 and the frozen Cloudflare lock.
Pull requests run the local Worker and provisioning counterexamples without credentials.
Accepted `main` always verifies the source and then:

- deploys staging when the protected token is authorized for the dedicated D1,
  KV, R2, Access, and account reads; or
- records a sanitized blocked receipt and skips remote mutation when the blocker
  is an external credential-scope or provider-capability denial.

That blocked receipt is evidence that the repo source stayed inside its allowed
mutation boundary; it is not proof that staging is deployed.

When authorization is present, the workflow runs the following sequence:

1. Verify the current main revision and all required account/resource metadata.
2. Reuse or create only `ucc-mca-staging` (D1), `ucc-mca-edge-staging-KV`,
   `cronus-assets-staging` (R2), and `ucc-mca-edge-staging-api` (Access).
   List/authentication/pagination errors stop before creation. Existing production
   IDs and other resources are never adopted, deleted or changed.
3. Generate `.generated/staging.wrangler.json` from verified resource readbacks.
   It contains only staging configuration, exact source revision, and absolute
   source/migration paths. No manual ID copy or production configuration edit is needed.
4. Apply D1 migrations and require all four starter schema objects, deploy the
   Worker, then verify live `/health` serves the exact accepted source revision,
   unauthenticated and forged-token API requests are rejected, and missing routes
   return 404.

The `cloudflare-staging-RUN-ATTEMPT` Actions artifact retains sanitized provisioning,
predecessor deployment/version, schema and live receipts. A failed creation may
leave dedicated resources already created earlier in that run; the next attempt
reuses them. It never rolls back by deleting databases or buckets. The recorded
predecessor version identifies an existing Worker rollback target; a null
predecessor means the complete preflight found no staging Worker.

For a remote retry of accepted main:

```bash
gh workflow run deploy-cloudflare.yml --ref main -f staging=true
```

On an already credential-configured executor, a read-only resource plan is:

```bash
python3 scripts/provision-cloudflare-staging.py --plan
```

`--apply` performs the bounded creates and writes the generated configuration.
The workflow owns migration, deployment and acceptance. A provider denial records
the operation, HTTP status and numeric error codes without printing token values
or raw API responses. Source/configuration failures still fail the workflow.
The existing account's Workers subdomain and Access organization must resolve.
The workflow never activates a paid plan or creates a new account-wide identity
organization.

### Cloudflare Access

Dedicated Access applications protect the Worker API and the Pages hostname.
`/health` remains public, while the Worker independently requires a valid,
correctly scoped Access JWT and a D1-backed tenant membership. Access admission
alone never creates a tenant or trusts role and `org_id` values supplied by the
browser.

An operator may pre-enroll a verified email without knowing Access's opaque JWT
subject. Insert the organization and one normalized row in
`access_enrollment_invites` only after migration `0008` is live. On the first
signed Access request, the Worker atomically binds that invitation to the JWT's
issuer and subject and creates the durable `access_memberships` row. An expired,
revoked, ambiguous, already-claimed, wrong-issuer, or wrong-email invitation
fails closed. Revoke an unclaimed invitation in `access_enrollment_invites`;
revoke an established principal in `access_memberships`.

No real email, organization, role, or business record is seeded by migrations.
The enrollment and authenticated-browser receipts remain distinct deployment
acceptance predicates and must come from the live tenant.

### Local development and production

```bash
cd cloudflare
npm ci --ignore-scripts
npm run dev
npm run typecheck
```

Production remains the separate existing manual `confirm=DEPLOY` operation and
uses production bindings plus its `CLOUDFLARE_ACCOUNT_ID` secret. Staging resource
reconciliation does not provision or promote production.

## The strangler plan (how we cross)

1. **Foundation (this directory).** Access auth + org scoping + one real
   org-scoped read (`GET /api/prospects`) + Cron-drained D1 jobs queue. The staging workflow provisions its bindings and verifies the deployed revision.
2. **Port endpoints from `server/routes/*` into `workers/api/src`, one at a
   time — security logic first.** Re-derive nothing: every #234 control
   (org-scoped access, fail-closed webhooks, role checks, input validation)
   ports forward. Every D1 query is `WHERE org_id = ?` or it does not ship.
3. **Grow the schema.** Port `database/schema.sql` table-by-table under new
   numbered migrations (`0002_…`), translating JSONB→json1 and pg_trgm→FTS5.
   Run a one-time Postgres→D1 data migration when a table reaches parity.
4. **Flip the SPA.** Build `apps/web` and serve it from Pages
   (`wrangler pages deploy dist`); wire the API route to this Worker.
5. **Retire the old plane.** When parity is reached, decommission Render/Vercel
   and the Terraform/RDS/ElastiCache stack. One vendor, one CLI, one identity
   plane.

## Invariant reminders (telos)

- **$0 floor.** Cron + D1 jobs drain stands in for Queues/Durable Objects until
  the Workers Paid plan is worth it.
- **Tenant isolation lives in the query layer.** D1/SQLite has no RLS — see the
  banner in `src/db.ts`. No org-scope, no ship.
- **Fail closed.** Missing/invalid Access JWT → 401; org mismatch → 403; the
  error handler never leaks internals.

## Dependency security baseline (2026-09-09)

Use Node 24.19.0 and npm 11.9.0 with `npm ci`. Wrangler 4.130.0 requires
Workers types 5.20260908.1; the type-only major update was checked with the
Worker's strict TypeScript configuration. Wrangler also explicitly resolves
Miniflare `5.20260908.0-alpha`; this transitive major/prerelease is a reviewed
security exception, not a routine compatible update. `node scripts/test-cloudflare-runtime.mjs` bundles the actual Worker and checks
local health/authentication/404 behavior, with telemetry and outbound fetches
disabled. Hono's 4.13 series closes the current
request-parser advisories. The narrowly scoped `miniflare` → `sharp` 0.35.4
override closes [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)
until Miniflare raises its own pin; remove it when the upstream resolved graph
stays patched without it. `npm audit --json` reports zero vulnerabilities for
this lockfile after a frozen install. Deployment is a separate operation.
