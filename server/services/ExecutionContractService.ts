/**
 * UCC adapter for the canonical ORGANVM event-to-evidence contract.
 *
 * The canonical schema and cross-product ordering live in the Action Ledger:
 * https://github.com/organvm-iv-taxis/orchestration-start-here/pull/194
 *
 * This adapter persists a compact product-local receipt through the existing
 * immutable audit log. Raw provider payloads, credentials, and error messages
 * are deliberately excluded; the `redacted` flags are assertions, not a
 * sanitization mechanism. The audit log is append-only but does not enforce a
 * unique request ID, so redelivery can create duplicate local receipts. The
 * canonical ledger reconciles them by `(execution_id, idempotency_key)`; this
 * adapter does not claim local exactly-once persistence.
 */

import { createAuditLog } from '../middleware/auditMiddleware'

export const EXECUTION_CONTRACT_VERSION = 'organvm.execution/v1' as const

export type RecoveryAction = 'fallback' | 'retry' | 'open-circuit' | 'none'

export interface ExecutionEvidenceRef {
  kind: string
  ref: string
  digest?: string
  summary?: string
}

export interface ExecutionCommandResult {
  command: string
  exit_code: number | null
  result_ref: string
  summary: string
  redacted: true
}

export interface ExecutionEnvelopeV1 {
  schema_version: typeof EXECUTION_CONTRACT_VERSION
  execution_id: string
  idempotency_key: string
  stage: 'received' | 'approval_pending' | 'verified' | 'failed' | 'rolled_back'
  event: {
    provider: string
    event_type: string
    event_id: string
    occurred_at: string
    source: string
  }
  scope: {
    refs: string[]
    forbidden: string[]
    retrieved_at: string
    redacted: true
  }
  authority: {
    principal: string
    delegated_by: string
    permissions: string[]
    policy_ref: string
  }
  policy: {
    decision: 'allow' | 'review'
    reason: string
  }
  approval: {
    required: boolean
    status: 'not_required' | 'pending' | 'approved'
    approver?: string
    decided_at?: string
    evidence_ref?: string
  }
  work: {
    kind: string
    target: string
    mutation_ref?: string
  }
  workflow: {
    objective: string
    plan: string[]
    command_results: ExecutionCommandResult[]
    dead_ends: string[]
    decisions: string[]
    approvals: string[]
  }
  evidence: ExecutionEvidenceRef[]
  verification: {
    status: 'pending' | 'passed' | 'failed'
    checks: string[]
    reviewer?: string
    reviewed_at?: string
  }
  rollback: {
    strategy: string
    status: 'not_needed' | 'planned' | 'completed' | 'failed'
    ref?: string
  }
  failure?: {
    code: string
    message: string
    retryable: boolean
    evidence_ref: string
  }
  provider_receipt_refs: string[]
  dispute_refs: string[]
}

export interface CollectorExceptionInput {
  state: string
  strategy: string | null
  jobId: string
  eventId: string
  recoveryAction: RecoveryAction
  evidenceRef: string
  occurredAt?: string
  principal?: string
  failureCode?: string
}

export interface VerifiedActivationInput {
  failed: ExecutionEnvelopeV1
  approver: string
  approvalRef: string
  principal: string
  occurredAt?: string
  commandResults: ExecutionCommandResult[]
  evidence: ExecutionEvidenceRef[]
  checks: string[]
  deadEnds?: string[]
  decisions?: string[]
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeState(state: string): string {
  const normalized = state.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error('Collector execution state must be a two-letter jurisdiction')
  }
  return normalized
}

function auditState(envelope: ExecutionEnvelopeV1): Record<string, unknown> {
  return envelope as unknown as Record<string, unknown>
}

export class ExecutionContractService {
  buildCollectorException(input: CollectorExceptionInput): ExecutionEnvelopeV1 {
    const state = normalizeState(input.state)
    const strategy = input.strategy ?? 'unconfigured'
    const occurredAt = input.occurredAt ?? nowIso()
    const executionId = `ucc:${state}:collector:${input.jobId}`
    const autoRecovery = input.recoveryAction === 'fallback' || input.recoveryAction === 'retry'

    return {
      schema_version: EXECUTION_CONTRACT_VERSION,
      execution_id: executionId,
      idempotency_key: `${input.eventId}:failed`,
      stage: 'failed',
      event: {
        provider: 'ucc-ingestion-worker',
        event_type: 'ucc.collector.exception',
        event_id: input.eventId,
        occurred_at: occurredAt,
        source: input.evidenceRef
      },
      scope: {
        refs: [`jurisdiction://${state}`, `collector://${state}/${strategy}`, input.evidenceRef],
        forbidden: ['unrelated jurisdictions', 'raw credentials', 'unapproved activation'],
        retrieved_at: occurredAt,
        redacted: true
      },
      authority: {
        principal: input.principal ?? 'ucc-ingestion-worker',
        delegated_by: 'ucc.ingestion.queue',
        permissions: autoRecovery
          ? ['collector:read', 'telemetry:write', 'queue:enqueue-recovery']
          : ['collector:read', 'telemetry:write', 'patch:propose'],
        policy_ref: 'policy://ucc/jurisdiction-activation/v1'
      },
      policy: {
        decision: autoRecovery ? 'allow' : 'review',
        reason: autoRecovery
          ? `Existing ingestion policy permits ${input.recoveryAction} within the configured strategy chain.`
          : 'Repair may be proposed, but collector activation requires owner approval.'
      },
      approval: autoRecovery
        ? { required: false, status: 'not_required' }
        : { required: true, status: 'pending' },
      work: {
        kind: autoRecovery ? `queue_${input.recoveryAction}` : 'repair_and_activate_collector',
        target: `ucc:${state}:${strategy}`
      },
      workflow: {
        objective: `Restore trustworthy ${state} UCC collection after a ${strategy} failure.`,
        plan: [
          'Inspect the redacted exception and source provenance.',
          'Reproduce against a non-production fixture or dry run.',
          autoRecovery
            ? `Execute the policy-approved ${input.recoveryAction} path.`
            : 'Patch the collector and request activation approval with evidence.',
          'Verify data quality, provenance completeness, and duplicate-safe upsert behavior.'
        ],
        command_results: [],
        dead_ends: [],
        decisions: [`recovery_action=${input.recoveryAction}`],
        approvals: []
      },
      evidence: [
        {
          kind: 'collector_exception',
          ref: input.evidenceRef,
          summary: 'Redacted collector failure and queue telemetry receipt.'
        }
      ],
      verification: {
        status: 'pending',
        checks: [`collector test:${state}`, 'provenance completeness', 'duplicate-safe upsert']
      },
      rollback: {
        strategy: 'Keep the collector disabled and retain the last verified dataset.',
        status: 'planned'
      },
      failure: {
        code: input.failureCode ?? 'ucc.collector.exception',
        message: 'Collector execution failed; inspect the redacted evidence reference.',
        retryable: autoRecovery,
        evidence_ref: input.evidenceRef
      },
      provider_receipt_refs: [input.evidenceRef],
      dispute_refs: []
    }
  }

  buildVerifiedActivation(input: VerifiedActivationInput): ExecutionEnvelopeV1 {
    if (input.failed.event.event_type !== 'ucc.collector.exception') {
      throw new Error('Activation verification requires a UCC collector exception')
    }
    const approver = input.approver.trim()
    const approvalRef = input.approvalRef.trim()
    const principal = input.principal.trim()
    if (!approver || !approvalRef || !principal) {
      throw new Error('Activation verification requires attributable approval authority')
    }
    if (input.evidence.length === 0 || input.checks.length === 0) {
      throw new Error('Activation verification requires evidence and checks')
    }

    const occurredAt = input.occurredAt ?? nowIso()
    return {
      ...input.failed,
      idempotency_key: `${input.failed.execution_id}:verified:${approvalRef}`,
      stage: 'verified',
      event: {
        provider: 'ucc-activation',
        event_type: 'ucc.jurisdiction.activation.approved',
        event_id: approvalRef,
        occurred_at: occurredAt,
        source: approvalRef
      },
      authority: {
        principal,
        delegated_by: approver,
        permissions: ['collector:activate', 'evidence:write'],
        policy_ref: input.failed.authority.policy_ref
      },
      policy: {
        decision: 'allow',
        reason: 'Named approver accepted jurisdiction-specific test and provenance evidence.'
      },
      approval: {
        required: true,
        status: 'approved',
        approver,
        decided_at: occurredAt,
        evidence_ref: approvalRef
      },
      work: {
        ...input.failed.work,
        mutation_ref: approvalRef
      },
      workflow: {
        ...input.failed.workflow,
        command_results: [...input.failed.workflow.command_results, ...input.commandResults],
        dead_ends: [...input.failed.workflow.dead_ends, ...(input.deadEnds ?? [])],
        decisions: [...input.failed.workflow.decisions, ...(input.decisions ?? [])],
        approvals: [...input.failed.workflow.approvals, approvalRef]
      },
      evidence: input.evidence,
      verification: {
        status: 'passed',
        checks: input.checks,
        reviewer: approver,
        reviewed_at: occurredAt
      },
      rollback: {
        strategy: 'Disable the collector and restore the last verified dataset snapshot.',
        status: 'not_needed',
        ref: `rollback://${input.failed.execution_id}`
      },
      failure: undefined,
      provider_receipt_refs: [...input.failed.provider_receipt_refs, approvalRef]
    }
  }

  async recordCollectorException(input: CollectorExceptionInput): Promise<ExecutionEnvelopeV1> {
    const envelope = this.buildCollectorException(input)
    await createAuditLog({
      action: 'execution.failed',
      entityType: 'ucc_collector_execution',
      afterState: auditState(envelope),
      requestId: envelope.idempotency_key
    })
    return envelope
  }

  async recordVerifiedActivation(input: VerifiedActivationInput): Promise<ExecutionEnvelopeV1> {
    const envelope = this.buildVerifiedActivation(input)
    await createAuditLog({
      action: 'execution.verified',
      entityType: 'ucc_collector_execution',
      afterState: auditState(envelope),
      requestId: envelope.idempotency_key
    })
    return envelope
  }
}

export const executionContractService = new ExecutionContractService()
