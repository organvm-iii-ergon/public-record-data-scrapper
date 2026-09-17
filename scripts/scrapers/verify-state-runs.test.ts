import { describe, it, expect } from 'vitest'
import {
  computePayloadDigest,
  evaluateRun,
  evaluateStreak,
  type LiveReceipt
} from '../verify-state-runs'

function makeValidReceipt(overrides: Partial<LiveReceipt> = {}): LiveReceipt {
  return {
    receiptId: 'rcpt_test_001',
    state: 'IL',
    accessMethod: 'scrape',
    timestamp: '2026-09-15T12:00:00.000Z',
    targetQuery: 'Acme Testing Corp',
    status: 'SUCCESS',
    recordsIngested: 2,
    recordsValidated: 2,
    validationErrors: [],
    durationMs: 1200,
    payloadSha256: computePayloadDigest([{ filingNumber: 'IL-001' }]),
    isMockData: false,
    ...overrides
  }
}

describe('verify-state-runs (Green Run & Consecutive Streak Protocol)', () => {
  describe('evaluateRun (7-Point Green Run Contract)', () => {
    it('accepts a valid live receipt as GREEN', () => {
      const receipt = makeValidReceipt()
      const evaluation = evaluateRun(receipt)

      expect(evaluation.isGreen).toBe(true)
      expect(evaluation.failureReasons).toHaveLength(0)
    })

    it('disqualifies any run using mock or canned data', () => {
      const receipt = makeValidReceipt({ isMockData: true })
      const evaluation = evaluateRun(receipt)

      expect(evaluation.isGreen).toBe(false)
      expect(evaluation.failureReasons.some((r) => r.includes('mock or canned data'))).toBe(true)
    })

    it('flags schema validation mismatch when validated count != ingested count', () => {
      const receipt = makeValidReceipt({
        recordsIngested: 3,
        recordsValidated: 2,
        validationErrors: ['Filing 3: missing debtor']
      })
      const evaluation = evaluateRun(receipt)

      expect(evaluation.isGreen).toBe(false)
      expect(evaluation.failureReasons.some((r) => r.includes('Schema mismatch'))).toBe(true)
      expect(evaluation.failureReasons.some((r) => r.includes('Validation errors'))).toBe(true)
    })

    it('flags latency SLA violations', () => {
      const receipt = makeValidReceipt({ durationMs: 45_000 })
      const evaluation = evaluateRun(receipt, 30_000)

      expect(evaluation.isGreen).toBe(false)
      expect(evaluation.failureReasons.some((r) => r.includes('Latency SLA exceeded'))).toBe(true)
    })

    it('flags anti-bot or rate-limit blocks', () => {
      const receipt = makeValidReceipt({
        status: 'FAILURE',
        errorMessage: 'Blocked by Cloudflare CAPTCHA gate'
      })
      const evaluation = evaluateRun(receipt)

      expect(evaluation.isGreen).toBe(false)
      expect(
        evaluation.failureReasons.some((r) => r.includes('Anti-bot or rate-limit challenge'))
      ).toBe(true)
    })

    it('flags invalid payload SHA-256 digests', () => {
      const receipt = makeValidReceipt({ payloadSha256: 'invalid-hash' })
      const evaluation = evaluateRun(receipt)

      expect(evaluation.isGreen).toBe(false)
      expect(evaluation.failureReasons.some((r) => r.includes('SHA-256'))).toBe(true)
    })
  })

  describe('evaluateStreak (7-Consecutive-Run State Machine)', () => {
    it('certifies state once 7 consecutive green runs are achieved', () => {
      const receipts: LiveReceipt[] = Array.from({ length: 7 }, (_, i) =>
        makeValidReceipt({
          receiptId: `rcpt_${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString()
        })
      )

      const status = evaluateStreak(receipts, 7)
      expect(status.currentStreak).toBe(7)
      expect(status.isCertified).toBe(true)
      expect(status.totalEvaluated).toBe(7)
    })

    it('STRICT RESET: resets streak to 0 on any failed run', () => {
      // 6 Green runs followed by 1 Red run
      const receipts: LiveReceipt[] = Array.from({ length: 6 }, (_, i) =>
        makeValidReceipt({
          receiptId: `rcpt_${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString()
        })
      )

      // 7th run is a failure
      receipts.push(
        makeValidReceipt({
          receiptId: 'rcpt_failed',
          timestamp: new Date(Date.now() + 7000).toISOString(),
          status: 'FAILURE',
          errorMessage: 'HTTP 429 Rate Limit Exceeded'
        })
      )

      const status = evaluateStreak(receipts, 7)
      expect(status.currentStreak).toBe(0)
      expect(status.isCertified).toBe(false)
      expect(status.totalEvaluated).toBe(7)
    })

    it('resumes incrementing streak after recovering from a failure', () => {
      const receipts: LiveReceipt[] = [
        makeValidReceipt({ timestamp: '2026-09-15T10:00:00Z' }),
        makeValidReceipt({ timestamp: '2026-09-15T10:01:00Z', isMockData: true }), // FAIL -> streak resets to 0
        makeValidReceipt({ timestamp: '2026-09-15T10:02:00Z' }), // PASS -> streak 1
        makeValidReceipt({ timestamp: '2026-09-15T10:03:00Z' }) // PASS -> streak 2
      ]

      const status = evaluateStreak(receipts, 7)
      expect(status.currentStreak).toBe(2)
      expect(status.isCertified).toBe(false)
    })
  })
})
