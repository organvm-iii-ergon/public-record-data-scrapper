# Verification foundation evidence

Base: `ee6b1e3` (`origin/main`, live-fetched). Owner: repository maintainers / Codex.
Status: **draft; not merge-ready**. Strict server checking reports 107 inherited
errors; no suppression or compiler relaxation was introduced. See
[diagnostics](server-typecheck.txt). Repair these before submitting a verified head.

Observed local results:

- Node policy tests: 12 passed, including executable failure/skip/cancel cases for
  staging acceptance and the stable PR gate.
- Cloudflare Python policy tests: 47 passed, including fresh/upgrade migration,
  schema drift, SQL literal preservation, credential failure and authentication
  counterexamples.
- Receipt tests: 5 passed; stale revision, branch, dependency, toolchain, local
  configuration, dirty tree, failed and missing check cases are rejected.
- Lint: exit 0, one inherited Fast Refresh warning in StatusDashboard.
- Server unit suite: 101 files passed; 1,586 tests passed, 6 existing skips.
  This ran without a database URL and does not prove database integration/coverage.
- Strict server TypeScript: exit 2, 107 diagnostics. This is an acceptance blocker.
- Shell syntax and unique migration version checks: passed.
- Actual Wrangler local D1: all three migrations applied; the exact workflow
  schema/history query returned JSON accepted by the verifier. Wrangler strips SQL
  comments; token comparison ignores comments while preserving quoted literal bytes.
  This is local emulator evidence, not Cloudflare resource or deployment evidence.

GitHub readback: classic main protection returned HTTP 404 (disabled). The only
listed repository ruleset, `validate-dependencies-required`, was disabled. Settings
were not changed because the proposed required contexts lack passing receipts.

No migration was renumbered; no remote data, secrets, resources or deployments were
changed. Feature PRs #507–#513 remain unintegrated. The full continuation and user
correction forbidding any displayed mock data are tracked in
[the restoration ledger](../../plans/2026-09-16-ucc-restoration.md).
