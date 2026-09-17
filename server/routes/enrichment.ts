import { Router } from 'express'
import { z } from 'zod'
import { validateRequest } from '../middleware/validateRequest'
import { asyncHandler } from '../middleware/errorHandler'
import { getResolvedDataTier } from '../middleware/dataTier'
import type { AuthenticatedRequest } from '../middleware/authMiddleware'
import { EnrichmentService } from '../services/EnrichmentService'
import { entityResolutionService } from '../services/EntityResolutionService'

const router = Router()

// Validation schemas (`.strict()` rejects unknown keys to prevent
// mass-assignment of unexpected fields into enrichment/job inputs).
const enrichProspectSchema = z
  .object({
    prospect_id: z.string().uuid()
  })
  .strict()

const batchEnrichSchema = z
  .object({
    prospect_ids: z.array(z.string().uuid()).min(1).max(100)
  })
  .strict()

const triggerRefreshSchema = z
  .object({
    force: z.boolean().default(false)
  })
  .strict()

const resolveEntitiesSchema = z
  .object({
    filings: z
      .array(
        z.object({
          id: z.string(),
          externalId: z.string().optional(),
          filingDate: z.string(),
          debtorName: z.string().min(1),
          debtorAddress: z.string().optional(),
          debtorCity: z.string().optional(),
          debtorZip: z.string().optional(),
          state: z.string().min(2).max(2),
          securedParty: z.string().min(1),
          lienAmount: z.number().optional(),
          status: z.enum(['active', 'terminated', 'lapsed']).optional(),
          principals: z.array(z.string()).optional(),
          isIndividual: z.boolean().optional()
        })
      )
      .min(1)
      .max(500)
  })
  .strict()

const matchPairSchema = z
  .object({
    entity1: z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      state: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      zipCode: z.string().optional(),
      securedParty: z.string().optional(),
      principals: z.array(z.string()).optional(),
      filingDate: z.string().optional()
    }),
    entity2: z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      state: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      zipCode: z.string().optional(),
      securedParty: z.string().optional(),
      principals: z.array(z.string()).optional(),
      filingDate: z.string().optional()
    })
  })
  .strict()

const resolveProspectParamSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict()

// POST /api/enrichment/prospect - Enrich single prospect
router.post(
  '/prospect',
  validateRequest({ body: enrichProspectSchema }),
  asyncHandler(async (req, res) => {
    const enrichmentService = new EnrichmentService()
    const dataTier = getResolvedDataTier(req)
    const result = await enrichmentService.enrichProspect(req.body.prospect_id, dataTier)

    res.json({
      prospect_id: req.body.prospect_id,
      enrichment: result,
      enriched_at: new Date().toISOString()
    })
  })
)

// POST /api/enrichment/batch - Batch enrich prospects
router.post(
  '/batch',
  validateRequest({ body: batchEnrichSchema }),
  asyncHandler(async (req, res) => {
    const enrichmentService = new EnrichmentService()
    const dataTier = getResolvedDataTier(req)
    const results = await enrichmentService.enrichBatch(req.body.prospect_ids, dataTier)

    res.json({
      total: req.body.prospect_ids.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results
    })
  })
)

// POST /api/enrichment/refresh - Trigger data refresh
router.post(
  '/refresh',
  validateRequest({ body: triggerRefreshSchema }),
  asyncHandler(async (req, res) => {
    const enrichmentService = new EnrichmentService()
    const dataTier = getResolvedDataTier(req)
    const result = await enrichmentService.triggerRefresh(req.body.force, dataTier)

    res.json({
      triggered: true,
      force: req.body.force,
      ...result
    })
  })
)

// POST /api/enrichment/resolve-entities - Deduplicate & link entities across state filings
router.post(
  '/resolve-entities',
  validateRequest({ body: resolveEntitiesSchema }),
  asyncHandler(async (req, res) => {
    const summary = entityResolutionService.deduplicateFilings(req.body.filings)
    res.json(summary)
  })
)

// POST /api/enrichment/match-pair - Deterministic comparison score for an entity pair
router.post(
  '/match-pair',
  validateRequest({ body: matchPairSchema }),
  asyncHandler(async (req, res) => {
    const prediction = entityResolutionService.matchPair(req.body.entity1, req.body.entity2)
    res.json(prediction)
  })
)

// POST /api/enrichment/resolve-prospect/:id - Resolve cross-state filings and update prospect enrichment_confidence
router.post(
  '/resolve-prospect/:id',
  validateRequest({ params: resolveProspectParamSchema }),
  asyncHandler(async (req, res) => {
    const orgId = (req as AuthenticatedRequest).user?.orgId
    if (!orgId) {
      res.status(403).json({ error: 'Authenticated organization context is required' })
      return
    }
    const result = await entityResolutionService.resolveAndEnrichProspect(req.params.id, orgId)
    res.json(result)
  })
)

// GET /api/enrichment/status - Get enrichment pipeline status
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const enrichmentService = new EnrichmentService()
    const status = await enrichmentService.getStatus()

    res.json(status)
  })
)

// GET /api/enrichment/queue - Get enrichment queue status
router.get(
  '/queue',
  asyncHandler(async (req, res) => {
    const enrichmentService = new EnrichmentService()
    const queue = await enrichmentService.getQueueStatus()

    res.json(queue)
  })
)

export default router
