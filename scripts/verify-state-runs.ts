#!/usr/bin/env tsx
/**
 * Automated State Run Verifier
 *
 * Implements the automated verification protocol for Epic S6 / S7:
 * "Rule: Wave N+1 cannot start until Wave N has 7 consecutive green runs."
 *
 * Evaluates execution receipts against the 7-point Green Run criteria:
 * 1. Process exit & status: SUCCESS (no unhandled exceptions)
 * 2. Zero mock contamination: isMockData === false
 * 3. 100% Schema conformance: recordsValidated === recordsIngested, zero validation errors
 * 4. Data sufficiency: records ingested >= 0 and non-corrupt
 * 5. SLA latency adherence: duration <= maxLatencyMs (default: 30,000ms)
 * 6. Zero blocks / rate limits: no CAPTCHA or 429 errors
 * 7. Cryptographic receipt integrity: valid sha256 checksum of payload
 */

import { createHash, randomUUID } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { stateCollectorFactory } from '../apps/web/src/lib/collectors/StateCollectorFactory'

export interface LiveReceipt {
  receiptId: string
  state: string
  accessMethod: 'api' | 'bulk' | 'vendor' | 'scrape'
  timestamp: string
  targetQuery: string
  status: 'SUCCESS' | 'FAILURE'
  recordsIngested: number
  recordsValidated: number
  validationErrors: string[]
  durationMs: number
  /** Exact payload whose digest is recorded below. */
  payload: unknown
  payloadSha256: string
  isMockData: boolean
  errorMessage?: string
}

export interface GreenRunEvaluation {
  isGreen: boolean
  failureReasons: string[]
  receipt: LiveReceipt
}

export interface VerificationStreakStatus {
  state: string
  currentStreak: number
  targetStreak: number
  isCertified: boolean
  totalEvaluated: number
  history: GreenRunEvaluation[]
  lastEvaluatedAt: string
}

export const DEFAULT_MAX_LATENCY_MS = 30_000
export const REQUIRED_CONSECUTIVE_GREEN_RUNS = 7

/**
 * Compute SHA-256 digest of payload for verifiable receipt integrity.
 */
export function computePayloadDigest(data: unknown): string {
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  return createHash('sha256').update(json).digest('hex')
}

/**
 * Evaluate a single LiveReceipt against the 7 Green Run criteria.
 */
export function evaluateRun(
  receipt: LiveReceipt,
  maxLatencyMs = DEFAULT_MAX_LATENCY_MS
): GreenRunEvaluation {
  const failureReasons: string[] = []

  // 1. Process Status
  if (receipt.status !== 'SUCCESS') {
    failureReasons.push(
      `Run status is ${receipt.status}: ${receipt.errorMessage ?? 'Unknown error'}`
    )
  }

  // 2. Zero Mock Contamination
  if (receipt.isMockData) {
    failureReasons.push('Disqualified: Run used mock or canned data (isMockData = true)')
  }

  // 3. Schema Conformance
  if (receipt.recordsValidated !== receipt.recordsIngested) {
    failureReasons.push(
      `Schema mismatch: recordsValidated (${receipt.recordsValidated}) != recordsIngested (${receipt.recordsIngested})`
    )
  }
  if (receipt.validationErrors && receipt.validationErrors.length > 0) {
    failureReasons.push(`Validation errors encountered: ${receipt.validationErrors.join('; ')}`)
  }

  if (!Number.isInteger(receipt.recordsIngested) || receipt.recordsIngested < 0) {
    failureReasons.push(`Invalid recordsIngested metric: ${receipt.recordsIngested}`)
  }
  if (!Number.isInteger(receipt.recordsValidated) || receipt.recordsValidated < 0) {
    failureReasons.push(`Invalid recordsValidated metric: ${receipt.recordsValidated}`)
  }

  // 4. SLA Latency Adherence
  if (!Number.isFinite(receipt.durationMs) || receipt.durationMs < 0) {
    failureReasons.push(`Invalid durationMs metric: ${receipt.durationMs}`)
  } else if (receipt.durationMs > maxLatencyMs) {
    failureReasons.push(
      `Latency SLA exceeded: ${receipt.durationMs}ms > max allowed ${maxLatencyMs}ms`
    )
  }

  // 5. Zero Blocks / Rate Limits
  if (receipt.errorMessage) {
    const errorUpper = receipt.errorMessage.toUpperCase()
    if (
      errorUpper.includes('CAPTCHA') ||
      errorUpper.includes('RATE_LIMIT') ||
      errorUpper.includes('429') ||
      errorUpper.includes('FORBIDDEN') ||
      errorUpper.includes('BOT')
    ) {
      failureReasons.push(`Anti-bot or rate-limit challenge triggered: ${receipt.errorMessage}`)
    }
  }

  // 6. Cryptographic Integrity
  if (!receipt.payloadSha256 || !/^[a-f0-9]{64}$/i.test(receipt.payloadSha256)) {
    failureReasons.push('Invalid or missing payload SHA-256 digest')
  } else if (computePayloadDigest(receipt.payload) !== receipt.payloadSha256.toLowerCase()) {
    failureReasons.push('Payload SHA-256 digest does not match the captured payload')
  }

  return {
    isGreen: failureReasons.length === 0,
    failureReasons,
    receipt
  }
}

/**
 * Evaluate a sequence of receipts in chronological order to calculate the consecutive green streak.
 * Any failure immediately resets the current streak to 0.
 */
export function evaluateStreak(
  receipts: LiveReceipt[],
  targetStreak = REQUIRED_CONSECUTIVE_GREEN_RUNS,
  maxLatencyMs = DEFAULT_MAX_LATENCY_MS
): VerificationStreakStatus {
  const state = receipts[0]?.state ?? 'UNKNOWN'
  let streak = 0
  const history: GreenRunEvaluation[] = []

  // Sort receipts chronologically
  // Overlapping discovery paths can yield the same receipt more than once.
  // Count each stable receipt identity once so duplicates cannot manufacture a streak.
  const uniqueReceipts = [
    ...new Map(receipts.map((receipt) => [receipt.receiptId, receipt])).values()
  ]
  const sorted = uniqueReceipts.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  for (const receipt of sorted) {
    const evaluation = evaluateRun(receipt, maxLatencyMs)
    history.push(evaluation)

    if (evaluation.isGreen) {
      streak++
    } else {
      streak = 0 // Strict reset on any failure!
    }
  }

  return {
    state,
    currentStreak: streak,
    targetStreak,
    isCertified: streak >= targetStreak,
    totalEvaluated: sorted.length,
    history,
    lastEvaluatedAt: new Date().toISOString()
  }
}

/**
 * Save verification status to .quality/state-verification/[STATE]-verification.json
 */
export function saveStreakStatus(
  status: VerificationStreakStatus,
  baseDir = process.cwd()
): string {
  const targetDir = join(baseDir, '.quality', 'state-verification')
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true })
  }

  const filePath = join(targetDir, `${status.state.toUpperCase()}-verification.json`)
  writeFileSync(filePath, JSON.stringify(status, null, 2), 'utf-8')
  return filePath
}

/**
 * Load streak status from .quality/state-verification/[STATE]-verification.json if present.
 */
export function loadStreakStatus(
  state: string,
  baseDir = process.cwd()
): VerificationStreakStatus | null {
  const filePath = join(
    baseDir,
    '.quality',
    'state-verification',
    `${state.toUpperCase()}-verification.json`
  )
  if (!existsSync(filePath)) return null

  try {
    const data = readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as VerificationStreakStatus
  } catch {
    return null
  }
}

export function loadRunReceipts(state: string, baseDir = process.cwd()): LiveReceipt[] {
  const directory = join(baseDir, '.quality', 'state-runs', state.toUpperCase())
  if (!existsSync(directory)) return []

  const receipts: LiveReceipt[] = []
  for (const name of readdirSync(directory)
    .filter((entry) => entry.endsWith('.json'))
    .sort()) {
    try {
      const value = JSON.parse(readFileSync(join(directory, name), 'utf8')) as LiveReceipt
      if (value.state?.toUpperCase() === state.toUpperCase() && value.receiptId) {
        receipts.push(value)
      }
    } catch {
      // A malformed receipt is ignored here; it cannot contribute to a green streak.
    }
  }
  return receipts
}

export function saveRunReceipt(receipt: LiveReceipt, baseDir = process.cwd()): string {
  const directory = join(baseDir, '.quality', 'state-runs', receipt.state.toUpperCase())
  mkdirSync(directory, { recursive: true })
  const filePath = join(directory, `${receipt.receiptId}.json`)
  writeFileSync(filePath, JSON.stringify(receipt, null, 2), 'utf8')
  return filePath
}

async function probeState(state: string, count: number): Promise<LiveReceipt[]> {
  const collector = stateCollectorFactory.getCollector(state)
  const config = stateCollectorFactory.getStateConfig(state)
  if (!collector || !config) {
    throw new Error(`No production-ready collector is configured for ${state}`)
  }

  const receipts: LiveReceipt[] = []
  for (let index = 0; index < count; index++) {
    const started = Date.now()
    const timestamp = new Date().toISOString()
    let payload: unknown = []
    let status: LiveReceipt['status'] = 'SUCCESS'
    let errorMessage: string | undefined
    let validationErrors: string[] = []

    try {
      const filings = await collector.collectNewFilings({
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        limit: 100
      })
      payload = filings
      validationErrors = filings.flatMap((filing, filingIndex) =>
        collector
          .validateFiling(filing)
          .errors.map((error) => `record ${filingIndex + 1}: ${error}`)
      )
      if (validationErrors.length > 0) status = 'FAILURE'
    } catch (error) {
      status = 'FAILURE'
      errorMessage = error instanceof Error ? error.message : String(error)
    }

    const recordsIngested = Array.isArray(payload) ? payload.length : 0
    const receipt: LiveReceipt = {
      receiptId: `rcpt_${state.toLowerCase()}_${Date.now()}_${randomUUID().slice(0, 8)}`,
      state,
      accessMethod: config.activeMethod ?? config.accessMethods[0] ?? 'scrape',
      timestamp,
      targetQuery: 'new filings from the previous 24 hours',
      status,
      recordsIngested,
      recordsValidated: Math.max(0, recordsIngested - validationErrors.length),
      validationErrors,
      durationMs: Date.now() - started,
      payload,
      payloadSha256: computePayloadDigest(payload),
      isMockData: false,
      ...(errorMessage ? { errorMessage } : {})
    }
    saveRunReceipt(receipt)
    receipts.push(receipt)
  }
  return receipts
}

// --- CLI Execution Handler ---
async function main() {
  const args = process.argv.slice(2)
  const isStatus = args.includes('--status')
  const isEvaluate = args.includes('--evaluate')
  const isProbe = args.includes('--probe')
  const stateArgIndex = args.indexOf('--state')
  const state = stateArgIndex !== -1 ? args[stateArgIndex + 1]?.toUpperCase() : undefined

  if (isStatus) {
    const directory = join(process.cwd(), '.quality', 'state-verification')
    const files = existsSync(directory)
      ? readdirSync(directory)
          .filter((name) => name.endsWith('-verification.json'))
          .sort()
      : []
    if (files.length === 0) {
      console.log('[Verifier] No saved certification statuses found.')
      return
    }
    for (const file of files) {
      const saved = JSON.parse(
        readFileSync(join(directory, file), 'utf8')
      ) as VerificationStreakStatus
      console.log(
        `${saved.state}: ${saved.currentStreak}/${saved.targetStreak} ${saved.isCertified ? 'CERTIFIED' : 'NOT CERTIFIED'}`
      )
    }
    return
  }

  if (!state) {
    console.log('Automated State Run Verifier (Epic S6 / S7 Playbook)')
    console.log(
      'Usage: npx tsx scripts/verify-state-runs.ts --state <STATE_CODE> (--evaluate | --probe [--count N]) | --status'
    )
    process.exitCode = 1
    return
  }

  console.log(`[Verifier] Assessing state ${state} verification status...`)

  if (isProbe) {
    const countArgIndex = args.indexOf('--count')
    const requestedCount =
      countArgIndex === -1 ? 1 : Number.parseInt(args[countArgIndex + 1] ?? '', 10)
    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 25) {
      throw new Error('--count must be an integer between 1 and 25')
    }
    const probed = await probeState(state, requestedCount)
    console.log(`[Verifier] Recorded ${probed.length} live probe receipt(s).`)
  }

  if (isEvaluate || isProbe) {
    const receipts = loadRunReceipts(state)
    if (receipts.length === 0) {
      throw new Error(`No run receipts found for ${state}`)
    }
    const evaluated = evaluateStreak(receipts)
    const savedAt = saveStreakStatus(evaluated)
    console.log(`[Verifier] Evaluated ${evaluated.totalEvaluated} unique receipt(s).`)
    console.log(`[Verifier] Saved ${savedAt}`)
  }

  const current = loadStreakStatus(state)

  if (current) {
    console.log(`[Verifier] Current Streak: ${current.currentStreak}/${current.targetStreak}`)
    console.log(`[Verifier] Production Certified: ${current.isCertified ? 'YES ✅' : 'NO ❌'}`)
    console.log(`[Verifier] Total Runs Evaluated: ${current.totalEvaluated}`)
  } else {
    console.log(
      `[Verifier] No prior run verification found for ${state}. Streak is 0/${REQUIRED_CONSECUTIVE_GREEN_RUNS}.`
    )
  }
}

if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[Verifier] Error:', err)
    process.exit(1)
  })
}
