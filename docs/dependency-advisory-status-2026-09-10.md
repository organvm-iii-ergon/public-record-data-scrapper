# Dependency advisory status — 2026-09-10

This note records the stewardship verdict for the root dependency advisory family
amalgamated in #426.

## Resolved by the current successor branch

- `puppeteer` is upgraded to `^25.10.0`.
- `extract-zip` is no longer present in the locked root dependency graph.
- `dompurify`, `body-parser`, `uuid`, `bullmq`, and the Cloudflare TypeScript
  update were already advanced through separate green dependency PRs before this
  branch.
- Root installs now omit undeclared peer dependency trees by policy via `.npmrc`;
  this prevents npm from auto-materializing optional native stacks that are not
  direct repository commitments.

## Remaining advisory family

`npm audit` still reports the Expo / Metro / React Native native-tooling family:

- `@expo/*`
- `expo`
- `expo-asset`
- `expo-constants`
- `metro*`
- `postcss`
- `image-size`
- `xcode` / nested `uuid`

The current npm advisory service proposes a semver-major Expo change, but testing
that path shifted the advisory surface into newer React Native tooling instead of
closing it. For this repo, forcing that major native-stack migration would be a
behavior change, not a safe advisory patch.

## Verdict

Status: parked for a dedicated native-stack migration successor.

Finish line: upgrade the Expo / React Native stack only when the replacement graph
passes a frozen install, native workspace start/build checks, root typecheck,
frontend tests, scraper tests, server tests, and `npm audit` without expanding the
advisory surface.

Close/delete allowed: no dependency or native-stack branch should be closed merely
because this partial advisory reduction exists. Exact duplicate dependency PRs may
be closed only after their package version is proven present on `main` and no unique
residue remains.
