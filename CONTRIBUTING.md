# Contributing to UCC-MCA Intelligence Platform

Thank you for your interest in contributing to the UCC-MCA Intelligence Platform! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (v9 or higher)
- Git

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/ivi374forivi/public-record-data-scrapper.git
   cd public-record-data-scrapper
   ```

2. Install dependencies:

   ```bash
   npm ci
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Dependency maintenance

Use Node 24.19.0 and npm 11.9.0 from the repository root for all `apps/*` and
`packages/*` workspaces. Both package-manager declarations and maintenance CI use
this exact npm version. Node 20 no longer satisfies the committed `concurrently`
and Cloudflare `wrangler` engine requirements; the maintenance gates use Node 24.
The root `package-lock.json` is their authoritative dependency graph;
`cloudflare/package-lock.json` independently locks the edge application.
Do not create additional pnpm, Yarn, or workspace-local lockfiles. Use
`npm install <package>` (with `--workspace <path>` when appropriate) only when
intentionally updating a dependency, and commit the affected manifests and lock.

Dependabot checks weekly. Compatible minor and patch version updates are
grouped; major updates remain individual reviews. Security updates stay outside
those version groups. Cloudflare participates in the same intake.

Cloudflare validation and deployment use Node 22 to satisfy the locked Wrangler
runtime requirement. Run `node scripts/verify-cloudflare-toolchain.mjs` after the
edge install to prove that the installed CLI matches the lock and actually starts.
Deployments invoke this local binary directly and never install an alternate CLI.
Staging also records read-only Cloudflare account and UCC resource metadata checks
using the existing token. These observations never select deployment targets or
replace required credentials and bindings. Credentials and raw API payloads are
never printed. Run `python3 scripts/test_diagnose_cloudflare.py` to exercise the
request and output boundaries offline.
Staging selects the API-verified account in `cloudflare/wrangler.toml`; it does
not depend on a GitHub account-ID secret. Production retains its existing manual
gate and account override. Staging deployment rejects placeholder D1, KV and
Access bindings before remote mutations. Ordinary dependency PRs exercise the
guard's offline counterexamples without requiring live resource provisioning.

For each update, `validate-dependencies` must complete both frozen installs and
leave the declarations unchanged. Its PR-only `Dependency Review` step fails on
newly introduced high or critical vulnerabilities, including development and
unknown scopes. This step consolidates the previously disabled standalone
dependency-review workflow into the active validation job and still runs when
an earlier validation step fails. A passing push or manual validation run skips
this PR-only check and does not establish security-delta acceptance.
It evaluates the changed dependency graph; unchanged vulnerabilities still need
their own repairs and a passing delta check is not a clean-bill-of-health audit.
Use the workflow's tested checkout, PR head and lock hashes when reviewing results.

CI Gate runs independent formatting, lint, TypeScript, frontend tests, server tests,
scraper tests and production-build jobs. Cloudflare has its own frozen install and
typecheck. Its aggregate `gate` fails if any lane fails, is skipped or is cancelled.
The formerly advisory root TypeScript command is now `npm run typecheck` and must
pass; its four test-helper typing errors are repaired without widening the compiler
or suppressing diagnostics. The standalone frontend CI workflow remains disabled;
frontend correctness is now exercised by the active CI Gate. Coverage thresholds,
desktop/mobile execution and deployment are separate from these acceptance claims.

The dependency validation artifact records exact base, head, tested checkout and
workflow revisions; per-lockfile hashes; every dependency-entry change; and npm
advisory observations for both the base and tested graph. A passing dependency-review
step only establishes its own changed-dependency policy, not advisory closure. Audit
transport/schema failures produce an explicit exception. Removed advisories are
recorded as resolved observations, while unchanged vulnerabilities remain visible.
The receipt is evidence for delegated review, never merge authorization. The trusted
relay/governor must independently verify workflow/helper identity, actual check
results, the live head/base and strict required-check enforcement before acceptance.
Major updates, unusual graph/source changes and policy changes remain exceptions.

### Running the Application

- **Development**: `npm run dev` - Starts the Vite dev server
- **Build**: `npm run build` - Creates a production build
- **Preview**: `npm run preview` - Preview the production build locally
- **Lint**: `npm run lint` - Run ESLint to check code quality

### Data Tiering

- The UI settings menu sets the `x-data-tier` header (`oss` or `paid`).
- Server routing resolves tiers to `free-tier` or `starter-tier` and applies limits.
- Tiered envs use the `FREE_TIER_*` / `STARTER_TIER_*` prefixes (see `server/README.md`).

### Code Style

- This project uses ESLint for code quality and consistency
- Run `npm run lint` before committing to ensure your code follows the project's style guidelines
- The project uses TypeScript - ensure all type definitions are properly maintained
- Follow React best practices and hooks guidelines

### Project Structure

Please maintain the existing project structure:

```
./src
  /components     # React components
    /ui          # Reusable UI components (Radix-based)
  /lib           # Utilities and types
    /agentic     # AI agent orchestration system
  /hooks         # Custom React hooks
  /styles        # Global styles
```

## Making Changes

### Branches

- Create a new branch for each feature or bug fix
- Use descriptive branch names (e.g., `feature/export-enhancement`, `fix/health-score-calculation`)

### Commits

- Write clear, concise commit messages
- Use present tense ("Add feature" not "Added feature")
- Reference issue numbers when applicable

### Pull Requests

1. Ensure your code passes all linting checks: `npm run lint`
2. Test your changes thoroughly
3. Update documentation if you're changing functionality
4. Create a pull request with a clear description of the changes

## Code Quality

- **TypeScript**: Maintain type safety throughout the codebase
- **Components**: Keep components focused and reusable
- **Performance**: Consider performance implications of your changes
- **Accessibility**: Ensure UI components are accessible

## Testing

- Test your changes in development mode before submitting
- Verify the production build works: `npm run build && npm run preview`
- Test responsive design on different screen sizes

## Documentation

- Update the README.md if you're adding new features
- Add JSDoc comments for complex functions
- Update type definitions when modifying data structures
- Keep the PRD.md and other documentation files current

## Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Browser and OS information
- Screenshots if applicable

## Feature Requests

We welcome feature requests! Please:

- Check if a similar request already exists
- Provide a clear use case for the feature
- Explain how it aligns with the project goals

## Questions?

If you have questions about contributing, feel free to open an issue for discussion.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT License.
