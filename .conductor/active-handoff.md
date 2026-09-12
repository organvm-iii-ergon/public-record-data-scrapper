# Active Conductor Handoff Protocol

**System Status:** GREEN (CI Gate passing on `main` at `9ec58ea`)  
**Architecture:** 4-Lane Stewardship Architecture  
**Runtime Baseline:** Node `24.19.0`, npm `11.9.0` (strictly locked via `.nvmrc`, `package.json`, and `CONTRIBUTING.md`)

---

## 1. Operating Instructions for Incoming Autonomous Agents

You are entering the `public-record-data-scrapper` workspace. Work is organized into **four standing program lanes** to enable concurrent, conflict-free multi-agent execution.

### The Golden Invariants

1. **Never commit directly to `main` or any standing lane (`lane/*`)**:
   - All work must be conducted in an isolated git worktree on a short-lived branch:
     `work/<lane>/<issue-number>-<short-intent>`
2. **One Issue = One Worktree = One PR**:
   - Do not bundle multiple intentions or epics into a single branch or PR.
3. **Respect Concurrency Boundaries**:
   - Each lane owns distinct modules. Do not edit files outside your lane's domain.
4. **Preflight Before Push**:
   - Every branch must pass `./scripts/agent-harness.sh preflight` locally before creating a PR.
5. **PR Target**:
   - A work branch cut from `lane/<name>` must open its PR against `lane/<name>`.
   - Standing lanes are periodically promoted to `main` via dedicated sync PRs.

---

## 2. Lane-to-Issue Directory

| Standing Lane                | Primary Scope                                         | Issue Label   | Module Boundaries (Locked to this lane)                                                         |
| :--------------------------- | :---------------------------------------------------- | :------------ | :---------------------------------------------------------------------------------------------- |
| `lane/heal`                  | Repairs, bugfixes, test fixes, rot, dependency graph  | `lane:heal`   | `server/services/`, `server/routes/`, `server/middleware/`, `package.json`, `package-lock.json` |
| `lane/verify`                | Proof, contracts, CI pipelines, live-data receipts    | `lane:verify` | `server/__tests__/`, `tests/`, `.github/workflows/ci-gate.yml`, `scripts/__tests__/`            |
| `lane/expand-public-records` | State scrapers, public-record sources, adapters       | `lane:expand` | `scripts/scrapers/`, `src/lib/collectors/`, `scripts/scrape-*.ts`                               |
| `lane/evolve-platform`       | Platform consolidation, Cloudflare worker/Pages, APIs | `lane:evolve` | `cloudflare/`, `apps/web/`, `apps/mobile/`, `docs/`, `terraform/`                               |

---

## 3. Agent Lifecycle Workflow

To work on an issue using the automated agent harness:

```bash
# 1. Inspect available issues for your lane:
gh issue list --label lane:heal --label agent:ready

# 2. Claim the issue and create an isolated worktree:
./scripts/agent-harness.sh claim <issue-number>

# 3. Enter the newly provisioned worktree:
cd ../public-record-data-scrapper-worktrees/work-<lane>-<issue-number>-<slug>

# 4. Implement changes strictly within the lane boundary.

# 5. Run the local preflight gate:
./scripts/agent-harness.sh preflight

# 6. Submit the work (pushes branch, opens PR to owning lane, updates GitHub label):
./scripts/agent-harness.sh submit

# 7. If blocked or unable to complete:
./scripts/agent-harness.sh release <issue-number>
```

---

## 4. Locked Constraints & Non-Goals

1. **No Runtime Upgrades**: Node 26 or npm major changes are strictly prohibited. Node 24.19.0 / npm 11.9.0 is the enforced baseline.
2. **No Deleting History**: Branches and PRs with historical value are parked, not erased.
3. **No Phantom Expansion**: Do not claim 50-state coverage without verifiable, fail-closed scraper contracts.
4. **No Cross-Lane Contamination**: If a bug fix requires a test update, keep the test change focused strictly on regression proof.
