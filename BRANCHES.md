# Branch constitution

## Policy

GitHub Flow on top of a small set of standing program lanes. The lanes exist to
separate proof, repair, stated expansion, and platform evolution; they are not
dumping grounds. One intention still ships through one short-lived working branch
and one pull request.

No `develop` branch is used. This repo has no evidence that a broad integration
branch improves release truth, and adding one would hide unfinished work behind a
fashionable name.

## Standing branches

These refs should exist continuously for this repository:

| Branch                       | Purpose                                                                                                                                                       | Merge target    | Green means                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `main`                       | Production-true trunk. Always releasable.                                                                                                                     | tags / releases | CI Gate, validate-dependencies, Secret Scan, deploy-pages, and repository-owned deploy checks pass; purpose invariants hold. |
| `lane/verify`                | Proof lane for tests, contracts, CI, dependency validation, branch inventory, and reproducibility.                                                            | `main`          | The verification suite is stricter or equally true; no product behavior changes without explicit test coverage.              |
| `lane/heal`                  | Repair lane for rot that blocks shipping: stale PR recovery, dependency graph healing, security fixes, failing workflows, broken docs.                        | `main`          | The previously broken path has regression proof and current CI remains green.                                                |
| `lane/expand-public-records` | Stated-scope expansion: jurisdictions, public-record sources, adapters, provenance, and coverage that the README/product already claims or directly implies.  | `main`          | New coverage is fail-closed, provenance-backed, tested, and does not overclaim live deployment.                              |
| `lane/evolve-platform`       | Implied platform evolution: Cloudflare migration, release discipline, observability, DX, and architecture changes that make the current purpose more durable. | `main`          | Behavior is preserved except for documented changes; rollback/receipt evidence exists for deployment changes.                |

Standing lanes stay close to `main`. Sync by merging `main` into the lane through a
small maintenance PR when drift matters, or by recreating the lane from `main` only
after explicit written retirement/replacement approval. Never force-push a standing
lane to make history look clean.

## Runtime baseline

The supported application runtime is Node `24.19.0` with npm `11.9.0`, recorded in
`.nvmrc`, `package.json`, the active GitHub workflows, and the production Docker
image. The Cloudflare workspace follows the same baseline. Historical documentation
may mention older examples, but active build and deployment surfaces must use this
baseline.

## Working branches

All other branches are temporary worktrees, automation branches, or evidence refs.
Use one intention per branch. Cut from the relevant standing lane when the work is
part of that program; cut from `main` when the change is trunk-ready and does not
need lane integration.

| Pattern                                                                  | Purpose                                                                 | Merge target                           | Green means                                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `work/verify/<short-intent>` or `test/*`                                 | Proof, contracts, CI, inventory, reproducibility                        | `lane/verify` or `main`                | Verification becomes stronger without weakening current behavior                        |
| `work/heal/<short-intent>`, `fix/*`, `security/*`                        | Correctness, security, or production repair                             | `lane/heal` or `main`                  | Regression proof exists and the CI Gate passes                                          |
| `work/expand-public-records/<short-intent>`, `feat/*`                    | Jurisdiction/source/adapter expansion already inside stated scope       | `lane/expand-public-records` or `main` | New source coverage is tested, provenance-backed, and fail-closed                       |
| `work/evolve-platform/<short-intent>`, `chore/*`, `refactor/*`, `docs/*` | Platform, release, observability, documentation, or bounded refactoring | `lane/evolve-platform` or `main`       | Relevant checks pass and any behavior shift is documented                               |
| `hotfix/*`                                                               | Production break repair cut from `main`                                 | `main`, then back-port to lanes        | The production break is proven fixed and no lane is left contradictory                  |
| `dependabot/*`                                                           | Automated dependency update                                             | `lane/verify`, `lane/heal`, or `main`  | Dependency declarations remain locked and the CI Gate passes                            |
| `copilot/*`, `claude/*`, `limen/*`, `codex/*`                            | Agent-directed implementation, recovery, or preservation work           | Relevant lane or `main`                | The branch has a recoverable intention, explicit verification record, and reviewable PR |
| `capture/*`, `wip/preserve-*`                                            | Historical/snapshot evidence                                            | Never merge by default                 | The snapshot remains immutable evidence; it is not treated as product work              |

The prefixes above reflect branches present in the remote inventory. New naming should
prefer `feat/`, `fix/`, `chore/`, `docs/`, `test/`, or `security/`; legacy automation
prefixes remain classified rather than silently renamed.

## Lifecycle rules

1. Start from an up-to-date `main` or the relevant up-to-date standing lane; use a
   dedicated worktree for active work.
2. Keep commits focused and preserve the recovered intention in the PR description.
3. Run the smallest relevant local checks, then the repository CI Gate.
4. Merge only through a PR after review and required checks are confirmed.
5. Delete a working branch only after its intention is present on `main` or a linked
   successor preserves all unique work. Do not delete branches to hide unfinished work.
6. A family occupies one branch/issue/PR queue slot. Do not create sibling PRs for
   same-shaped retry failures; amalgamate them into one successor and link every
   member before closing anything.
7. Branches with unique residue are parked, not erased. A parking issue must record
   recovered intention, evidence, finish line, and the condition under which remote
   retirement is allowed.

## Remote branch forest

The branch forest is tracked as a stewardship artifact, not ignored noise. Current
family inventory and safe-retirement candidates live in #435.

- `capture/*` and `wip/preserve-*` refs are evidence streams. They are not merge
  targets and are not deletion candidates without explicit retention approval.
- Patch-equivalent merged work branches may be retired only after #435 records the
  candidate list and the linked PR/issue verdict proves no unique residue remains.
- Unique-residue branches receive successor issues before any closure or retirement.
  Current parked successors include #426, #434, #436, and #437.

## Hotfixes and releases

`hotfix/*` branches cut from `main`, merge back to `main`, then back-port to any
standing lane that would otherwise remain unsafe or contradictory. `release/*` is
reserved for an actual versioned release freeze; no standing release branch is
required by the current checkout.

## Explicitly forbidden

- No direct work commits to `main`.
- No force-push or history rewrite on `main`.
- No branch closure, deletion, or PR closure as a substitute for recovering intent.
- No merge of `capture/*` snapshots as if they were current implementation.
- No claim that CI is merge-enforcing until the GitHub branch-protection setting is
  confirmed by an administrator; local checkout evidence cannot prove enforcement.
