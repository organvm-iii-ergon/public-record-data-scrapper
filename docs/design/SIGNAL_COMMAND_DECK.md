# Signal Command Deck direction

Status: extracted from parked preserved-WIP issue #434. This document is a
current-purpose design direction, not an implementation mandate and not a
replacement for the public-records/UCC intelligence mission.

## Recovered intention

The preserved `claude/modest-morse-cd9309` branch proposed a "Signal Command
Deck": a dashboard that makes public-record intelligence, data freshness,
state/source coverage, and agent reasoning visible instead of presenting a
static table shell. The branch also bundled mockups, package churn, API
rewrites, and a framing that said the product is "not a public-record scraper";
that framing is not accepted here.

The accepted form is narrower: this repository remains a public-records/UCC
intelligence platform for MCA-relevant leads. The command deck is a UI/UX
evolution that exposes the truth of that system.

## Product invariants

1. Public-record provenance remains visible. Every signal should identify its
   source family, jurisdiction, freshness, and confidence.
2. Agentic reasoning is observable, not magical. Council findings, safety
   gates, and confidence/risk tradeoffs should be inspectable before an
   operator acts on a lead.
3. Coverage is a first-class surface. State/source availability, credential
   gates, stale data, portal outages, and fail-closed collectors should be shown
   as product truth rather than hidden operational detail.
4. Sales workflow remains grounded in evidence. Prospects, deals, contacts,
   communications, portfolio health, and requalification should connect back to
   records and signals.
5. The UI must preserve the current safety posture. It must not imply coverage,
   freshness, entitlement, or automation authority that the backend cannot
   prove.

## Candidate surfaces

| Surface           | Purpose                                                                                                                 | Existing anchors                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Command Deck      | Daily operating view: top public-record signals, hot prospects, stale-data warnings, active agents, and pipeline value. | `StatsOverview`, `StaleDataWarning`, `CoverageTab`, `AgenticTab` |
| Prospects         | Lead discovery, triage, claims, exports, and evidence drill-down.                                                       | `ProspectsTab`, `ProspectCard`, `ProspectDetailDialog`           |
| Prediction Engine | Per-lead reasoning view for MCA likelihood, confidence, underwriting risk, suppression checks, and next action.         | `mlScoring`, underwriting/suppression services, agentic findings |
| Coverage          | Jurisdiction/source readiness, credential gates, fail-closed collectors, and data freshness receipts.                   | state collectors, `StateCollectorFactory`, scrape/job telemetry  |
| Council           | Agent roster, improvement queue, safety gates, and approval history.                                                    | `AgenticEngine`, `AgenticCouncil`, `use-agentic-engine`          |
| Pipeline          | Deals, contacts, communications, outreach, and portfolio follow-up.                                                     | deals/contacts/communications tabs and server services           |

## Execution slices

Each slice should be a small PR from the relevant standing lane, with tests and
no mockup-only merges:

1. **Proof slice:** expose coverage/freshness receipts already produced by
   collectors, jobs, and telemetry.
2. **Reasoning slice:** persist and render agent/council findings that already
   exist in the in-repo agentic system.
3. **Shell slice:** add a command-deck landing surface that composes existing
   cards, coverage, and warnings without changing backend contracts.
4. **Prediction slice:** add a lead-level reasoning panel that ties scores to
   source evidence, confidence, and risk/suppression checks.
5. **Design-system slice:** consolidate tokens only after current components are
   mapped, accessible, and build-green.

## Explicit non-goals

- Do not import the stale branch's package-manager churn, obsolete migration
  numbering, or broad API rewrites.
- Do not merge unreferenced mockup images into `main`.
- Do not reframe this project away from public-record/UCC intelligence.
- Do not add external agentic dependencies unless they are optional, gated, and
  unnecessary for the core product to function.
- Do not use a redesign PR to bypass verification, entitlement, provenance, or
  deployment gates.

## Lineage

This direction preserves useful residue from:

- #434
- #247 / `claude/modest-morse-cd9309`
- #246 / `claude/epic-jackson-f4e82d`

The preserved branches remain evidence refs. They are not merge targets unless
a future successor extracts a smaller, verified slice.
