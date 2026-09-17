/**
 * Cron handler — the $0 async pipeline.
 *
 * telos: "Async pipeline → Queues (Cron + a D1 drain at the $0 floor)". Until
 * the $5 Workers Paid plan unlocks real Queues/Durable Objects, scheduled work
 * is driven by Cron Triggers and a D1 `jobs` table that we drain each tick.
 * This mirrors the old BullMQ topology:
 *   - "0 2 ..."  daily 02:00     -> ucc-ingestion
 *   - every 6h                   -> data-enrichment
 *   - every 12h                  -> health-scores
 *
 * Fail-safe by construction: a thrown handler is caught and logged, never
 * crashing the tick; a failing job is marked `failed` and skipped, never
 * blocking the rest of the drain.
 */
import { all, run } from './db'
import type { Env } from './types'
import { drainWebhookDeliveries, sendWebhookDelivery } from './webhooks'
import { pushProspectToCrm } from './crm'

interface JobRow {
  id: string
  type: string
  payload: string | null
  org_id: string | null
  attempts: number
}

const MAX_ATTEMPTS = 5
const DRAIN_BATCH = 25
const JOB_LEASE_MINUTES = 15

// --- Scheduled-task stubs (would enqueue per-state / per-prospect work) ------

async function runIngestion(env: Env): Promise<void> {
  // TODO: port server queue `ucc-ingestion`. Fire per-state scraper Workers,
  // stream rows to D1 (prospects/ucc_filings), large payloads to R2 ARTIFACTS,
  // and re-enqueue failures into the `jobs` table.
  console.log(`[cron] ingestion tick (env=${env.ENVIRONMENT}) — stub`)
}

async function runEnrichment(env: Env): Promise<void> {
  // TODO: port server queue `data-enrichment`. Enrich org-scoped prospects.
  console.log(`[cron] enrichment tick (env=${env.ENVIRONMENT}) — stub`)
}

async function runHealthScores(env: Env): Promise<void> {
  // TODO: port server queue `health-scores`. Recompute priority/health scores
  // (telos: Workers AI + Vectorize replace hand-rolled heuristics).
  console.log(`[cron] health-scores tick (env=${env.ENVIRONMENT}) — stub`)
}

/**
 * Process a single dequeued job. Dispatch by `job.type`.
 */
async function processJob(env: Env, job: JobRow): Promise<void> {
  let parsedPayload: Record<string, unknown> = {}
  if (job.payload) {
    try {
      parsedPayload = JSON.parse(job.payload)
    } catch {
      // ignore
    }
  }

  switch (job.type) {
    case 'webhook_delivery': {
      const deliveryId = parsedPayload.deliveryId as string
      const orgId = job.org_id
      if (!deliveryId || !orgId) {
        throw new Error(`Missing deliveryId or org_id in webhook_delivery job ${job.id}`)
      }
      const res = await sendWebhookDelivery(env, deliveryId, orgId)
      if (!res.success) {
        throw new Error(res.error ?? `Webhook delivery failed with status ${res.status}`)
      }
      return
    }
    case 'crm_push': {
      const prospectId = parsedPayload.prospectId as string
      const orgId = job.org_id
      if (!prospectId || !orgId) {
        throw new Error(`Missing prospectId or org_id in crm_push job ${job.id}`)
      }
      const res = await pushProspectToCrm(env, orgId, prospectId)
      if (!res.success) {
        throw new Error(res.error ?? 'CRM push failed')
      }
      return
    }
    default:
      throw new Error(
        `No handler for job type "${job.type}" — not yet ported (org=${job.org_id ?? 'none'})`
      )
  }
}

/**
 * Drain pending jobs from D1. Always runs on every cron tick (the $0 queue).
 * At-least-once: a job is marked `processing` before work, then `done` or
 * `failed`. Per-job try/catch means one bad job never stalls the batch.
 */
export async function drainJobs(env: Env): Promise<void> {
  let jobs: JobRow[]
  try {
    // Recover work abandoned by an evicted/timed-out isolate. The lease is
    // refreshed only by a successful claim, so a later tick can safely retry.
    await run(
      env,
      `UPDATE jobs
          SET status = 'pending', claimed_at = NULL
        WHERE status = 'processing'
          AND claimed_at IS NOT NULL
          AND datetime(claimed_at) <= datetime('now', ?)`,
      `-${JOB_LEASE_MINUTES} minutes`
    )
    jobs = await all<JobRow>(
      env,
      `SELECT id, type, payload, org_id, attempts
         FROM jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ?`,
      DRAIN_BATCH
    )
  } catch (err) {
    console.error('[drain] failed to read jobs queue', err)
    return
  }

  for (const job of jobs) {
    try {
      // Atomic claim: the status='pending' guard + changes check means only one
      // drain wins a job, so overlapping ticks (a manual /__scheduled during a
      // real cron) can't double-process. Claim is at-most-once; processing stays
      // at-least-once if a later step fails (the job returns to 'pending').
      const claim = await run(
        env,
        `UPDATE jobs
            SET status = 'processing', attempts = attempts + 1, claimed_at = datetime('now')
          WHERE id = ? AND status = 'pending'`,
        job.id
      )
      if (claim.meta.changes !== 1) {
        // Already claimed by another tick — skip without touching it.
        continue
      }

      await processJob(env, job)

      await run(env, `UPDATE jobs SET status = 'done', claimed_at = NULL WHERE id = ?`, job.id)
    } catch (err) {
      console.error(`[drain] job ${job.id} failed`, err)
      const nextStatus = job.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'pending'
      try {
        await run(
          env,
          `UPDATE jobs SET status = ?, claimed_at = NULL WHERE id = ?`,
          nextStatus,
          job.id
        )
      } catch (markErr) {
        console.error(`[drain] could not mark job ${job.id} as ${nextStatus}`, markErr)
      }
    }
  }
}

/**
 * Cloudflare Cron entrypoint. Routes by schedule, then always drains the queue.
 * Uses ctx.waitUntil so work continues past the handler return.
 */
export async function scheduled(
  event: ScheduledController,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const task = (async () => {
    try {
      switch (event.cron) {
        case '0 2 * * *':
          await runIngestion(env)
          break
        case '0 */6 * * *':
          await runEnrichment(env)
          break
        case '0 */12 * * *':
          await runHealthScores(env)
          break
        default:
          console.warn(`[cron] unrecognized schedule: ${event.cron}`)
      }
    } catch (err) {
      // Fail-safe: a broken scheduled task never aborts the drain below.
      console.error(`[cron] scheduled task error for ${event.cron}`, err)
    }

    // The $0 queue: always drain pending jobs and webhook retries regardless of which cron fired.
    await drainJobs(env)
    await drainWebhookDeliveries(env)
  })()

  ctx.waitUntil(task)
}
