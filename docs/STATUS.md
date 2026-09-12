# Repository steward status

**Snapshot:** `4444j99-telegram-feature-completion` at `a866ecb`  
**Remote:** `organvm-iii-ergon/public-record-data-scrapper`  
**Date:** 2026-09-10  
**Method:** local checkout plus read-only GitHub inventory; no remote mutations performed.

## Orientation

This repository extracts, enriches, and scores UCC filings from state Secretary of
State sources for MCA lead intelligence. The proven current scope is four collectors:
California, Texas, Florida, and New York. Done means those paths remain inspectable,
credential-gated sources fail closed, the API/worker/dashboard/CLI paths are runnable,
and the verification gate proves the claimed behavior. Green means the repository's
CI Gate passes; whether that workflow is configured as a required GitHub status check
is **[UNVERIFIED]** from this checkout.

## Verification inventory

| Surface                      | Canonical evidence                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Install                      | `npm ci` with root `package-lock.json` and `npm@11.9.0`                                                                           |
| Web build                    | `npm run build`                                                                                                                   |
| Full web/server render build | `npm run build:render`                                                                                                            |
| Lint                         | `npm run lint`                                                                                                                    |
| Typecheck                    | `npm run typecheck`                                                                                                               |
| Web + scraper unit tests     | `npm test`                                                                                                                        |
| Server tests                 | `npm run test:server`                                                                                                             |
| Scraper tests                | `npm run test:scrapers:unit`                                                                                                      |
| E2E                          | `npm run test:e2e`                                                                                                                |
| Database checks              | `npm run db:test`, `npm run db:migrate`                                                                                           |
| Authoritative workflow       | `.github/workflows/ci-gate.yml`: format, lint, typecheck, server/frontend/scraper/policy tests, build, and Cloudflare edge checks |

The runtime baseline is Node 24.19.0 with npm 11.9.0, matching `ci-gate.yml`, the
Cloudflare deployment workflow, `.nvmrc`, and the package manager declaration. Active
root workflows and the production Docker image now use this baseline. Historical
documentation may still contain older examples and is not an executable runtime
surface.

## Inventory A — branches

The remote inventory contains **307 branches**:

| Family                                           | Count | Classification                                                      |
| ------------------------------------------------ | ----: | ------------------------------------------------------------------- |
| `capture/*`                                      |   232 | Historical snapshot family; preserve as evidence, never bulk-delete |
| `limen/*`                                        |    20 | Agent/security automation family; recover by PR and evidence        |
| `dependabot/*`                                   |    16 | Dependency-update family; review in grouped batches                 |
| `fix/*`                                          |    12 | Product/security repair family                                      |
| `wip/*`                                          |     6 | Unclear or unfinished work; map to PR/issue before any disposition  |
| `work/*`, `feat/*`, `claude/*`, other automation |    20 | Short-lived or agent-directed work                                  |

The branch family is too large for per-branch closure decisions. Every member keeps
its history until a successor is green on `main` or a written parked verdict exists.

## Inventory B — pull requests

There are **28 open PRs**. The active families are:

- #421 enrichment response-content fix, ready implementation.
- #418 security/dependency advisory closure, ready implementation.
- #417–#413 and #412, #406, #405, #401, #400, #399, #398, #397, #395, #387,
  #377: Dependabot and dependency-update family; each requires lockfile and gate
  evidence, with major updates reviewed separately.
- #420 branch constitution / staging truth, draft governance work.
- #356 and #355: recovery PRs for API-key and resolved-tier contracts.
- #338–#335: repeated Limen security-hardening family; solve shared root causes,
  not four independent closure events.
- #263, #247, #246: draft release/PRD preservation work; recover intent before
  deciding whether implementation or documentation is the successor.

No open PR was closed or modified by this pass. PR check enforcement remains
**[UNVERIFIED]**.

## Inventory C — issues

There are **4 open issues**:

| Issue | Recovered intention                                                                         | Verdict                                                          |
| ----- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| #394  | Make OSHA free-tier enrichment reject HTML `200` responses instead of treating them as JSON | Active; related to #421's shared response-validation family      |
| #239  | Establish release discipline and Cloudflare deployment evolution                            | Active epic; blocked on accurate deployment truth                |
| #238  | Propagate PR #234 completions into external ORGANVM indices                                 | Active coordination work; remote ecosystem action not taken here |
| #235  | Record prerequisites for deploying PR #234 security hardening                               | Active prerequisite; should remain linked to deployment evidence |

## Inventory D — hidden work and hazards

- `continue-on-error` remains in selected backend coverage/reporting,
  data-pipeline, Terraform, and labeling steps. The desktop, mobile, and ESLint
  jobs no longer suppress their overall result; remaining advisory steps need
  explicit classification before they are treated as release evidence.
- `backend-tests.yml` and `data-pipeline-test.yml` still warn on selected failed
  tests, coverage, or audits instead of failing the job; `.github/workflows/ci-gate.yml`
  remains the stricter candidate for authoritative enforcement.
- Runtime pins were consolidated to Node 24.19.0 for active workflows and container
  builds; historical documentation remains a follow-up documentation cleanup.
- Kubernetes manifests still contain placeholder image tags and an internet-facing
  ingress TODO; Terraform has pending network-isolation TODOs.
- `eslint-code-scanning.yml` uploads SARIF findings and then fails when ESLint reports
  errors, so code scanning is no longer silently green.
- Existing docs include historical closure recommendations. Those are evidence only;
  this pass does not enact their deletion/closure recommendations.

## Verdict cards

### Family: enrichment response validation

- **Members:** issue #394, PR #421, related source-validation tests.
- **Intention:** distinguish successful JSON responses from HTML/error pages returned
  with HTTP 200, preserving fail-closed provenance.
- **Status:** ready-to-merge / active.
- **Finish line:** shared enrichment response parsing rejects non-JSON content with
  deterministic errors and targeted tests pass.
- **Next action:** review #421 against #394 and merge when the CI Gate is green.
- **Risk if abandoned:** false enrichment failures or misleading lead data.
- **Close/delete allowed:** no, until the successor is on `main`.

### Family: dependency and security hardening

- **Members:** PRs #418, #417–#413, #412, #406, #405, #401, #400, #399, #398,
  #397, #395, #387, #377, and PRs #338–#335.
- **Shared root cause:** many automated updates and hardening passes accumulated
  without one consistently enforced compatibility gate.
- **Status:** needs-heal / active.
- **Finish line:** grouped updates have lockfile evidence, major-version notes, and
  green authoritative checks; unique security residue is retained.
- **Next action:** use #418 and the CI Gate as the proof path, then process compatible
  Dependabot batches.
- **Risk if abandoned:** unresolved advisories, dependency drift, and repeated PR
  churn.
- **Close/delete allowed:** no; preserve each member until unique work is accounted for.

### Family: governance and deployment truth

- **Members:** PR #420 and issues #239/#235, with runtime/deployment docs and manifests.
- **Intention:** make release, staging, branch, and deployment claims match executable
  evidence.
- **Status:** active / needs-heal.
- **Finish line:** branch constitution, runtime matrix, deployment prerequisites, and
  CI enforcement boundary are documented and validated.
- **Next action:** land local constitution/status artifacts, then use a dedicated PR
  or issue comment for remote linkage when authorized.
- **Risk if abandoned:** agents and maintainers make incompatible assumptions about
  what is deployable or merge-safe.
- **Close/delete allowed:** no.

### Family: recovered feature/contract work

- **Members:** PRs #356, #355, #263, #247, #246 and related historical branches.
- **Intention:** preserve unique API contract, release, and PRD work while bringing it
  back to current `main`.
- **Status:** active / requires intent recovery.
- **Finish line:** each unique behavior is either integrated with tests or represented
  in a linked successor artifact.
- **Next action:** inspect changed files and current comments before any state change.
- **Risk if abandoned:** loss of prior domain decisions and repeated reimplementation.
- **Close/delete allowed:** no.

## Ordered waves

### Wave 0 — stop the bleeding

1. Treat `.github/workflows/ci-gate.yml` as the strongest local verification contract;
   keep advisory workflows explicitly non-authoritative until their failure semantics
   are repaired.
2. Keep the Node 24.19.0/npm 11.9.0 runtime baseline synchronized across active
   workflows, local tooling, and deployment images.
3. Keep all placeholder deployment and stateful-service risks visible; no production
   data migration or infrastructure mutation is attempted in this pass.

### Wave 1 — finish in-flight work

1. Advance the enrichment validation family (#394/#421).
2. Advance the security/dependency family (#418 and compatible update PRs), preserving
   major-version review and lockfile evidence.
3. Recover the governance/deployment family (#420/#239/#235).

### Wave 2 — issues without a branch

Advance #238 only when the required external ORGANVM index mutation is explicitly
authorized. Keep #235 linked to deployment prerequisites rather than closing it when
documentation merely exists.

### Wave 3 — stated-scope expansion

Expand beyond CA/TX/FL/NY only after the existing collectors, access gates, and
authoritative checks remain green. New jurisdiction work must use the existing
collector-factory/test patterns.

### Wave 4 — evolution

Resolve runtime consolidation, advisory workflow semantics, Kubernetes image
provenance, Terraform subnet isolation, and observability improvements as separate,
reviewable intentions.

## First local actions taken

- Renamed the working branch before edits.
- Created `BRANCHES.md` as the durable constitution.
- Created this evidence-backed `STATUS.md`.
- Declared Node 24.19.0/npm 11.9.0 as the active runtime baseline and synchronized
  active workflows and the production Docker image.
- Changed ESLint SARIF scanning to upload findings and then fail the job when ESLint
  reports errors; it is no longer silently green.
- Preserved all remote issues, PRs, and branch families; no remote mutation was made.

## Illogical or unsafe items

No item is declared illogical in this pass. Historical branch-audit recommendations
to close or delete artifacts are not sufficient evidence for deletion under the
current stewardship rule. The only clearly unsafe practice identified is treating
advisory workflows that swallow failures as proof of a green release; that is a
workflow semantics issue to heal, not a reason to delete the workflows.
