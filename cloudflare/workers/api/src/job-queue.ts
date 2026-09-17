import { first, run } from './db'
import type { Env } from './types'

export interface ClaimedJob {
  id: string
  type: string
  payload: string | null
  org_id: string | null
  attempts: number
  lease_owner: string
  lease_expires_at: number
}
export const JOB_MAX_ATTEMPTS = 5
export const JOB_LEASE_MS = 5 * 60 * 1000

export async function claimJob(env: Env, now = Date.now()): Promise<ClaimedJob | null> {
  await run(env, `UPDATE jobs SET status = 'failed', lease_owner = NULL, lease_expires_at = NULL
    WHERE attempts >= ? AND (status = 'pending' OR
      (status = 'processing' AND COALESCE(lease_expires_at, 0) <= ?))`, JOB_MAX_ATTEMPTS, now)
  // Selection and mutation are one D1 statement, so concurrent drains cannot
  // both claim the same revision. A new owner fences every recovered attempt.
  return first<ClaimedJob>(env, `UPDATE jobs SET status = 'processing', attempts = attempts + 1,
      lease_owner = ?, lease_expires_at = ?
    WHERE id = (SELECT id FROM jobs WHERE attempts < ? AND
      ((status = 'pending' AND next_attempt_at <= ?) OR
       (status = 'processing' AND COALESCE(lease_expires_at, 0) <= ?))
      ORDER BY created_at, id LIMIT 1)
    RETURNING id, type, payload, org_id, attempts, lease_owner, lease_expires_at`,
    crypto.randomUUID(), now + JOB_LEASE_MS, JOB_MAX_ATTEMPTS, now, now)
}

export async function finishJob(env: Env, job: ClaimedJob, success: boolean, now = Date.now()): Promise<boolean> {
  const status = success ? 'done' : (job.attempts >= JOB_MAX_ATTEMPTS ? 'failed' : 'pending')
  const nextAttempt = success ? 0 : now + Math.min(60_000 * 2 ** (job.attempts - 1), 60 * 60_000)
  const result = await run(env, `UPDATE jobs SET status = ?, next_attempt_at = ?,
      lease_owner = NULL, lease_expires_at = NULL
    WHERE id = ? AND status = 'processing' AND lease_owner = ? AND lease_expires_at > ?`,
    status, nextAttempt, job.id, job.lease_owner, now)
  return result.meta.changes === 1
}
