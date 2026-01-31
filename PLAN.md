# Project Wrap Plan

## Goal

Bring the repository to a fully stable, shippable state with clear data-source tiering (OSS base, paid secondary), reliable scrapers, and a clean test/lint baseline.

## Current Snapshot

- Large local dirty state already captured.
- E2E suite is green, but CA scraper selector discovery is blocked by portal gating (login/CAPTCHA).
- Mock data is still the default in multiple flows; a settings menu now exposes OSS vs Paid tiers and routes tier selection into mock data generation + API headers.

## Workstreams (Order of Operations)

1. Baseline audit: inventory open issues, environment expectations, and current CI/local failures.
2. Data source tiering: confirm OSS and Paid routing end-to-end (headers -> server -> source selection).
3. Scraper hardening: stabilize CA/TX/FL/NY selectors, add diagnostics (screenshots/DOM dumps), and formalize error handling.
4. UI parity + accessibility: enforce heading/role semantics; remove warnings and regressions.
5. Backend readiness: validate routes, migrations, config validation, and runtime error handling.
6. Tests + flake reduction: unit/integration/e2e stable with documented timeouts.
7. Lint/type cleanup: resolve repo-wide lint errors and type drift.
8. Docs + onboarding: update README/CONTRIBUTING/AGENTS with accurate commands and env vars.
9. Security + compliance: dependency scan, secret scan, license checks.
10. Release readiness: verify build artifacts, containers, deployment configs, and publish checklist.

## TODO Checklist

- [ ] Capture baseline status (git status, lint/test reports, env requirements).
- [ ] Add server-side routing for `x-data-tier` (OSS base; paid secondary).
- [ ] Map OSS tier to `free-tier` sources and Paid tier to `starter-tier` sources.
- [ ] Finish CA portal selector capture (headed session + DOM dump).
- [ ] Re-enable strict scraper failures once selectors are stable.
- [ ] Stabilize TX/FL/NY scraping and pagination.
- [ ] Ensure mock data differences by tier are visible and documented.
- [ ] Confirm a11y + UI contract for e2e selectors.
- [ ] Run full lint + unit + e2e suites and fix regressions.
- [ ] Update contributor docs with tiering config and troubleshooting.
- [ ] Validate deployments (Docker/Vercel/K8s/Terraform).
