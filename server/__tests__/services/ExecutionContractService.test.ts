import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../middleware/auditMiddleware', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined)
}))

import { createAuditLog } from '../../middleware/auditMiddleware'
import {
  EXECUTION_CONTRACT_VERSION,
  ExecutionContractService
} from '../../services/ExecutionContractService'

const mockCreateAuditLog = vi.mocked(createAuditLog)

function collectorExceptionInput() {
  return {
    state: 'ny',
    strategy: 'scrape',
    jobId: 'job-77',
    eventId: 'ucc-ingestion:NY:job-77:scrape:0',
    recoveryAction: 'open-circuit' as const,
    evidenceRef: 'audit://ucc/NY/job-77/collector-exception',
    occurredAt: '2026-08-31T12:00:00Z'
  }
}

describe('ExecutionContractService', () => {
  let service: ExecutionContractService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ExecutionContractService()
  })

  it('builds a fail-closed collector exception with deterministic identity', () => {
    const first = service.buildCollectorException(collectorExceptionInput())
    const redelivery = service.buildCollectorException(collectorExceptionInput())

    expect(first.schema_version).toBe(EXECUTION_CONTRACT_VERSION)
    expect(first.execution_id).toBe('ucc:NY:collector:job-77')
    expect(first.idempotency_key).toBe('ucc-ingestion:NY:job-77:scrape:0:failed')
    expect(redelivery.idempotency_key).toBe(first.idempotency_key)
    expect(first.stage).toBe('failed')
    expect(first.policy.decision).toBe('review')
    expect(first.approval).toEqual({ required: true, status: 'pending' })
    expect(first.scope.forbidden).toContain('raw credentials')
    expect(first.rollback.status).toBe('planned')
  })

  it('allows only an existing retry or fallback policy without human approval', () => {
    const receipt = service.buildCollectorException({
      ...collectorExceptionInput(),
      recoveryAction: 'fallback'
    })

    expect(receipt.policy.decision).toBe('allow')
    expect(receipt.approval).toEqual({ required: false, status: 'not_required' })
    expect(receipt.work.kind).toBe('queue_fallback')
    expect(receipt.authority.permissions).toContain('queue:enqueue-recovery')
  })

  it('stores references and a generic failure instead of raw provider text', () => {
    const receipt = service.buildCollectorException(collectorExceptionInput())
    const serialized = JSON.stringify(receipt)

    expect(receipt.failure?.message).toBe(
      'Collector execution failed; inspect the redacted evidence reference.'
    )
    expect(serialized).not.toContain('password')
    expect(serialized).not.toContain('apiKey')
    expect(serialized).not.toContain('provider payload')
  })

  it('requires a two-letter jurisdiction', () => {
    expect(() =>
      service.buildCollectorException({ ...collectorExceptionInput(), state: 'New York' })
    ).toThrow('two-letter jurisdiction')
  })

  it('persists the compact envelope through the immutable audit path', async () => {
    const receipt = await service.recordCollectorException(collectorExceptionInput())

    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      action: 'execution.failed',
      entityType: 'ucc_collector_execution',
      afterState: receipt,
      requestId: receipt.idempotency_key
    })
  })

  it('advances the same execution only after named approval and verification evidence', () => {
    const failed = service.buildCollectorException(collectorExceptionInput())
    const verified = service.buildVerifiedActivation({
      failed,
      approver: 'ucc-operations-owner',
      approvalRef: 'approval://ucc/NY/2026-08-31',
      principal: 'ucc-forward-deployed-engineer',
      occurredAt: '2026-08-31T13:00:00Z',
      commandResults: [
        {
          command: 'npm run test:scrapers:ny',
          exit_code: 0,
          result_ref: 'artifact://tests/ny-collector',
          summary: 'NY collector fixture and dry run passed.',
          redacted: true
        }
      ],
      deadEnds: ['CSS-only selector matched a navigation table.'],
      decisions: ['Use header-labelled table discovery.'],
      evidence: [
        { kind: 'test_report', ref: 'artifact://tests/ny-collector' },
        { kind: 'provenance', ref: 'artifact://provenance/ny-dry-run' }
      ],
      checks: ['NY collector suite passed', 'provenance fields complete']
    })

    expect(verified.execution_id).toBe(failed.execution_id)
    expect(verified.stage).toBe('verified')
    expect(verified.approval.status).toBe('approved')
    expect(verified.approval.approver).toBe('ucc-operations-owner')
    expect(verified.verification.status).toBe('passed')
    expect(verified.failure).toBeUndefined()
    expect(verified.workflow.command_results).toHaveLength(1)
    expect(verified.workflow.dead_ends).toHaveLength(1)
  })

  it('rejects activation without evidence or checks', () => {
    const failed = service.buildCollectorException(collectorExceptionInput())

    expect(() =>
      service.buildVerifiedActivation({
        failed,
        approver: 'ucc-operations-owner',
        approvalRef: 'approval://ucc/NY/2026-08-31',
        principal: 'ucc-forward-deployed-engineer',
        commandResults: [],
        evidence: [],
        checks: []
      })
    ).toThrow('requires evidence and checks')
  })

  it.each([
    ['approver', { approver: '   ' }],
    ['approval reference', { approvalRef: '' }],
    ['principal', { principal: '\t' }]
  ])('rejects activation without an attributable %s', (_label, override) => {
    const failed = service.buildCollectorException(collectorExceptionInput())

    expect(() =>
      service.buildVerifiedActivation({
        failed,
        approver: 'ucc-operations-owner',
        approvalRef: 'approval://ucc/NY/2026-08-31',
        principal: 'ucc-forward-deployed-engineer',
        commandResults: [],
        evidence: [{ kind: 'test_report', ref: 'artifact://tests/ny-collector' }],
        checks: ['NY collector suite passed'],
        ...override
      })
    ).toThrow('requires attributable approval authority')
  })
})
