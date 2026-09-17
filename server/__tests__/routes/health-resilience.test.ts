import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
const source = vi.hoisted(() => ({
  telemetry: vi.fn(),
  strategies: vi.fn(),
  tier: vi.fn(),
  provider: vi.fn()
}))
vi.mock('../../queue/queues', () => ({
  getIngestionCoverageTelemetry: source.telemetry,
  resolveStateIngestionStrategyChain: source.strategies
}))
vi.mock('../../middleware/dataTier', () => ({ getResolvedDataTier: source.tier }))
vi.mock('../../config/tieredIntegrations', () => ({
  listEnabledIntegrations: () => ['ucc-provider', 'other'],
  resolveUccProvider: source.provider
}))
vi.mock('../../database/connection', () => ({ database: { query: vi.fn() } }))
import router from '../../routes/health'
import { database } from '../../database/connection'
const app = express()
app.use('/api/health', router)
const prior = '2026-09-16T10:00:00Z'
const snapshot = (extra: Record<string, unknown> = {}) => ({
  state: 'CA',
  successes: [],
  successCount: 0,
  failureCount: 0,
  consecutiveFailures: 0,
  currentStatus: 'idle',
  circuitState: 'closed',
  ...extra
})
beforeEach(() => {
  vi.clearAllMocks()
  source.telemetry.mockReturnValue([])
  source.strategies.mockReturnValue([])
  source.tier.mockReturnValue('free-tier')
  source.provider.mockReturnValue('unconfigured')
  for (const name of [
    'CA_SOS_API_KEY',
    'TX_SOSDIRECT_API_KEY',
    'TX_SOSDIRECT_ACCOUNT_ID',
    'FL_VENDOR_API_KEY',
    'FL_VENDOR_API_SECRET',
    'FL_VENDOR_CONTRACT_ACTIVE',
    'NJ_UCC_API_KEY',
    'NJ_UCC_ACCOUNT_ID',
    'NJ_UCC_DEBTOR_SEEDS'
  ])
    vi.stubEnv(name, undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('ingestion readiness and runtime failures', () => {
  it('requires all state-specific prerequisites without replacing absent measurements', async () => {
    for (const name of [
      'CA_SOS_API_KEY',
      'TX_SOSDIRECT_API_KEY',
      'TX_SOSDIRECT_ACCOUNT_ID',
      'FL_VENDOR_API_KEY',
      'FL_VENDOR_API_SECRET',
      'NJ_UCC_API_KEY',
      'NJ_UCC_ACCOUNT_ID'
    ])
      vi.stubEnv(name, 'test-only')
    vi.stubEnv('FL_VENDOR_CONTRACT_ACTIVE', 'true')
    vi.stubEnv('NJ_UCC_DEBTOR_SEEDS', ' , test seed')
    source.strategies.mockReturnValue(['api'])
    source.tier.mockReturnValue('starter-tier')
    source.provider.mockReturnValue('vendor')
    const response = await request(app).get('/api/health/coverage').expect(200)
    for (const code of ['CA', 'TX', 'FL', 'NJ']) {
      const state = response.body.states.find(
        (row: { stateCode: string }) => row.stateCode === code
      )
      expect(state.status).toBe('green')
      expect(state.telemetry.records24h).toBeNull()
      expect(state.telemetry.errorRate).toBeNull()
    }
    expect(
      response.body.states
        .find((row: { stateCode: string }) => row.stateCode === 'AL')
        .notes.join(' ')
    ).toContain('scheduler references')
    expect(response.body.insuranceProvider).toBe('vendor')
    expect(response.body.enabledIntegrations).toEqual(['ucc-provider'])
  })
  it.each([
    [{ circuitState: 'open' }, 'red', 'Circuit breaker open'],
    [
      {
        circuitState: 'open',
        lastSuccessfulPull: prior,
        circuitBackoffUntil: prior,
        escalationCount: 1
      },
      'yellow',
      'Circuit breaker open'
    ],
    [{ circuitState: 'open', lastEscalationReason: 'paused' }, 'red', 'paused'],
    [
      { circuitState: 'half-open', currentStatus: 'running', currentStrategy: 'api' },
      'yellow',
      'Half-open recovery probe'
    ],
    [{ circuitState: 'half-open', currentStrategy: 'api' }, 'yellow', 'Recovery probe active'],
    [{ currentStatus: 'running' }, 'yellow', 'Ingestion running'],
    [
      { currentStatus: 'queued', queuedBy: 'self-heal', currentStrategy: 'api' },
      'yellow',
      'Self-healing queued on api'
    ],
    [
      { currentStatus: 'queued', queuedBy: 'self-heal' },
      'yellow',
      'Self-healing queued on fallback'
    ],
    [
      { currentStatus: 'queued', queuedBy: 'self-heal', lastEscalationReason: 'retry now' },
      'yellow',
      'retry now'
    ],
    [{ currentStatus: 'queued' }, 'yellow', 'unknown source'],
    [{ currentStatus: 'queued', queuedBy: 'manual' }, 'yellow', 'manual'],
    [{ currentStatus: 'failed', lastError: 'provider denied' }, 'red', 'provider denied'],
    [
      { currentStatus: 'failed', lastSuccessfulPull: prior, consecutiveFailures: 1 },
      'yellow',
      'Operational'
    ],
    [
      { currentStatus: 'failed', lastSuccessfulPull: prior, consecutiveFailures: 2 },
      'red',
      'Operational'
    ],
    [{ currentStatus: 'success', lastSuccessfulPull: prior }, 'green', 'recent successful pull']
  ] as const)('reports runtime status for %j', async (extra, status, reason) => {
    vi.stubEnv('CA_SOS_API_KEY', 'test-only')
    source.telemetry.mockReturnValue([snapshot(extra)])
    const response = await request(app).get('/api/health/coverage').expect(200)
    const state = response.body.states.find((row: { stateCode: string }) => row.stateCode === 'CA')
    expect(state.status).toBe(status)
    expect(state.statusReason).toContain(reason)
  })
  it('keeps unconfigured collectors red even when a job is queued', async () => {
    source.telemetry.mockReturnValue([snapshot({ currentStatus: 'queued' })])
    const response = await request(app).get('/api/health/coverage').expect(200)
    expect(
      response.body.states.find((row: { stateCode: string }) => row.stateCode === 'CA').status
    ).toBe('red')
  })
  it('hides detailed infrastructure in production and reports memory pressure in development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.mocked(database.query).mockResolvedValueOnce([])
    const healthy = await request(app).get('/api/health/detailed').expect(200)
    expect(healthy.body.services).toBeUndefined()
    vi.mocked(database.query).mockRejectedValueOnce(new Error('private database address'))
    const failed = await request(app).get('/api/health/detailed').expect(200)
    expect(JSON.stringify(failed.body)).not.toContain('private database address')
    vi.stubEnv('NODE_ENV', 'development')
    vi.mocked(database.query).mockResolvedValueOnce([])
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 100 * 1024 * 1024,
      heapUsed: 95 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0
    })
    const warning = await request(app).get('/api/health/detailed').expect(200)
    expect(warning.body.services.memory).toBe('warning')
  })
})
