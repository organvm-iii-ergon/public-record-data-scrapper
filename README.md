# Public Record Data Scraper

**Extract, enrich, and score UCC filings from US state Secretary of State portals.** Turns raw public records into prioritized, outreach-ready leads for the Merchant Cash Advance industry. Four state collectors are implemented today (CA, TX, FL, NY); the remaining states are on the roadmap.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI Gate](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/workflows/ci-gate.yml/badge.svg?branch=main)](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/workflows/ci-gate.yml)
[![Public surface](https://img.shields.io/badge/public%20surface-GitHub%20Pages-222)](https://organvm-iii-ergon.github.io/public-record-data-scrapper/)

---

## Proof destination

### Problem

Public-record collection is not one uniform scrape: each jurisdiction exposes a different portal,
transport, access constraints, and failure modes. A useful implementation must make those differences
inspectable without implying data completeness or nationwide deployment.

### Status

The repository contains four implemented state collectors: California, Texas, Florida, and New York.
They sit inside a broader multi-state architecture; other state paths remain
roadmap work.
California requires `CA_SOS_API_KEY`; Texas requires `TX_SOSDIRECT_API_KEY` plus
`TX_SOSDIRECT_ACCOUNT_ID`; and Florida requires vendor key/secret credentials plus an active
vendor contract. New York requires configured debtor search names in `NY_UCC_DEBTOR_SEEDS`.
Each collector fails closed when its own access or seed requirement is absent.

### Architecture

The React client, Express API, BullMQ workers, PostgreSQL store, and per-state collector adapters are
separate layers. Collector outputs can pass through public-data enrichment and an inspectable
rules-based score before the API, CLI, or dashboard presents them. Optional vendors remain
key-gated rather than returning synthetic substitutes.

### Decisions and tradeoffs

- Per-state adapters preserve portal-specific behavior instead of hiding it behind a false uniform
  interface.
- Credentialed and optional sources fail closed, trading breadth for explicit provenance.
- A rules-based score remains authoritative; the optional experimental model is not treated as
  validated outcome prediction.
- Infrastructure manifests document deployment shapes, but source presence is not deployment
  evidence.

### Verification

- [CI Gate](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/workflows/ci-gate.yml)
  is the repository-owned verification workflow.
- The [successful exact-base workflow run](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/runs/31310353594)
  is bound to `139fa7b40d875ecfe3a8c693dedfab46671739fd`.
- `npm test` and `npm run test:server` reproduce the client and server suites; runner output is the
  count authority, so this page does not freeze a total that will drift.
- Tagged release candidates use [`.github/workflows/release.yml`](.github/workflows/release.yml);
  source or a passing test run does not by itself establish a published release.

### Status and authorship disclosure

**Authorship class:** Agent-directed. Architected and directed by one person through a governed,
multi-agent production system. Automation and agent assistance are disclosed through the
repository's commit, review, and workflow history.

### Limitations

- Four implemented collectors do not establish fifty-state deployment or data completeness.
- Portal behavior, credentials, and vendor contracts can change independently of this source.
- The repository does not establish installs, daily use, adoption, customers, revenue, rankings,
  retention, or zero-maintenance operation.

### What this proves

The public source proves four inspectable collector implementations (CA, TX, FL, and NY) within a
broader architecture, together with explicit access and verification boundaries.

### Doors

**[Have a problem one of these solves? — Deploy it for your shop](mailto:contact@4444j99.dev?subject=%5Bfront%20door%20%C2%B7%20deploy%5D%20%E2%80%94%20inbound) →**

> Pick the depth that fits. We feed you the output, run it under your brand, build it for your exact world, or become your engine.

**[Hiring someone who ships at this level? — Work with the builder](mailto:contact@4444j99.dev?subject=%5Bfront%20door%20%C2%B7%20hire%5D%20%E2%80%94%20inbound) →**

> Everything here is the portfolio. If you need a senior builder who owns systems end-to-end — data, infra, AI, deploy — this is the evidence.

Before relying on a collector or scoring claim, inspect the four adapters and run `npm test` plus
`npm run test:server`.

---

## What It Does

1. **Collects** UCC-1 filing data from state Secretary of State portals — 4 collectors implemented (CA API, TX bulk, FL vendor, NY portal scraper) with per-state strategies (API, bulk download, vendor feed, scrape) and fallback. CA, TX, FL, and NY use the access gates described above; every collector fails closed when its requirement is absent.
2. **Enriches** each filing with free public data (SEC EDGAR, OSHA, USPTO, Census Bureau) plus optional, key-gated sources (SAM.gov, D&B, Clearbit, ZoomInfo) that fail closed — returning a named error, never fabricated data — when no API key is configured
3. **Scores** every prospect 0--100 on financing likelihood, assigns a health grade (A--F), and flags growth signals (hiring, permits, equipment purchases, expansion)
4. **Delivers** results through a React web dashboard, REST API, or CLI tool

### Example Output

```json
{
  "company": "Pacific Coast Distributors LLC",
  "state": "CA",
  "ucc_filings": [
    {
      "filing_number": "2024-0847291",
      "secured_party": "National Funding Inc",
      "filing_date": "2024-03-15",
      "type": "UCC-1"
    }
  ],
  "enrichment": {
    "revenue_estimate": "2.4M",
    "employee_count": 34,
    "growth_signals": ["hiring_detected", "new_permits", "equipment_purchase"],
    "health_grade": "B+",
    "priority_score": 82,
    "industry": "Wholesale Distribution"
  },
  "recommendation": "HIGH PRIORITY - Active financing, strong growth signals, clean compliance record"
}
```

---

## Usage

```bash
git clone https://github.com/organvm-iii-ergon/public-record-data-scrapper.git
cd public-record-data-scrapper
npm ci
```

The root package is a private npm workspace. It does not declare a top-level `bin`
or package export; use the npm scripts below.

### Run the app

The web app runs from `apps/web` through the root workspace script:

```bash
npm run dev
```

Vite is configured to bind `127.0.0.1:5173`.

The API and worker read configuration from process environment variables. The
server requires `JWT_SECRET` at startup. To use the local Docker database and
Redis services:

```bash
docker-compose up -d db redis

export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucc_mca
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=replace-with-local-secret

npm run db:migrate
npm run seed

npm run dev:server # API only
npm run dev:worker # Worker only
npm run dev:full   # Web + API + worker
```

Health checks (running API on default `3000`):

```bash
curl -fsS http://localhost:3000/api/health           # Basic liveness
curl -fsS http://localhost:3000/api/health/detailed   # Dependency status
```

Other root run/build entrypoints:

```bash
npm run preview          # Preview the built web app
npm run build            # Build apps/web into dist/
npm run build:server     # Bundle dist/server.cjs and dist/worker.cjs
npm run build:render     # Build web + server/worker bundles
npm start                # Run dist/server.cjs
npm run start:worker     # Run dist/worker.cjs
npm run smoke            # Poll /api/health until the deployed API is live
npm run dev:desktop      # Run apps/desktop dev script
npm run dev:mobile       # Run apps/mobile Expo start script
```

### CLI tools

The CLI is registered in `scripts/cli-scraper.ts` and executed as:

```bash
npm run scrape -- <command> [flags]
```

See command-level help with:

```bash
npm run scrape -- --help
npm run scrape -- scrape-ucc --help
```

The CLI supports `CA`, `TX`, `FL`, and `NY` for commands that validate state
through `SUPPORTED_CLI_STATES`.

```bash
## Scrape UCC filings for a company
npm run scrape -- scrape-ucc -c "Company Name" -s CA -o ./results.json
##   required: -c|--company <name>, -s|--state <code>
##   optional: -o|--output <file> (default: ./output.json), --csv
##   supported states: CA, TX, FL, NY

## Normalize one company name
npm run scrape -- normalize -n "Company Name"
##   required: -n|--name <name>

## Enrich from public sources
npm run scrape -- enrich -c "Company Name" -s CA --tier professional -o ./enriched-data.json
##   required: -c|--company <name>, -s|--state <code>
##   optional: -o|--output <file> (default: ./enriched-data.json), --tier <free|starter|professional>, --csv
##   supported states: CA, TX, FL, NY

## Batch process CSV input
npm run scrape -- batch -i ./companies.csv -o ./batch-results
##   required: -i|--input <file> (CSV header + rows company,state)
##   optional: -o|--output <dir> (default: ./batch-results)
##   max 1,000 rows; input file must be 5,242,880 bytes or smaller
##   note: --enrich is accepted by the parser but the batch loop only scrapes UCC filings

## Export scored leads (database-backed)
npm run scrape -- lead-export --min-score 70 --max-score 95 --state CA --limit 100 --offset 0 --output-dir ./lead-export
##   optional: -o|--output-dir <dir> (default: ./lead-export)
##   optional: --format <json|csv|both> (default: both)
##   optional: --min-score <0-100> (default: 70), --max-score <0-100>
##   optional: --state <CA|TX|FL|NY>, --industry <name>, --status <status>
##   optional: --limit <1-1000> (default: 100), --offset <integer> (default: 0)

## List available states with configured UCC collectors
npm run scrape -- list-states
```

The scheduled scraper is a separate script:

```bash
npm run scrape:scheduled              # Hard-coded sample companies for CA, TX, FL, NY, IL
npm run scrape:scheduled -- --dry-run # Print the batch instead of writing output/
```

It uses `SCRAPER_IMPLEMENTATION` when set (`mock`, `puppeteer`, or `api`);
otherwise `scripts/scrapers/scraper-factory.ts` chooses a recommended
implementation from the current environment.

### API entrypoints

The Express server exposes Swagger UI at `/api/docs` and raw OpenAPI at
`/api/docs/openapi.json` and `/api/docs/openapi.yaml`.

The on-demand UCC API is mounted behind API-key-or-JWT auth:

```bash
## Check whether a state scraper is available
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/scrape/readiness/CA

## Synchronous search — waits for results (suitable for small queries)
curl -X POST http://localhost:3000/api/scrape/ucc \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Company Name","state":"CA","limit":100}'

## Async search — returns 202 immediately with a jobId (use for large or slow queries)
curl -X POST http://localhost:3000/api/scrape/jobs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Company Name","state":"CA","limit":500}'
## → {"data":{"jobId":"<uuid>","status":"pending","pollUrl":"/api/scrape/jobs/<uuid>"},...}

## Poll until status is "completed" or "failed"
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/scrape/jobs/<jobId>
```

### Workspace exports

Internal workspace packages expose source entrypoints for other workspace code:

```text
@public-records/core
  .              -> packages/core/src/index.ts
  ./database     -> packages/core/src/database.ts
  ./identity     -> packages/core/src/identity.ts
  ./types        -> packages/core/src/types.ts
  ./enrichment   -> packages/core/src/enrichment/index.ts

@public-records/ui
  . and component subpaths such as ./button, ./card, ./dialog, ./table,
  ./tooltip, ./utils, and the other subpaths declared in packages/ui/package.json
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  React 19 + Vite (Vercel CDN)                       │
│  Dashboard · Deal Pipeline · Compliance · Inbox     │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Express API + BullMQ Workers                       │
│  27 domain services · OpenAPI 3.0 · JWT auth        │
└───────┬──────────────┬──────────────────────────────┘
        │              │
┌───────▼──────┐ ┌─────▼───────┐ ┌────────────────────┐
│ PostgreSQL   │ │   Redis 7   │ │ Agent Orchestrator  │
│ 9 migrations │ │ cache/queue │ │ 4 state collectors  │
│ multitenancy │ │             │ │ circuit breakers     │
└──────────────┘ └─────────────┘ └─────┬──────────────┘
                                       │
                    ┌──────────────────▼────────────────┐
                    │  State SOS Collectors (4 implemented)│
                    │  CA · TX · FL · NY                  │
                    │  + SEC · OSHA · USPTO · Census      │
                    │  + SAM.gov · D&B · Clearbit · Zoom  │
                    └────────────────────────────────────┘
```

### Monorepo Layout

```
public-record-data-scrapper/
├── apps/
│   ├── web/               # React 19 dashboard (Radix UI, Tailwind)
│   ├── desktop/           # Tauri desktop app
│   └── mobile/            # Mobile app target
├── server/
│   ├── services/          # 27 domain services (scoring, enrichment, compliance, ...)
│   ├── integrations/      # Twilio, SendGrid, Plaid, ACH, AWS S3
│   ├── routes/            # Express route handlers
│   └── openapi.yaml       # API specification
├── packages/
│   ├── core/              # Shared types, DB client, utilities
│   └── ui/                # Shared component library
├── database/
│   ├── schema.sql         # Full PostgreSQL schema
│   └── migrations/        # 9 versioned migrations with rollbacks
├── terraform/             # AWS infrastructure (VPC, RDS, ElastiCache, S3)
├── k8s/                   # Kubernetes manifests
├── monitoring/            # Prometheus + CloudWatch alert rules
└── tests/                 # Integration + E2E (Playwright)
```

---

## API

The Express server exposes a RESTful API documented at `/api/docs` when running.

### Scrape API — auth: API key (`X-API-Key: prk_…` or `Authorization: Bearer prk_…`) or JWT

| Method | Endpoint                           | Description                                                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/scrape/readiness/:stateCode` | Check whether a state scraper is available                                                       |
| `POST` | `/api/scrape/ucc`                  | Synchronous UCC search; body: `company_name`, `state`, optional `limit` (1–1000, default 100)    |
| `POST` | `/api/scrape/jobs`                 | Enqueue async scrape (same body as above); returns 202 + `jobId` + `pollUrl` immediately         |
| `GET`  | `/api/scrape/jobs/:jobId`          | Poll async job; returns `pending`, `processing`, `completed`, or `failed` with results when done |

### Dashboard API — auth: JWT

| Method  | Endpoint                      | Description                                  |
| ------- | ----------------------------- | -------------------------------------------- |
| `GET`   | `/api/prospects`              | List prospects with filtering and pagination |
| `GET`   | `/api/prospects/export/leads` | Export scored MCA leads as JSON or CSV       |
| `GET`   | `/api/prospects/:id`          | Prospect detail with enrichment data         |
| `POST`  | `/api/prospects/:id/claim`    | Claim a prospect for outreach                |
| `POST`  | `/api/prospects/:id/score`    | Trigger re-scoring                           |
| `GET`   | `/api/deals`                  | List deals with pipeline stage filter        |
| `PATCH` | `/api/deals/:id/stage`        | Move deal to next pipeline stage             |
| `POST`  | `/api/communications/send`    | Send email or SMS                            |
| `GET`   | `/api/compliance/report`      | Generate compliance report                   |

### API key management — auth: JWT, role: admin

| Method   | Endpoint        | Description       |
| -------- | --------------- | ----------------- |
| `POST`   | `/api/keys`     | Create an API key |
| `GET`    | `/api/keys`     | List API keys     |
| `DELETE` | `/api/keys/:id` | Revoke an API key |

Full endpoint list: [server/openapi.yaml](server/openapi.yaml)

### Data Tiers

| Tier                    | Sources                                                           | Cost             |
| ----------------------- | ----------------------------------------------------------------- | ---------------- |
| **Free / OSS (no key)** | SEC EDGAR, OSHA, USPTO, Census                                    | No charge        |
| **Optional, key-gated** | SAM.gov, D&B, Clearbit, ZoomInfo (fail closed without an API key) | Vendor-dependent |

---

## Key Features

- **Multi-state UCC collection** -- 4 implemented collectors (CA API, TX bulk, FL vendor, NY portal scraper) with per-state fallback strategies (API, bulk download, vendor feed, scrape); FL and NY are credential-gated and fail closed when unconfigured. Additional states remain roadmap work.
- **Transparent rules-based lead scoring** -- priority score (0--100) from a weighted, inspectable formula, health grade, growth signal detection, revenue estimation. An **optional, experimental ML model** (logistic regression) can be attached per request; it is opt-in, low-confidence, and trained on synthetic seed data pending validation against real outcomes — the rules-based score stays authoritative.
- **Compliance built in** -- CA SB 1235 and NY CFDL disclosure calculators, TCPA consent tracking, suppression list management, immutable audit trail
- **Full broker workflow** -- prospect dashboard, deal pipeline (Kanban), contact CRM, unified communications inbox (email/SMS/voice), bank statement underwriting (Plaid)
- **Production infrastructure** -- Terraform-provisioned AWS (VPC, RDS, ElastiCache, S3), Vercel frontend deployment, Docker Compose for local dev, Kubernetes manifests for container orchestration

---

## Testing

Use the repository-owned runners below. Their output is the current count and result authority;
the README intentionally does not hard-code a total that can contradict a later exact tree.

```bash
npm test                       # Client Vitest projects
npm run test:server            # Server Vitest project
npm run test:coverage          # V8 coverage report (web)
npm run test:e2e               # Playwright end-to-end, run separately
```

The [CI Gate](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/workflows/ci-gate.yml)
runs the governed repository checks. Preserve the workflow run URL and exact head when using its
result as evidence.

---

## Infrastructure

### Local Development

```bash
docker-compose --profile development up -d    # Full stack
docker-compose ps                             # Verify health
```

### Production build & releases

```bash
npm run build:render      # frontend dist/ + bundled dist/server.cjs + dist/worker.cjs
npm start                 # run the API server   (node dist/server.cjs)
npm run start:worker      # run the BullMQ worker (node dist/worker.cjs)
```

Tagged releases are published automatically: pushing a `v*` tag runs
[`.github/workflows/release.yml`](.github/workflows/release.yml), which builds
the production bundle and attaches a runnable `ucc-mca-platform-<tag>.tar.gz` to
a GitHub Release.

```bash
git tag v1.2.3 && git push origin v1.2.3   # → builds + publishes the release
```

Download and run a release artifact:

```bash
tar -xzf ucc-mca-platform-v1.2.3.tar.gz && cd package
npm ci --omit=dev && node dist/server.cjs
curl -fsS http://localhost:3000/api/health   # smoke test
# or
SMOKE_URL=http://localhost:3000 npm run smoke
```

### Production (AWS via Terraform)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars  # Configure
terraform init && terraform plan              # Review
terraform apply                               # Deploy
```

Provisions: VPC with multi-AZ subnets, RDS PostgreSQL (encrypted, Multi-AZ), ElastiCache Redis (encrypted), S3 with lifecycle policies, CloudWatch + SNS alerting, IAM with least-privilege policies.

---

## Contributing

1. Fork and create a feature branch: `git checkout -b feature/your-feature`
2. Install: `npm install --legacy-peer-deps`
3. Develop: `npm run dev:full`
4. Test: `npm test` and `npm run test:server` (both runners must pass)
5. Lint: `npm run lint`
6. Commit: `git commit -m "feat: description"` ([Conventional Commits](https://www.conventionalcommits.org/))
7. Open a Pull Request

### Priority Contribution Areas

- **State agent implementations** -- additional implementations needed beyond CA, TX, FL, and NY
- **Enrichment sources** -- state business registries, county assessor records
- **Compliance expansion** -- additional state disclosure requirements
- **Performance** -- query optimization for very large prospect datasets (tens of thousands of rows and beyond)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide. Report security issues via [SECURITY.md](SECURITY.md).

---

## Tech Stack

| Layer          | Technology                                             |
| -------------- | ------------------------------------------------------ |
| Frontend       | React 19, TypeScript 5.9, Vite, Radix UI, Tailwind CSS |
| Backend        | Express, Node.js, BullMQ, Zod                          |
| Database       | PostgreSQL 15, Redis 7                                 |
| Scraping       | Puppeteer (headless browser automation)                |
| Integrations   | Twilio, SendGrid, Plaid, ACH, AWS S3                   |
| Testing        | Vitest, Testing Library, Playwright                    |
| Infrastructure | Terraform (AWS), Docker Compose, Kubernetes            |
| CI/CD          | GitHub Actions                                         |
| Deployment     | Vercel (frontend), AWS (backend)                       |

---

## Contact

Questions or issues? Reach out on GitHub: [@4444J99](https://github.com/4444J99)

---

## License

[MIT](LICENSE) -- [@4444J99](https://github.com/4444J99)
