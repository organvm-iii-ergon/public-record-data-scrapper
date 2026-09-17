# UCC restoration checkpoint — 2026-09-17

Owner: `organvm-iii-ergon/public-record-data-scrapper`, restoration epic #461.
This is a session checkpoint, **not product acceptance**. The user requested
closeout before implementation of the newly discovered prospect/dashboard bridge.
No bridge code was changed. Preserve the complete restoration objective below.

## Verified checklist

Eight original items are delivered; three remain partial. This is an unweighted
task count, not a percentage of working product functionality.

- [x] Deliver and verify the existing Cloudflare credential; merge the CLAVIS repair — Limen #2677 and UCC secret metadata/readback.
- [x] Create and read back staging D1, KV, R2 and Access resources — UCC #516.
- [x] Merge the provisioning repair; run staging migrations and schema verification — #516 and subsequent successful staging deployment.
- [x] Upload the staging Worker — upload and staging deployment now verified separately.
- [x] Finish the single-trigger staging repair — #517 merged; latest staging deployment succeeds.
- [x] Complete durable job leases — #518 merged and runtime regression verified. This does not establish successful live business jobs.
- [x] Merge the verification foundation — repaired successor #524 merged. Preserve older #514/#519; do not close or delete them without disposition.
- [ ] Finish authenticated Pages and remove all runtime mock paths — Pages and no-mock changes deployed; signed-in, tenant-authorized acceptance remains with #465/#239.
- [ ] Connect authoritative tenant data and all six dashboard surfaces — #464 owns source-to-D1-to-API/dashboard/CLI delivery; missing bridge detailed below.
- [x] Repair and integrate the seven feature PRs — #508 billing, #512 rules, #520 documents, #521 entities, #522 referrals, #523 state registry, #527 audit integrity merged. Integration is not live acceptance of each business feature.
- [ ] Verify production, promote, and replace the old site — production Pages/Worker exist and GitHub Pages is retired; current-main promotion, scheduling and end-to-end acceptance remain with #465.

The goal tool available in the originating session could change only whole-goal
complete/blocked status, not rewrite its saved objective. The goal remains active;
this checked-in checklist corrects its stale PR/deployment descriptions.

## Receipts observed during this session

| Surface | Evidence | Verdict |
| --- | --- | --- |
| Remote main | `5eb67d83729919d8fef757590a5531837b51ef68` | Exact main observed |
| Staging Worker | [run 35185898136](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/runs/35185898136) at `5eb67d8` | Success |
| Staging Pages | [run 35185898153](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/runs/35185898153) at `5eb67d8` | Success |
| Production Worker | [run 35185056771](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/runs/35185056771) at `4942e668` | Upload/health succeeds; full deploy fails at cron quota |
| Production Pages | [run 35185058652](https://github.com/organvm-iii-ergon/public-record-data-scrapper/actions/runs/35185058652) at `4942e668` | Success; one commit behind observed main |
| Access boundary | Unauthenticated Pages request, curl with user config disabled | 302 to Cloudflare Access; not signed-in acceptance |
| Production D1 aggregate | Read-only remote SQL | 1 organization; 1 unclaimed enrollment; 0 active memberships, prospects, dashboard records or jobs |
| Retired GitHub Pages | Authenticated repository Pages API | 404; not proof of the replacement's business acceptance |

These are dated observations. Refresh live state before action; do not replay
deployment or creation merely because a receipt is old. Source gates are owned by
[CA #477](https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/477)
and [TX #478](https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/478),
both open at this audit. Never store credential values or private email bodies here.

## Next implementation: authoritative prospect/dashboard bridge

Owner: [#464](https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/464).
At the observed main, `POST /v1/prospects` writes only `prospects`, while
`GET /api/dashboard` reads only `dashboard_records`. Dashboard prospect imports
write only the latter. The runtime test creates different records separately and
therefore does not test end-to-end visibility. Legacy collectors persist to
PostgreSQL, and the edge schema lacks `ucc_filings`; credentials alone do not fix
the deployed data path.

Implement one provenance-required, tenant-scoped prospect import service that
validates a complete supplied record and atomically persists the canonical
prospect plus dashboard projection. Reuse it across authenticated imports and
collector delivery. Keep replay identity tenant-scoped even though the existing
canonical prospect primary key is global. Reject missing required observations;
do not invent industry, default dates, financial facts, health or priority scores.
Portfolio/competitor facts need their own source-backed inputs.

Required tests: one imported record appears in both API and dashboard; replay has
no duplicate; identical source IDs across tenants remain isolated; injected
projection failure rolls back both writes; incomplete/unprovenanced input rejects
without writes. Return stored observation/source metadata rather than presenting
browser-fetch time as source freshness. Existing record migration needs an
explicit, reversible policy, not deletion or synthetic backfill.

Inspect first: `cloudflare/workers/api/src/routes/{prospects,dashboard}.ts`,
`scripts/test-cloudflare-runtime.mjs`, `server/queue/workers/ingestionWorker.ts`,
the D1 migrations, dashboard payload types and `useDataFetching.ts`.

## Ownership and boundaries

- [#465](https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/465) owns deployment, Access enrollment/member acceptance, real job execution, rollback/restore and separate production receipts. #239/#235 remain canonical platform/security references.
- [organvm/ops#6](https://github.com/organvm/ops/issues/6) owns the external account-wide scheduling/usage handoff; see [ops-handoff.md](ops-handoff.md). Its charter currently describes GitHub Actions, so Cloudflare responsibility must be explicitly added before implementation. This checkpoint does not activate or migrate schedules.
- Preserve open #514/#519/#507 and every unrelated worktree. The root checkout remains behind main with pre-existing `err.txt`; do not reset, stash or sweep it.
- Existing CLAVIS/GitHub/Cloudflare access is sanctioned. Do not invoke `op`, re-authenticate, expose secrets, buy a plan, retire unrelated jobs or close issues to make a gate pass.
- No displayed mock data. Fixture-based local proof is separate from authoritative tenant data and live signed-in delivery.

## Continuation capsule

The canonical Limen launcher created the isolated `docs/ucc-restoration-20260917`
branch and its private README/intent/runtime/closeout modules. The tracked
[workstream.json](workstream.json) records a provider-neutral, unstarted 30-minute
runway. It does not record a future provider/model or promise completion.

On this workstation, launch only when resuming the task:

```sh
bash /Users/4jp/Workspace/public-record-data-scrapper/.worktrees/ucc-restoration-20260917/.limen-workstream/kickstart.sh
```

At entry, refresh main/PR/run states, source gates, tenant aggregate counts, host
admission and protected-session custody. Use a 30-minute attempt, at most 10 minutes
of verification, one heavy workload, and the inherited finite contract at packet
boundaries. Select the next implementation or acceptance step from that evidence.
If a gate blocks one path, preserve its owner receipt and pursue another authorized
path; do not exceed runway or start a duplicate provider.

## Checkpoint predicate versus product predicate

Run `node docs/continuations/ucc-restoration-20260917/verify-checkpoint.mjs` after
publication. It checks this session's clean/pushed branch, capsule module identity,
finite contract, remote owner pointers and launch syntax without launching an agent
or admitting the runway. Two identical successful runs establish only a durable,
zero-change **checkpoint**. They cannot mark the restoration goal complete.

Product acceptance still requires the original live-data and deployment predicates
in #464/#465, including signed-in tenant delivery through all six surfaces and
successful scheduled business jobs. A 302, health JSON, green local test, pushed
plan or successful upload is insufficient.

The global credential-wall check passed (28 registered atoms). The global
`no-tasks-on-me.sh` check failed on an unrelated, already-landed Limen branch;
that estate finding is [filed with Limen's branch-reap owner](https://github.com/4444J99/limen/issues/1818#issuecomment-5713875366), not UCC cleanup.
Do not delete another session's branch to manufacture a global closeout pass.

The new data-path finding is [recorded on #464](https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/464#issuecomment-5713874971);
the deployment/enrollment findings are [recorded on #465](https://github.com/organvm-iii-ergon/public-record-data-scrapper/issues/465#issuecomment-5713875162).
The empty bridge-attempt checkout may be removed only after this checkpoint is
pushed: its exact base is already main and no implementation changes exist. Retain
this continuation checkout for its tested launch path; preserve all other checkouts.
