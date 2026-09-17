# External handoff: account-wide Cloudflare schedules and usage

Owner: `organvm/ops`; independent witness: `organvm/ops-witness`.
Durable owner: https://github.com/organvm/ops/issues/6.
Requested during UCC restoration; this is ownership filing, not runtime activation.
UCC's product-specific integration remains owned by UCC #465/#239.

## Observed problem

The earlier session audit found all five available account cron slots occupied:
`bountyscope` every 30 minutes, `edgarflash` every minute, `trendpulse` six times
daily, `vulnpulse` daily and UCC staging five times daily. UCC production had no
trigger. Re-enumerate the account before acting; these are dated observations.

Cloudflare emails observed for September 14/16 reported exhausting the daily KV
write allowance. A separate August alert concerned Durable Object rows written.
These are different quotas; cron consolidation alone does not resolve them.
September 16 adaptive analytics showed 1,098 KV write operations, including 960
for EdgarFlash state. Adaptive operation counts do not prove successful writes.
Do not publish account identifiers, namespace IDs, tokens or raw notification bodies.

## Required work

- Explicitly extend the ops charter for shared Cloudflare scheduling; do not
  assume the existing GitHub Actions charter already covers it.
- Inventory every trigger, worker, source repository, timezone, cadence,
  execution budget and dependency. Preserve all intended jobs and frequencies.
- Design and test a shared dispatcher with bounded fan-out, per-job timeout,
  isolation, idempotence, retry policy, start/end receipts and independent witness.
- Map actual alerts and usage to products/resources. Establish before/after KV,
  Durable Object, request and CPU budgets using live vendor evidence.
- Route write-amplification fixes to each product owner; avoid per-minute KV
  heartbeat writes, which alone would consume 1,440 operations per day.
- Provide a staged migration and rollback plan with exact readbacks. Prevent
  both double execution and silent gaps while freeing production schedule capacity.
- Verify daily usage and real scheduled execution after deployment, not only the
  number of triggers. File missing telemetry as unmeasured.

No paid upgrade, credential mint, unrelated task retirement, schedule cutover or
production deployment is authorized by this filing. Reuse existing authenticated
access without `op` prompts. Keep shared implementation external to the UCC session.

Acceptance: every prior job preserved with real execution receipts; UCC production
can schedule; operational failure remains visible; daily alerts tied to measured
causes and resolved with a verified usage margin or an explicitly approved paid
decision. The successor session must inspect live limits/docs before designing.
