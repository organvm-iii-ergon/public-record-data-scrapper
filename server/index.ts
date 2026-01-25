import express, { Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { config, validateConfig } from './config'
import { database } from './database/connection'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { requestLogger } from './middleware/requestLogger'
import { createRateLimiter, closeRateLimiterConnection } from './middleware/rateLimiter'
import { authMiddleware } from './middleware/authMiddleware'
import { httpsRedirect } from './middleware/httpsRedirect'

// Import routes
import prospectsRouter from './routes/prospects'
import competitorsRouter from './routes/competitors'
import portfolioRouter from './routes/portfolio'
import enrichmentRouter from './routes/enrichment'
import healthRouter from './routes/health'
import jobsRouter from './routes/jobs'

// Import queue infrastructure
import { initializeQueues, closeQueues } from './queue/queues'
import { jobScheduler } from './queue/scheduler'
import { redisConnection } from './queue/connection'

export class Server {
  private app: Express

  constructor() {
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
  }

  private setupMiddleware(): void {
    // HTTPS redirect (before everything else in production)
    this.app.use(httpsRedirect)

    // Security headers
    this.app.use(helmet())
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: config.cors.credentials
      })
    )

    // Parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))

    // Compression
    this.app.use(compression())

    // Logging
    this.app.use(requestLogger)

    // Rate limiting (Redis-based in production, in-memory in development)
    this.app.use(createRateLimiter())
  }

  private setupRoutes(): void {
    // Public routes (no authentication required)
    this.app.use('/api/health', healthRouter)

    // Protected API routes (authentication required)
    this.app.use('/api/prospects', authMiddleware, prospectsRouter)
    this.app.use('/api/competitors', authMiddleware, competitorsRouter)
    this.app.use('/api/portfolio', authMiddleware, portfolioRouter)
    this.app.use('/api/enrichment', authMiddleware, enrichmentRouter)
    this.app.use('/api/jobs', authMiddleware, jobsRouter)

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'UCC-MCA Intelligence API',
        version: '1.0.0',
        status: 'ok',
        documentation: '/api/docs',
        endpoints: {
          prospects: '/api/prospects',
          competitors: '/api/competitors',
          portfolio: '/api/portfolio',
          enrichment: '/api/enrichment',
          health: '/api/health',
          jobs: '/api/jobs'
        }
      })
    })
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler)

    // Global error handler
    this.app.use(errorHandler)
  }

  async start(): Promise<void> {
    const port = config.server.port
    const host = config.server.host

    // Validate configuration
    try {
      validateConfig()
    } catch (error) {
      console.error('Configuration error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }

    // Connect to database
    try {
      await database.connect()
    } catch (error) {
      console.error('Failed to connect to database:', error)
      process.exit(1)
    }

    // Initialize job queues
    try {
      initializeQueues()
    } catch (error) {
      console.error('Failed to initialize job queues:', error)
      process.exit(1)
    }

    // Start job scheduler
    try {
      await jobScheduler.start()
    } catch (error) {
      console.error('Failed to start job scheduler:', error)
      process.exit(1)
    }

    // Start server
    this.app.listen(port, host, () => {
      console.log('')
      console.log('🚀 UCC-MCA Intelligence API Server')
      console.log('─────────────────────────────────────')
      console.log(`  Environment: ${config.server.env}`)
      console.log(`  Server:      http://${host}:${port}`)
      console.log(`  Health:      http://${host}:${port}/api/health`)
      console.log(`  Jobs:        http://${host}:${port}/api/jobs`)
      console.log(`  Database:    ${this.maskConnectionString(config.database.url)}`)
      console.log(`  Redis:       ${config.redis.host}:${config.redis.port}`)
      console.log('─────────────────────────────────────')
      console.log('')
    })
  }

  async shutdown(): Promise<void> {
    console.log('')
    console.log('Shutting down server...')

    // Stop job scheduler
    jobScheduler.stop()

    // Close queues
    await closeQueues()

    // Close rate limiter Redis connection
    await closeRateLimiterConnection()

    // Disconnect from Redis
    await redisConnection.disconnect()

    // Disconnect from database
    await database.disconnect()

    console.log('✓ Server shutdown complete')
    process.exit(0)
  }

  private maskConnectionString(url: string): string {
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.username}:***@${parsed.host}${parsed.pathname}`
    } catch {
      return 'postgresql://***:***@***/***'
    }
  }

  getApp(): Express {
    return this.app
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server()
  server.start()

  // Graceful shutdown
  process.on('SIGTERM', () => server.shutdown())
  process.on('SIGINT', () => server.shutdown())
}

export default Server
