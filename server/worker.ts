import { database } from './database/connection'
import { initializeQueues, closeQueues } from './queue/queues'
import { createIngestionWorker } from './queue/workers/ingestionWorker'
import { createEnrichmentWorker } from './queue/workers/enrichmentWorker'
import { createHealthWorker } from './queue/workers/healthWorker'
import { redisConnection } from './queue/connection'
import { config } from './config'

type ClosableWorker = {
  close: () => Promise<unknown>
}

class WorkerProcess {
  private workers: ClosableWorker[] = []

  async start() {
    console.log('')
    console.log('🔧 Starting Worker Process')
    console.log('─────────────────────────────────────')
    console.log(`  Environment: ${config.server.env}`)
    console.log(`  Redis:       ${config.redis.host}:${config.redis.port}`)
    console.log('─────────────────────────────────────')
    console.log('')

    try {
      // Connect to database
      await database.connect()

      // Initialize queues
      initializeQueues()

      // Start workers
      console.log('Starting workers...')
      this.workers.push(createIngestionWorker())
      this.workers.push(createEnrichmentWorker())
      this.workers.push(createHealthWorker())

      console.log('')
      console.log('✓ Worker process started successfully')
      console.log('  Workers are now processing jobs from the queues')
      console.log('  Press Ctrl+C to stop')
      console.log('')
    } catch (error) {
      console.error('Failed to start worker process:', error)
      process.exit(1)
    }
  }

  async shutdown() {
    console.log('')
    console.log('Shutting down worker process...')

    // Close workers
    console.log('Closing workers...')
    await Promise.all(this.workers.map((worker) => worker.close()))

    // Close queues
    await closeQueues()

    // Disconnect from Redis
    await redisConnection.disconnect()

    // Disconnect from database
    await database.disconnect()

    console.log('✓ Worker process shutdown complete')
    process.exit(0)
  }
}

// Start worker process
const worker = new WorkerProcess()
worker.start()

// Graceful shutdown
process.on('SIGTERM', () => worker.shutdown())
process.on('SIGINT', () => worker.shutdown())
