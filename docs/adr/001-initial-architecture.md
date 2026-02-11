# ADR-001: Initial Architecture and Technology Choices

## Status

Accepted

## Date

2026-02-11

## Context

`public-record-data-scrapper` is a TypeScript-based project within ORGAN-III (Ergon) of the organvm eight-organ creative-institutional system. The project needed a technology foundation that balances rapid prototyping with long-term maintainability, aligning with the organ system's emphasis on portfolio-quality engineering.

## Decision

We chose TypeScript as the primary implementation language, leveraging its ecosystem for web application development, type safety, and modern frontend/backend patterns. The project follows the organvm repository standards (documented in `docs/standards/10-repository-standards.md` of the planning corpus) and integrates with the cross-organ dependency graph maintained in `registry-v2.json`.

Key architectural choices:
- **Language**: TypeScript — selected for ecosystem fit and team expertise
- **CI/CD**: GitHub Actions with graceful degradation (tests, linting, type checking)
- **Documentation**: Portfolio-quality README (4,500+ words) targeting grant reviewers and hiring managers
- **Governance**: Follows ORGAN-IV orchestration rules; no back-edges in dependency graph

## Consequences

### Positive

- Consistent with organvm system-wide conventions
- CI pipeline catches regressions early with continue-on-error for non-critical checks
- Documentation-first approach ensures discoverability and portfolio value

### Negative

- Node.js version matrix (18/20/22) increases CI time
- Portfolio-quality documentation requires ongoing maintenance as the project evolves

## References

- Part of the [organvm eight-organ system](https://github.com/meta-organvm)
- Organ: ORGAN-III (Ergon)
- Registry: `registry-v2.json` in [organvm-corpvs-testamentvm](https://github.com/meta-organvm/organvm-corpvs-testamentvm)
