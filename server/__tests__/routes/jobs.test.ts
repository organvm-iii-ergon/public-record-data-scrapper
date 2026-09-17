import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { AuthenticatedRequest } from '../../middleware/authMiddleware'
import { errorHandler } from '../../middleware/errorHandler'

const state = vi.hoisted(() => {
  const queue = () => ({
    add: vi.fn(),
    getJob: vi.fn(),
    getWaiting: vi.fn(),
    getActive: vi.fn(),
    getCompleted: vi.fn(),
    getFailed: vi.fn(),
    getDelayed: vi.fn(),
    getWaitingCount: vi.fn(),
    getActiveCount: vi.fn(),
    getCompletedCount: vi.fn(),
    getFailedCount: vi.fn(),
    getDelayedCount: vi.fn()
  })
  return {
    queues: [queue(), queue(), queue()],
    primary: vi.fn(),
    chain: vi.fn(),
    gate: vi.fn(),
    record: vi.fn()
  }
})
vi.mock('../../queue/queues', () => ({
  getIngestionQueue: () => state.queues[0],
  getEnrichmentQueue: () => state.queues[1],
  getHealthScoreQueue: () => state.queues[2],
  resolvePrimaryIngestionStrategy: state.primary,
  resolveStateIngestionStrategyChain: state.chain,
  getIngestionCircuitGate: state.gate,
  recordIngestionQueued: state.record
}))
vi.mock('../../middleware/dataTier', () => ({ getResolvedDataTier: () => 'free' }))
vi.mock('../../config/tieredIntegrations', () => ({ resolveUccProvider: () => 'state-direct' }))
import router from '../../routes/jobs'
const id = '11111111-1111-4111-8111-111111111111'
const job = (orgId?: string) => ({
  id: 'job-1',
  data: { orgId },
  getState: vi.fn(async () => 'waiting'),
  remove: vi.fn(async () => {}),
  progress: 0
})
function app(role = 'user', orgId: string | undefined = 'tenant-1') {
  const result = express()
  result.use(express.json())
  result.use((req: AuthenticatedRequest, _res, next) => {
    req.user = { id: 'user-1', role, orgId }
    next()
  })
  result.use('/api/jobs', router)
  result.use(errorHandler)
  return result
}
beforeEach(() => {
  vi.clearAllMocks()
  state.primary.mockReturnValue('api')
  state.chain.mockReturnValue(['api'])
  state.gate.mockReturnValue({ allowed: true })
  for (const q of state.queues) {
    q.add.mockImplementation(async (_name, data) => ({ id: 'job-1', data }))
    q.getJob.mockResolvedValue(undefined)
    for (const key of [
      'getWaiting',
      'getActive',
      'getCompleted',
      'getFailed',
      'getDelayed'
    ] as const)
      q[key].mockResolvedValue([])
    for (const key of [
      'getWaitingCount',
      'getActiveCount',
      'getCompletedCount',
      'getFailedCount',
      'getDelayedCount'
    ] as const)
      q[key].mockResolvedValue(1)
  }
})

describe('job routing and tenant isolation', () => {
  it('stamps trusted tenant context and rejects mass-assigned fields', async () => {
    const response = await request(app())
      .post('/api/jobs/ingestion')
      .send({ state: 'tx' })
      .expect(201)
    expect(response.body.data).toMatchObject({
      state: 'TX',
      orgId: 'tenant-1',
      requestedBy: 'user-1',
      manualOverride: false,
      strategy: 'api'
    })
    expect(state.record).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', queuedBy: 'manual' })
    )
    await request(app())
      .post('/api/jobs/ingestion')
      .send({ state: 'TX', orgId: 'other-tenant' })
      .expect(400)
    expect(state.queues[0].add).toHaveBeenCalledTimes(1)
  })
  it('blocks absent strategies and open circuits, permitting explicit authorized overrides', async () => {
    state.primary.mockReturnValue(undefined)
    expect(
      (await request(app()).post('/api/jobs/ingestion').send({ state: 'TX' }).expect(409)).body
        .error.code
    ).toBe('INGESTION_NOT_IMPLEMENTED')
    state.primary.mockReturnValue('api')
    state.gate.mockReturnValue({ allowed: false, reason: 'backoff', backoffUntil: 'later' })
    expect(
      (await request(app()).post('/api/jobs/ingestion').send({ state: 'TX' }).expect(409)).body
        .error.code
    ).toBe('INGESTION_CIRCUIT_OPEN')
    await request(app()).post('/api/jobs/ingestion').send({ state: 'TX', force: true }).expect(201)
    expect(state.queues[0].add).toHaveBeenCalledTimes(1)
  })
  it('queues enrichment and health writes with tenant attribution and validates inputs', async () => {
    for (const [path, body] of [
      ['enrichment', { prospectIds: [id] }],
      ['health-scores', { portfolioCompanyId: id }]
    ] as const) {
      expect(
        (await request(app()).post(`/api/jobs/${path}`).send(body).expect(201)).body.data.orgId
      ).toBe('tenant-1')
      await request(app('viewer')).post(`/api/jobs/${path}`).send(body).expect(403)
    }
    await request(app()).post('/api/jobs/enrichment').send({ prospectIds: [] }).expect(400)
  })
  it.each(['get', 'delete'] as const)(
    'hides missing, unowned and foreign jobs from %s',
    async (method) => {
      await request(app())[method]('/api/jobs/job-1').expect(404)
      for (const owner of [undefined, 'other-tenant']) {
        const foreign = job(owner)
        state.queues[1].getJob.mockResolvedValue(foreign)
        await request(app())[method]('/api/jobs/job-1').expect(404)
        expect(foreign.remove).not.toHaveBeenCalled()
      }
      const owned = job('tenant-1')
      state.queues[1].getJob.mockResolvedValue(owned)
      const response = await request(app())[method]('/api/jobs/job-1').expect(200)
      expect(response.body.queueName).toBe('data-enrichment')
      if (method === 'delete') expect(owned.remove).toHaveBeenCalledTimes(1)
      else expect(response.body.uccProvider).toBeNull()
    }
  )
  it.each(['waiting', 'active', 'completed', 'failed', 'delayed'])(
    'filters %s lists by tenant before serializing',
    async (status) => {
      const rows = [job('tenant-1'), job('other-tenant'), job()]
      for (const key of [
        'getWaiting',
        'getActive',
        'getCompleted',
        'getFailed',
        'getDelayed'
      ] as const)
        state.queues[0][key].mockResolvedValue(rows)
      const response = await request(app())
        .get(`/api/jobs/queues/ucc-ingestion?status=${status}&limit=3`)
        .expect(200)
      expect(response.body.count).toBe(1)
      expect(response.body.jobs[0].data.orgId).toBe('tenant-1')
    }
  )
  it('rejects invalid queue filters and protects operational statistics', async () => {
    await request(app()).get('/api/jobs/queues/unknown').expect(400)
    await request(app()).get('/api/jobs/queues/ucc-ingestion?limit=201').expect(400)
    await request(app()).get('/api/jobs/queues/stats').expect(403)
    const result = await request(app('admin')).get('/api/jobs/queues/stats').expect(200)
    expect(result.body.queues).toHaveLength(3)
    expect(result.body.queues.every((q: { total: number }) => q.total === 5)).toBe(true)
  })
})
