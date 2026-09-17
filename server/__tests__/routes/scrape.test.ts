import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import scrapeRouter from '../../routes/scrape'

const mockSearch = vi.fn()
const mockGetStateReadiness = vi.fn()
const mockEnqueue = vi.fn()

vi.mock('../../services/UCCSearchService', () => ({
  UCCSearchService: vi.fn(function () {
    return {
      search: mockSearch,
      getStateReadiness: mockGetStateReadiness
    }
  })
}))

vi.mock('../../services/ScrapeJobService', () => ({
  ScrapeJobService: vi.fn(function () {
    return {
      enqueue: mockEnqueue,
      markProcessing: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      get: vi.fn()
    }
  })
}))

describe('POST /api/scrape/ucc', () => {
  let app: Express

  const buildTestApp = (tier = 'professional') => {
    const testApp = express()
    testApp.use(express.json())

    testApp.use((req, _res, next) => {
      ;(req as { user: { id: string; orgId: string; role: string; tier: string } }).user = {
        id: 'test-user',
        orgId: 'test-org',
        role: 'user',
        tier
      }
      next()
    })

    testApp.use('/api/scrape', scrapeRouter)
    return testApp
  }

  beforeEach(() => {
    mockSearch.mockReset()
    mockGetStateReadiness.mockReset()
    mockEnqueue.mockReset()
    mockGetStateReadiness.mockReturnValue({
      state: 'CA',
      canSearch: true,
      reason: 'Collector ready for state: CA'
    })
    app = buildTestApp()
  })

  it('returns 400 for missing required body fields', async () => {
    const response = await request(app).post('/api/scrape/ucc').send({ state: 'CA' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns an explicit unavailable-state error before searching', async () => {
    mockGetStateReadiness.mockReturnValue({
      state: 'XX',
      canSearch: false,
      reason: 'No UCC data available for state: XX'
    })

    const response = await request(app).post('/api/scrape/ucc').send({
      company_name: 'Test Corp',
      state: 'XX'
    })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('UCC_STATE_UNAVAILABLE')
    expect(response.body.error.details).toMatchObject({ state: 'XX' })
    expect(response.body.error.details.readinessEndpoint).toBe('/api/scrape/readiness/XX')
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('returns a 402 upsell for free-tier synchronous searches', async () => {
    app = buildTestApp('free')

    const response = await request(app).post('/api/scrape/ucc').send({
      company_name: 'Test Corp',
      state: 'CA'
    })

    expect(response.status).toBe(402)
    expect(response.body.error.code).toBe('TIER_UPGRADE_REQUIRED')
    expect(response.body.error.details.reason).toBe('on_demand_scrape_requires_paid')
    expect(mockGetStateReadiness).not.toHaveBeenCalled()
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('returns success for supported state requests', async () => {
    mockSearch.mockResolvedValue({
      filings: [],
      total: 0,
      state: 'CA',
      companyName: 'Test Corp',
      timestamp: '2026-06-24T00:00:00.000Z'
    })

    const response = await request(app).post('/api/scrape/ucc').send({
      company_name: 'Test Corp',
      state: 'ca',
      limit: 50
    })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.state).toBe('CA')
    expect(mockSearch).toHaveBeenCalledWith({
      companyName: 'Test Corp',
      state: 'CA',
      limit: 50
    })
  })

  it('enforces state normalization before calling service methods', async () => {
    mockSearch.mockResolvedValue({
      filings: [],
      total: 0,
      state: 'CA',
      companyName: 'Test Corp',
      timestamp: '2026-06-24T00:00:00.000Z'
    })

    await request(app).post('/api/scrape/ucc').send({
      company_name: 'Test Corp',
      state: 'ca'
    })

    expect(mockGetStateReadiness).toHaveBeenCalledWith('CA')
    expect(mockSearch).toHaveBeenCalledWith({
      companyName: 'Test Corp',
      state: 'CA',
      limit: 100
    })
  })

  it('returns 401 when auth is missing', async () => {
    const noAuthApp = express()
    noAuthApp.use(express.json())
    noAuthApp.use('/api/scrape', scrapeRouter)

    const response = await request(noAuthApp).post('/api/scrape/ucc').send({
      company_name: 'Test Corp',
      state: 'CA'
    })

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Unauthorized')
    expect(mockGetStateReadiness).not.toHaveBeenCalled()
    expect(mockSearch).not.toHaveBeenCalled()
  })
})

describe('POST /api/scrape/jobs', () => {
  let app: Express

  const buildTestApp = (tier = 'professional') => {
    const testApp = express()
    testApp.use(express.json())

    testApp.use((req, _res, next) => {
      ;(req as { user: { id: string; orgId: string; role: string; tier: string } }).user = {
        id: 'test-user',
        orgId: 'test-org',
        role: 'user',
        tier
      }
      next()
    })

    testApp.use('/api/scrape', scrapeRouter)
    return testApp
  }

  beforeEach(() => {
    mockSearch.mockReset()
    mockGetStateReadiness.mockReset()
    mockEnqueue.mockReset()
    mockGetStateReadiness.mockReturnValue({
      state: 'CA',
      canSearch: true,
      reason: 'Collector ready for state: CA'
    })
    mockEnqueue.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'queued',
      queuedAt: '2026-06-24T00:00:00.000Z',
      orgId: 'test-org',
      apiKeyId: null,
      companyName: 'Test Corp',
      state: 'CA',
      limit: 100
    })
    app = buildTestApp()
  })

  it('returns a 402 upsell for free-tier queued searches', async () => {
    app = buildTestApp('free')

    const response = await request(app).post('/api/scrape/jobs').send({
      company_name: 'Test Corp',
      state: 'CA'
    })

    expect(response.status).toBe(402)
    expect(response.body.error.code).toBe('TIER_UPGRADE_REQUIRED')
    expect(response.body.error.details.reason).toBe('on_demand_scrape_requires_paid')
    expect(mockGetStateReadiness).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('enqueues paid-tier searches', async () => {
    const response = await request(app).post('/api/scrape/jobs').send({
      company_name: 'Test Corp',
      state: 'ca'
    })

    expect(response.status).toBe(202)
    expect(response.body.data).toMatchObject({
      jobId: '11111111-1111-4111-8111-111111111111',
      status: 'queued',
      pollUrl: '/api/scrape/jobs/11111111-1111-4111-8111-111111111111'
    })
    expect(mockEnqueue).toHaveBeenCalledWith({
      orgId: 'test-org',
      apiKeyId: null,
      companyName: 'Test Corp',
      state: 'CA',
      limit: 100
    })
  })
})

describe('GET /api/scrape/readiness/:stateCode', () => {
  let app: Express

  const buildTestApp = () => {
    const testApp = express()
    testApp.use(express.json())

    testApp.use((req, _res, next) => {
      ;(req as { user: { orgId: string; role: string } }).user = {
        orgId: 'test-org',
        role: 'user'
      }
      next()
    })

    testApp.use('/api/scrape', scrapeRouter)
    return testApp
  }

  beforeEach(() => {
    mockGetStateReadiness.mockReset()
    mockGetStateReadiness.mockReturnValue({
      state: 'CA',
      canSearch: true,
      reason: 'Collector ready for state: CA'
    })
    app = buildTestApp()
  })

  it('returns availability for a supported state', async () => {
    const response = await request(app).get('/api/scrape/readiness/ca')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toMatchObject({
      state: 'CA',
      canSearch: true,
      reason: 'Collector ready for state: CA'
    })
    expect(mockGetStateReadiness).toHaveBeenCalledWith('CA')
  })

  it('returns blocked status for unavailable states', async () => {
    mockGetStateReadiness.mockReturnValue({
      state: 'XX',
      canSearch: false,
      reason: 'No UCC data available for state: XX'
    })

    const response = await request(app).get('/api/scrape/readiness/xx')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toMatchObject({
      state: 'XX',
      canSearch: false,
      reason: 'No UCC data available for state: XX'
    })
    expect(mockGetStateReadiness).toHaveBeenCalledWith('XX')
  })

  it('returns 400 for invalid state payload', async () => {
    const response = await request(app).get('/api/scrape/readiness/ABC')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when auth is missing', async () => {
    const noAuthApp = express()
    noAuthApp.use(express.json())
    noAuthApp.use('/api/scrape', scrapeRouter)

    const response = await request(noAuthApp).get('/api/scrape/readiness/ca')

    expect(response.status).toBe(401)
    expect(response.body.error).toBe('Unauthorized')
    expect(mockGetStateReadiness).not.toHaveBeenCalled()
  })
})

describe('POST /api/scrape/parse-document', () => {
  let app: Express

  const buildTestApp = (tier = 'professional') => {
    const testApp = express()
    testApp.use(express.json())

    testApp.use((req, _res, next) => {
      ;(req as { user: { id: string; orgId: string; role: string; tier: string } }).user = {
        id: 'test-user',
        orgId: 'test-org',
        role: 'user',
        tier
      }
      next()
    })

    testApp.use('/api/scrape', scrapeRouter)
    return testApp
  }

  beforeEach(() => {
    app = buildTestApp()
  })

  it('parses raw UCC document text and returns structured and canonical data', async () => {
    const documentText = `
      UCC FINANCING STATEMENT (FORM UCC-1)
      INITIAL FINANCING STATEMENT FILE NO: 2024-991122
      FILING DATE: 2024-04-12
      1a. ORGANIZATION'S NAME: HORIZON LOGISTICS LLC
      3a. ORGANIZATION'S NAME: VELOCITY CAPITAL CORP
      4. All accounts, inventory, and future receivables.
    `

    const response = await request(app).post('/api/scrape/parse-document').send({
      content: documentText,
      state: 'TX'
    })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.document.filingNumber).toBe('2024-991122')
    expect(response.body.data.document.debtor.name).toBe('HORIZON LOGISTICS LLC')
    expect(response.body.data.document.securedParty.name).toBe('VELOCITY CAPITAL CORP')
    expect(response.body.data.canonical.filingNumber).toBe('2024-991122')
    expect(response.body.data.canonical.status).toBe('active')
  })

  it('rejects empty content payload with validation error', async () => {
    const response = await request(app).post('/api/scrape/parse-document').send({})

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 402 for free-tier users', async () => {
    const freeApp = buildTestApp('free')
    const response = await request(freeApp).post('/api/scrape/parse-document').send({
      content: 'UCC FINANCING STATEMENT'
    })

    expect(response.status).toBe(402)
    expect(response.body.error.code).toBe('TIER_UPGRADE_REQUIRED')
  })
})
