import { Worker, Job } from 'bullmq'
import { redisConnection } from '../connection'
import { EnrichmentJobData } from '../queues'
import { EnrichmentService } from '../../services/EnrichmentService'

type EnrichmentSuccess = { prospectId: string; success: true; result: unknown }
type EnrichmentFailure = { prospectId: string; success: false; error: string }
type EnrichmentResultItem = EnrichmentSuccess | EnrichmentFailure
type EnrichmentBatchSummary = {
  total: number
  successful: number
  failed: number
  results: EnrichmentResultItem[]
}

async function processEnrichment(job: Job<EnrichmentJobData>): Promise<EnrichmentBatchSummary> {
  const { prospectIds, force = false } = job.data
  const enrichmentService = new EnrichmentService()

  await job.updateProgress(0)

  console.log(`[Enrichment Worker] Starting enrichment for ${prospectIds.length} prospects`)
  if (force) {
    console.log('[Enrichment Worker] Force enrichment enabled')
  }

  try {
    const total = prospectIds.length
    let completed = 0
    const results: EnrichmentResultItem[] = []

    for (const prospectId of prospectIds) {
      try {
        // Enrich individual prospect
        const result = await enrichmentService.enrichProspect(prospectId)
        results.push({ prospectId, success: true, result })
        completed++

        // Update progress
        const progress = Math.floor((completed / total) * 100)
        await job.updateProgress(progress)

        console.log(`[Enrichment Worker] Enriched ${prospectId} (${completed}/${total})`)
      } catch (error) {
        console.error(`[Enrichment Worker] Failed to enrich ${prospectId}:`, error)
        results.push({
          prospectId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        completed++
      }

      // Small delay to avoid overwhelming external APIs
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    console.log(
      `[Enrichment Worker] Completed batch: ${successCount} successful, ${failCount} failed`
    )

    // Return summary
    return {
      total,
      successful: successCount,
      failed: failCount,
      results
    }
  } catch (error) {
    console.error('[Enrichment Worker] Error processing batch:', error)
    throw error
  }
}

export function createEnrichmentWorker() {
  const { client } = redisConnection.connect()

  const worker = new Worker<EnrichmentJobData, EnrichmentBatchSummary>(
    'data-enrichment',
    processEnrichment,
    {
      connection: client,
      concurrency: 5, // Process 5 batches concurrently
      limiter: {
        max: 50, // Max 50 jobs
        duration: 60000 // per minute
      }
    }
  )

  worker.on('completed', (job, returnvalue) => {
    console.log(`[Enrichment Worker] Job ${job.id} completed:`, returnvalue)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Enrichment Worker] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[Enrichment Worker] Worker error:', err)
  })

  console.log('✓ Enrichment worker started')

  return worker
}
