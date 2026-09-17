# Dependency gate activation

The existing UCC rule is `validate-dependencies-required`, ID `12671627`.
`scripts/dependencies/ruleset-plan.py` prepares its exact update from a fresh,
complete settings snapshot and verifies the later readback. It performs no
network requests or settings writes. No automatic acceptance is enabled by this
plan or by a passing settings check.

## Recorded live state — September 9, 2026

The authenticated ruleset read returned `enforcement: disabled`, the default
branch scope, no bypass actors, and one required context,
`validate-dependencies`, with strict freshness disabled. Portfolio's repository
ruleset collection was empty. Classic branch protection remains unknown: both
repositories returned `403 Resource not accessible by integration` on their
protection endpoints. The connected GitHub API exposes ruleset reads but no
administration-write operation. This is a connection capability limitation,
not missing user authorization.

## Reviewed change and activation sequence

1. Accept and verify the maintenance workflow repair on UCC `main`. Observe
   successful `gate` from `.github/workflows/ci-gate.yml` and
   `validate-dependencies` from `.github/workflows/validate-dependencies.yml`
   at the current accepted-main revision. Preserve run URLs/IDs, attempts,
   workflow paths, publisher, and exact tested SHA. A staged PR or a check with
   the right name does not establish this prerequisite.
2. Using an existing administration-capable connection, read
   `GET /repos/organvm-iii-ergon/public-record-data-scrapper/rulesets/12671627`
   into a temporary `ruleset-before.json`. The complete `bypass_actors` field
   must be present; the planner refuses to replace undisclosed policy.
3. Run `python3 scripts/dependencies/ruleset-plan.py --snapshot ruleset-before.json`.
   Review the resulting `request.body`: it activates this same ruleset,
   requires both actual job names from GitHub Actions App `15368`, enables
   strict checks, and enforces them on branch creation. It preserves existing
   unrelated rules, contexts, scope, and bypass actors. Conflicting publisher
   identities, exclusions, or duplicate contexts stop planning for review.
4. Refresh the snapshot immediately before applying. If any setting changed,
   regenerate and review the plan. The settings owner applies its body to the
   displayed PUT endpoint only after the accepted-main prerequisite is proven.
   This script has no apply command. Do not use a repository workflow with
   newly supplied administrator credentials to bypass the connection limitation.
5. GET the same rule into temporary `ruleset-after.json`, then run
   `python3 scripts/dependencies/ruleset-plan.py --snapshot ruleset-before.json --readback ruleset-after.json`.
   A passing result proves settings equality, not enforcement behavior.
   Confirm live canaries block a failed required check and a stale candidate.

`gate` must remain a fail-closed aggregate of all compatibility and edge
typechecking jobs. `validate-dependencies` must remain a fail-closed dependency
evidence aggregate. Neither may disappear through path filtering or report
success when a required child failed, was cancelled, or was skipped.

Binding App `15368` reduces publisher ambiguity; another GitHub Actions workflow
can still impersonate the same context. Delegated review and automatic
acceptance therefore remain disabled until the existing governor/relay proves
trusted workflow identity, current base/head/merge revision and attempt, exact
evidence artifacts, policy, and adversarial canaries immediately before its
authorized action. This settings plan is not a substitute for that trust gate.

The next settings owner is an operator of an existing repository
Administration-write connection, after the maintenance PR acceptance owner
provides successful accepted-main receipts. No PR is merged by this procedure.

## Verification

Run `python3 -m unittest discover -s scripts/dependencies -p 'test_ruleset_plan.py'`.
Regressions cover preservation of unrelated policy, missing bypass information,
wrong repository/scope, conflicting publishers, duplicate contexts, weakened
freshness, disabled readback, and removed required checks.

GitHub's [repository rules API](https://docs.github.com/en/rest/repos/rules#update-a-repository-ruleset)
defines administration-write access, the ruleset update fields, strict status
checks, and optional integration binding. Its
[ruleset read documentation](https://docs.github.com/en/rest/repos/rules#get-a-repository-ruleset)
explains when bypass actors are omitted.
