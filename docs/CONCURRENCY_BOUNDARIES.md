# Concurrency Boundaries & Multi-Agent Domain Matrix

To enable multiple autonomous agents to work concurrently across local and remote environments without collisions, merge conflicts, or repository drift, this document defines strict domain and filesystem boundaries.

---

## 1. Domain Ownership Matrix

| Standing Lane                    | Primary Focus                                                   | Exclusively Owned Paths & Modules                                                                                                  | Forbidden Paths (Read-Only)                                                     |
| :------------------------------- | :-------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| **`lane/expand-public-records`** | Scrapers, jurisdictions, data extraction                        | `scripts/scrapers/**`<br>`src/lib/collectors/**`<br>`scripts/scrape-*.ts`<br>`scripts/cli-scraper.ts`                              | `server/**`<br>`cloudflare/**`<br>`package.json`<br>`package-lock.json`         |
| **`lane/heal`**                  | Bugfixes, pipeline repairs, dependency hygiene                  | `server/services/**`<br>`server/routes/**`<br>`server/middleware/**`<br>`package.json`<br>`package-lock.json`<br>`server/index.ts` | `cloudflare/**`<br>`apps/web/src/components/**`<br>`scripts/scrapers/states/**` |
| **`lane/verify`**                | Proof, testing suites, CI gates, verification contracts         | `server/__tests__/**`<br>`tests/**`<br>`scripts/__tests__/**`<br>`.github/workflows/ci-gate.yml`<br>`scripts/verify*.ts`           | `apps/web/src/**`<br>`server/routes/**`<br>`cloudflare/**`                      |
| **`lane/evolve-platform`**       | Cloudflare Workers, web dashboard, mobile, public API, webhooks | `cloudflare/**`<br>`apps/web/**`<br>`apps/mobile/**`<br>`docs/**`<br>`terraform/**`<br>`server/routes/api/**`                      | `scripts/scrapers/states/**`<br>`package-lock.json` (root)                      |

---

## 2. Collision Avoidance Protocols

### Rule 1: Single Lockfile Mutator

Root `package-lock.json` may **only** be modified via `lane/heal` (under issue #489 or emergency dependency repair). If an expansion or platform agent needs a new package, it must first file an issue against `lane/heal`.

### Rule 2: Ephemeral Worktrees

Every agent executes in an isolated worktree created via `./scripts/agent-harness.sh claim <issue-id>`. Multiple agents never edit files in the same working tree.

### Rule 3: Fail-Closed Interfaces

When an agent working on `lane/expand-public-records` adds a new state scraper, it must implement the existing `BaseScraper` contract and fail closed when credentials or selectors are unconfigured. It must not alter the core server routing engine.

### Rule 4: Claim Locking on GitHub

Before an agent begins modifying code:

1. Issue must have label `agent:ready`.
2. Agent runs `./scripts/agent-harness.sh claim <id>`.
3. Script updates label to `agent:claimed` and records the agent ID and worktree timestamp on the issue.
4. Any second agent attempting to claim the issue will be rejected.
