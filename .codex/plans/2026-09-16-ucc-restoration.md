# UCC restoration implementation ledger

Owner: repository maintainers; implementation session: Codex, 2026-09-16.
Authority: user-approved restoration plan supplied in this session.

User correction: **no mock data AT ALL**. This supersedes every permission to
show demo data, including Austin or development-mode fixtures in the application.
Show real records, honest empty states, or actionable errors. Test fixtures remain
isolated verification inputs and must never enter a shipped runtime.
Baseline: `ee6b1e3`, fetched from `origin/main`; seven feature PRs remain open.
Checkout retention: retain `fix/ucc-verification-foundation` and its isolated worktree
until its reviewed corrections land. Existing worktrees were not changed.

## Acceptance boundary

Completion requires observed PR merges and authenticated, persisted Cloudflare
runtime behavior. A local passing check, queued merge, or diagnostic artifact is
not production acceptance. Node 24.19.0 and npm 11.9.0 remain the supported runtime.
The existing spending boundary applies. Render remains recoverable until parity.
No standing branch may be rewritten or removed.

## Packet 1: truthful verification (in progress)

- Extend CI Gate, dependency validation, secret scanning, backend tests, and
  applicable Cloudflare verification to all four standing-lane PR bases.
- Retain `gate`; add stable `pr-gate`, including backend migration and coverage
  results through a reusable workflow. Do not enforce required contexts remotely
  until they have valid receipts.
- Add strict server TypeScript checking; preserve database test isolation using
  current Vitest worker controls. Backend migrations, tests, and coverage must fail
  visibly, with optional reporting separated from acceptance.
- Reject deployment acceptance when provisioning, configuration, migration, schema,
  deployment, or runtime verification fails or skips; retain diagnostic artifacts.
- Verify every D1 migration's schema objects and applied history, including indexes
  and triggers, with fresh/upgrade counterexamples.
- Bind harness receipts to clean Git revision/tree, branch, installed dependency
  lock, toolchain, and completed commands; reject old or incomplete receipts.
- Reject duplicate migration versions in both database stores before migration.

Strict checking exposed inherited server errors. These are blockers to a verified
merge, not grounds to suppress the compiler. Detailed results accompany this plan.

## Ordered remaining packets (not completed)

1. Repair exposed server/compiler and security failures, then land the verified
   foundation through the existing PR and exact-head merge-drain process. Synchronize
   main into all four lanes through maintenance PRs. Read back PR-only protections,
   required `pr-gate`, `validate-dependencies`, `Secret Pattern Detection`, and force
   push/deletion prohibition only after valid context receipts exist.
2. CLAVIS: implement a narrow local delivery path in its owning repository, consuming
   the sanctioned cached Cloudflare token, verifying fixed account/repository, and
   writing only this repository's `CLOUDFLARE_API_TOKEN` via stdin with sanitized
   metadata/readback. Preserve hosted App requirements. Reconcile stale `Personal`
   vault reference through provisioning with `Limen-Automation`, preserving source
   provenance. Verify delivery in an actual accepted deployment workflow.
3. Provision staging D1/KV/R2/Worker/Access with identity readback and production
   separation. Prove resource writes, all migrations, deployment revision, enrolled
   access, scheduled execution, and completed durable work. Production uses the
   same validated process and explicit accepted-staging promotion.
4. Deploy Pages `ucc-mca-dashboard-staging` and `ucc-mca-dashboard` (append `-ivixivi`
   only on provider collision). Pages Functions forward `/api/*` and `/v1/*` via
   corresponding `API` service binding. SPA base `/`, API base `/api`. Explicitly
   protect production hostnames with Access as well as previews.
5. Restore DashboardApp; remove Austin and all mock/demo selection from the runtime.
   Production must never use synthetic business records after errors. Separate Spark
   initialization from API configuration. Preserve response envelopes and validate
   frontend mapping; independently test `/v1` compatibility.
6. Implement verified identity and authoritative membership in `/api/session`;
   return tenant/role/subscription/capabilities. Enforce server entitlements and scope
   caches by tenant. Reject cross-tenant, forged/expired, unpaid and unauthorized use.
7. Complete persisted prospects (filters, details, claims, exports, filings,
   provenance, scoring), portfolio (health/history/summaries), deals (detail view,
   CRUD, stages, documents, checklists), underwriting (statement/bank-link actions,
   saved readback), intelligence (competitors and supported-source `/api/search`),
   analytics (whole-tenant server aggregates), and `/api/user-actions`. Preserve
   contacts, communications, compliance, and integration capabilities.
8. Replace PostgreSQL/filesystem/queue runtime dependencies with D1, private runtime
   configuration, R2 and durable adapters. Preserve authoritative private data before
   migration; reconcile tenant ownership, identifiers, relationships, counts and
   representative payload hashes. Fix secret disclosure, API-key role escalation,
   outbound destination validation, webhook signing/dispatch/replay/event delivery,
   leased jobs with ownership/retry/crash recovery, real provider verification, and
   receipt hash verification against actual bytes before exposure.

## Feature integration order and review duties

Each corrected head must include evidence-backed review-thread dispositions,
including duplicates, outdated and already-fixed findings. Submit each verified
head once; preserve actual merge receipts. Promote completed lane groups to main
and synchronize dependent lanes.

| Order | PR   | Required corrections                                                                                                                                                            |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | #507 | Adapter registration and ingestion use, configuration/source gates, recovery; distinguish five-file delta from inherited defects.                                               |
| 2     | #512 | Calendar/lapse rules, entity/collateral classification, assignees, required fields, disclosure dates; normalize before persistence.                                             |
| 3     | #509 | Parties/jurisdiction, amendment lineage, rasterization before OCR, bounded decoding/decompression, unknown facts, authenticated endpoint docs.                                  |
| 4     | #510 | Types, false matches, thresholds, full candidate populations, ambiguous people/businesses; platform ownership.                                                                  |
| 5     | #508 | Durable idempotent reporting, atomic claims, periods, trusted tiers/limits, acknowledgements, edge usage wiring.                                                                |
| 6     | #511 | Authenticated referral/signup/conversion, idempotency, suspension, authorized payouts, tenant isolation, canonical URLs.                                                        |
| 7     | #513 | Canonical hashes, concurrent ordered appends, tenant identity, signed exports, filtering/backfill/bounded verification; separate unrelated edits and assign platform ownership. |

Preserve unfulfilled CA-access, TX-authentication, SEO, pricing and historical
backfill issue intentions. Reserve PostgreSQL 027 billing, 028 referrals, 029 audit;
D1 0004 leases and 0005 unpublished metering. Inspect actual applied histories before
renumbering; no migration history was changed in this packet.

## Final rollout predicates

- Authenticated browser exercises all six surfaces with real persisted records;
  claims/deals/documents/underwriting writes survive reload.
- Fresh and upgrade migrations pass; concurrent claims, billing and audit writes are
  safe; interrupted jobs recover.
- Failed checks prevent merge; failed deployment never reports acceptance.
- Production promotion records accepted staging revision, Worker/Pages deployment
  IDs, verified data, public URL behavior, and rollback evidence.
- Only after production acceptance replace GitHub Pages with compatibility redirect
  HTML preserving path, query and fragment. Remove Render dependence only after
  Cloudflare data and behavior parity are observed.

No credential delivery, resource mutation, deployment, branch-protection change,
feature-PR merge, or production acceptance has been established by this packet.
