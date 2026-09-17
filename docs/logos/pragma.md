# Pragma — Concrete State (honest account of what exists)

_Last updated: 2026-05-25. Authored from the audit-remediation session on branch
`claude/issue-discovery-reporting-2R1GO` (PR #234)._

This is the **honest** account — what is actually true in the code today, not the
idealized form. See `praxis.md` for the open vacuums and the forward plan.

## What this session produced

A full-codebase security/correctness audit (~150 findings) and its remediation,
implemented across six disjoint work-streams over two rounds, then integration-
verified.

### Remediated (present in tree, verified)

- **Multi-tenant isolation**: org is derived from the JWT `org_id` claim
  (`req.user.orgId`); a client-supplied `org_id` must equal it (else 403); a
  token with no org **fails closed** (403). Runtime-verified over HTTP
  (403 on cross-org, 403 on no-org, 400 on non-UUID, pass on match).
- **SQL injection** closed in `PortfolioService` ORDER BY (column allowlist).
- **Authz**: `requireRole` now gates mutations (runtime-verified: viewer→403,
  user→pass).
- **JWT**: `algorithms:['HS256']` pinned (runtime-verified: `alg:none`→401),
  secret mandatory in all envs (insecure fallback removed).
- **Webhooks** fail **closed** when unconfigured (runtime-verified: Stripe/
  Twilio/SendGrid/Plaid → 401). Plaid now does real ES256/JWK verification
  via `jose`.
- **TCPA/DNC**: `CommunicationsService` blocks sends to suppressed/no-consent
  contacts; consent single-channel revoke overrides an `all` grant.
- **Defense-in-depth**: RLS policies + tenant GUC wiring (`orgContext`
  AsyncLocalStorage → `app.current_org_id`); `org_id NOT NULL` + backfill;
  bounded CHECK constraints; `deal_number` uniqueness + advisory lock; audit
  TRUNCATE guard.
- **Infra/CI**: ALB-scoped security group (was 0.0.0.0/0:3000), Secrets-Manager
  RDS, CI command-injection fixed, action SHA-pinning (partial), Dockerfile
  prod-deps prune.
- **Frontend**: concurrency-correct collector rate limiter, Rules-of-Hooks fix,
  revived dead scheduler, agentic gate hardening, stale-selection batch fix,
  XSS href sanitizing; type errors 628→357.

### Verification status

- Server + `packages/core`: **0 TypeScript errors**.
- Server test suite: **1085 passing / 0 failing / 6 skipped**.
- Security behavior: driven at the real HTTP surface (see PR; auth/IDOR/role/
  webhook/alg-pinning all confirmed).
- **Not** runtime-driven: the DB-backed data path (no live Postgres/Redis here)
  and the frontend (type-only changes, no behavioral diff).

### Integrity (the "nothing lost" rule)

- local HEAD == remote HEAD (1:1); working tree clean.
- 10 dangling commits exist — all `WIP on <branch>:` git-stash snapshots from
  agent stash/pop; no `reset --hard` occurred; every agent deliverable is
  present in HEAD. **No work was lost.**

## Known-deliberate stubs (fail-closed, not bugs)

- `EnrichmentService` refuses to fabricate enrichment data → throws "not wired
  to live providers"; tests assert this contract.
- `AlertService` DEWS persistence is observable-stub (logs, no fabricated rows).
- `AgentOrchestrator` collection path is simulated and marked as such.
