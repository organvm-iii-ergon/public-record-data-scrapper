# Staging Auto-Deploy and Cron Verification

This document resolves and proves the deployment and verification contracts for **Issue #476: [S2.2] Staging Auto-Deploy & Cron Verification** under **Epic #465 (Deploy Truth)** and **#239 (Cloudflare Consolidation)**.

---

## 1. Staging Deployment Triggering Mechanism

### Current Workflow Architecture

Staging deployment is defined in [`.github/workflows/deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml). It implements a two-stage pipeline:

```
[Push to main / Staging Dispatch]
              │
              ▼
   ┌──────────────────────┐
   │    verify-staging    │  (Runs on PRs and main; credentials-free verification)
   └──────────┬───────────┘
              │ (success)
              ▼
   ┌──────────────────────┐
   │    deploy-staging    │  (Gated: main branch only, concurrency: ucc-cloudflare-staging)
   └──────────────────────┘
```

### Event Triggers

1. **Automatic Continuous Deployment (Auto-Deploy)**:
   - **Event**: `push` to `main` branch.
   - **Path Filters**: Triggered whenever changes touch:
     - `cloudflare/**` (Worker source code, D1 migrations, edge dependencies, Wrangler configuration)
     - `scripts/*cloudflare*` (Toolchain verification, provisioning, diagnostics, live verification scripts)
     - `.github/workflows/deploy-cloudflare.yml` (Deploy pipeline definition)
2. **Manual Controlled Deployment**:
   - **Event**: `workflow_dispatch` with:
     - `staging: true` (Boolean input)
     - `confirm != 'DEPLOY'` (Ensures production deploy branch is not taken)
3. **Pull Request Validation (No Deployment)**:
   - **Event**: `pull_request` targeting `main`.
   - **Behavior**: Executes only the `verify-staging` job (toolchain checks, local Miniflare runtime smoke test, Python unit tests without credentials). No mutations or secrets access occur.

### Staging Deployment Preconditions & Security Invariants

- **Accepted Revision Invariant**:
  ```bash
  test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
  test "$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)" = "$GITHUB_SHA"
  ```
  Ensures that staging deploys only the canonical, accepted `main` commit, never detached PR code.
- **Environment Protection**:
  Targets GitHub Environment `staging` with dedicated concurrency group `ucc-cloudflare-staging` (`cancel-in-progress: false`), preventing interleaved or colliding deployments.
- **Credential Boundary**:
  `CLOUDFLARE_API_TOKEN` is strictly scoped to staging. `CLOUDFLARE_ACCOUNT_ID` is set dynamically from the verified staging account in `.generated/staging.wrangler.json`.

---

## 2. Worker & D1 Database Binding Confirmation

### Configuration & Topology

The Worker's binding to Cloudflare D1 is verified across configuration, code entrypoints, and migrations:

1. **Wrangler Configuration ([`cloudflare/wrangler.toml`](../cloudflare/wrangler.toml))**:
   - Top-level definition:
     ```toml
     [[d1_databases]]
     binding = "DB"
     database_name = "ucc-mca"
     database_id = "00000000-0000-0000-0000-000000000000"
     migrations_dir = "migrations"
     ```
   - Staging environment definition:
     ```toml
     [[env.staging.d1_databases]]
     binding = "DB"
     database_name = "ucc-mca"
     database_id = "REPLACE_WITH_STAGING_D1_ID"
     migrations_dir = "migrations"
     ```
2. **Dynamic Provisioning ([`scripts/provision-cloudflare-staging.py`](../scripts/provision-cloudflare-staging.py))**:
   - Automatically provisions or reuses dedicated staging D1 database `ucc-mca-staging`.
   - Emits `.generated/staging.wrangler.json` with the real D1 `database_id` and absolute migrations directory.
   - Enforces database isolation: staging D1 ID cannot equal production D1 ID (`scripts/verify-cloudflare-staging.py`).
3. **Worker Entrypoint & Binding Injection**:
   - Entrypoint: [`cloudflare/workers/api/src/index.ts`](../cloudflare/workers/api/src/index.ts)
   - Type definitions in [`cloudflare/workers/api/src/types.ts`](../cloudflare/workers/api/src/types.ts):
     ```typescript
     export interface Env {
       DB: D1Database
       KV: KVNamespace
       ARTIFACTS: R2Bucket
       ENVIRONMENT: string
       DEPLOYMENT_SHA?: string
       ACCESS_TEAM_DOMAIN: string
       ACCESS_AUD: string
     }
     ```
   - Database client helpers in [`cloudflare/workers/api/src/db.ts`](../cloudflare/workers/api/src/db.ts):
     Directly wrap `env.DB.prepare(sql).bind(...).all()` and `.run()`.
   - Strict tenant isolation invariant: Every tenant read/write in D1 carries `WHERE org_id = ?` or equivalent join.
4. **Schema Migrations**:
   - Initial schema: [`cloudflare/migrations/0001_init.sql`](../cloudflare/migrations/0001_init.sql).
   - Core tables created:
     - `organizations` (tenants, subscription tier)
     - `prospects` (org-scoped lead records)
     - `jobs` (async pipeline backlog for cron drainage)
     - `prospects_fts` (FTS5 virtual table synced via triggers)
   - Verification in CI (`deploy-cloudflare.yml`):
     ```bash
     ./node_modules/.bin/wrangler d1 migrations apply DB --config .generated/staging.wrangler.json --remote
     ./node_modules/.bin/wrangler d1 execute DB --config .generated/staging.wrangler.json --remote \
       --command "SELECT name FROM sqlite_master WHERE name IN ('organizations', 'prospects', 'jobs', 'prospects_fts') ORDER BY name" --json > .generated/staging-schema.json
     python3 scripts/verify-cloudflare-live.py --schema-only
     ```

---

## 3. Scheduled Cron Trigger Verification (Continuous Ingestion & Tasks)

### Cron Architecture ($0 Floor)

To operate at the $0 baseline without requiring Workers Paid ($5/mo for Queues/Durable Objects), background processing uses Cloudflare Cron Triggers combined with a D1-backed queue:

```
Cloudflare Cron Engine
  │
  ├── 0 2 * * *    (Daily 02:00 UTC)  ──► Continuous UCC Ingestion Tick
  ├── 0 */6 * * *  (Every 6 Hours)    ──► Data Enrichment Tick
  └── 0 */12 * * * (Every 12 Hours)   ──► Health Scoring Tick
                                            │
                                            ▼
                                  drainJobs(env: Env)
                                            │
                                            ▼
                                  Atomic D1 Queue Claim:
                                  SELECT * FROM jobs WHERE status = 'pending' LIMIT 25
                                  UPDATE jobs SET status = 'processing', attempts = attempts + 1
```

### Fail-Safe Guarantees

In [`cloudflare/workers/api/src/scheduled.ts`](../cloudflare/workers/api/src/scheduled.ts):

1. **Asynchronous Lifespan**: Handled via `ctx.waitUntil(task)`, ensuring scheduled work completes reliably without truncating execution.
2. **Task Isolation**: Each cron schedule handler is wrapped in try/catch. A failure in continuous ingestion or enrichment will log error diagnostics but will **never abort** the subsequent `drainJobs(env)` step.
3. **Queue Drainage Isolation**: Each job is processed within its own try/catch. A failing job increments `attempts` and returns to `pending` (or transitions to `failed` once `attempts >= 5`), never blocking remaining jobs in the batch.
4. **Atomic Concurrency Control**:
   `UPDATE jobs SET status = 'processing', attempts = attempts + 1 WHERE id = ? AND status = 'pending'`
   Only if `changes === 1` does the worker process the job, preventing race conditions or duplicate execution during overlapping ticks.

### Testing & Verification Methodologies

#### Method 1: Automated Local Miniflare Smoke Test

Run:

```bash
node scripts/test-cloudflare-runtime.mjs
```

What this tests:

- Launches the bundled Worker inside Miniflare with emulated D1 database (`staging-test-db`).
- Executes migration statements from `cloudflare/migrations/0001_init.sql` and asserts table creation (`organizations`, `prospects`, `jobs`, `prospects_fts`).
- Triggers all scheduled cron expressions:
  - `worker.scheduled({ cron: '0 2 * * *' })` (ingestion)
  - `worker.scheduled({ cron: '0 */6 * * *' })` (enrichment)
  - `worker.scheduled({ cron: '0 */12 * * *' })` (health scoring)
  - `worker.scheduled({ cron: '0 0 1 1 *' })` (unrecognized fallback)
- Seeds a pending job into D1 and triggers a cron tick to verify atomic drainage, attempt counter increment, and terminal status transitions.
- Verifies outbound network isolation (`outboundRequests === 0`).

#### Method 2: CI Policy & Contract Verification

Run:

```bash
node --test scripts/__tests__/staging-deploy-cron.test.mjs
```

Automated via `.github/workflows/ci-gate.yml` under `policy-tests` to ensure workflow files, wrangler configurations, entrypoints, and SQL migrations never drift out of contract.

#### Method 3: Local Wrangler Dev Simulation

To simulate triggers interactively:

```bash
cd cloudflare
npx wrangler dev --test-scheduled
```

In another terminal, dispatch cron events directly:

```bash
# Trigger daily UCC ingestion cron:
curl "http://localhost:8787/__scheduled?cron=0+2+*+*+*"

# Trigger 6-hour enrichment cron:
curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"
```

#### Method 4: Cloudflare Live Staging Observability

In the Cloudflare dashboard:

- Navigate to **Workers & Pages** → `ucc-mca-edge-staging` → **Triggers**.
- Verify that the Cron Triggers (`0 2 * * *`, `0 */6 * * *`, `0 */12 * * *`) are active.
- Tail live execution logs:
  ```bash
  cd cloudflare
  ./node_modules/.bin/wrangler tail --env staging
  ```
  Watch for `[cron] ingestion tick (env=staging)` and `[drain]` log entries.
