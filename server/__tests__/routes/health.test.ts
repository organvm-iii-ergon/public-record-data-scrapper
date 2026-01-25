import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { Express } from 'express'
import request from 'supertest'
import healthRouter from '../../routes/health'

// Mock the database module
vi.mock('../../database/connection', () => ({
  database: {
    query: vi.fn()
  }
}))

import { database } from '../../database/connection'

describe('Health Routes', () => {
  let app: Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/health', healthRouter)
    vi.clearAllMocks()
  })

  describe('GET /api/health', () => {
    it('returns basic health status', async () => {
      const response = await request(app).get('/api/health')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        status: 'ok',
        environment: expect.any(String)
      })
      expect(response.body.timestamp).toBeDefined()
      expect(response.body.uptime).toBeGreaterThanOrEqual(0)
    })

    it('includes environment information', async () => {
      const response = await request(app).get('/api/health')

      expect(response.body.environment).toBe(process.env.NODE_ENV || 'development')
    })
  })

  describe('GET /api/health/detailed', () => {
    it('returns detailed health status when database is healthy', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await request(app).get('/api/health/detailed')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        status: 'ok',
        services: {
          database: 'ok',
          memory: expect.any(String),
          cpu: 'ok'
        }
      })
    })

    it('returns degraded status when database fails', async () => {
      vi.mocked(database.query).mockRejectedValueOnce(new Error('Database connection failed'))

      const response = await request(app).get('/api/health/detailed')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        status: 'degraded',
        services: {
          database: 'error'
        }
      })
    })

    it('includes all service checks', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await request(app).get('/api/health/detailed')

      expect(response.body.services).toBeDefined()
      expect(response.body.services.database).toBeDefined()
      expect(response.body.services.memory).toBeDefined()
      expect(response.body.services.cpu).toBeDefined()
    })
  })

  describe('GET /api/health/ready', () => {
    it('returns ready when database is available', async () => {
      vi.mocked(database.query).mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await request(app).get('/api/health/ready')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        ready: true
      })
      expect(response.body.timestamp).toBeDefined()
    })

    it('returns 503 when database is unavailable', async () => {
      vi.mocked(database.query).mockRejectedValueOnce(new Error('Connection refused'))

      const response = await request(app).get('/api/health/ready')

      expect(response.status).toBe(503)
      expect(response.body).toMatchObject({
        ready: false,
        error: 'Database not ready'
      })
    })
  })

  describe('GET /api/health/live', () => {
    it('returns alive status', async () => {
      const response = await request(app).get('/api/health/live')

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        alive: true
      })
      expect(response.body.timestamp).toBeDefined()
    })

    it('always returns 200 for liveness checks', async () => {
      // Liveness probe should always succeed if the process is running
      const response = await request(app).get('/api/health/live')

      expect(response.status).toBe(200)
    })
  })
})
