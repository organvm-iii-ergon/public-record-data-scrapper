import { Router } from 'express'
import { z } from 'zod'
import { validateRequest } from '../middleware/validateRequest'
import { asyncHandler } from '../middleware/errorHandler'
import { ProspectsService } from '../services/ProspectsService'

const router = Router()

// Validation schemas
const querySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  state: z.string().length(2).optional(),
  industry: z.string().optional(),
  min_score: z.string().regex(/^\d+$/).transform(Number).optional(),
  max_score: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: z.enum(['all', 'unclaimed', 'claimed', 'contacted']).optional(),
  sort_by: z.enum(['priority_score', 'created_at', 'company_name']).default('priority_score'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
})

const createProspectSchema = z.object({
  company_name: z.string().min(1),
  state: z.string().length(2),
  industry: z.enum([
    'restaurant',
    'retail',
    'construction',
    'healthcare',
    'manufacturing',
    'services',
    'technology'
  ]),
  lien_amount: z.number().positive().optional(),
  filing_date: z.string().datetime().optional()
})

const updateProspectSchema = createProspectSchema.partial()

const idParamSchema = z.object({
  id: z.string().uuid()
})

type ProspectsQuery = z.infer<typeof querySchema>

// GET /api/prospects - List prospects (paginated, filtered, sorted)
router.get(
  '/',
  validateRequest({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const prospectsService = new ProspectsService()
    const result = await prospectsService.list(req.query as ProspectsQuery)

    res.json({
      prospects: result.prospects,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    })
  })
)

// GET /api/prospects/:id - Get prospect details
router.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const prospectsService = new ProspectsService()
    const prospect = await prospectsService.getById(req.params.id)

    if (!prospect) {
      return res.status(404).json({
        error: {
          message: `Prospect ${req.params.id} not found`,
          code: 'NOT_FOUND',
          statusCode: 404
        }
      })
    }

    res.json(prospect)
  })
)

// POST /api/prospects - Create prospect
router.post(
  '/',
  validateRequest({ body: createProspectSchema }),
  asyncHandler(async (req, res) => {
    const prospectsService = new ProspectsService()
    const prospect = await prospectsService.create(req.body)

    res.status(201).json(prospect)
  })
)

// PATCH /api/prospects/:id - Update prospect
router.patch(
  '/:id',
  validateRequest({ params: idParamSchema, body: updateProspectSchema }),
  asyncHandler(async (req, res) => {
    const prospectsService = new ProspectsService()
    const prospect = await prospectsService.update(req.params.id, req.body)

    if (!prospect) {
      return res.status(404).json({
        error: {
          message: `Prospect ${req.params.id} not found`,
          code: 'NOT_FOUND',
          statusCode: 404
        }
      })
    }

    res.json(prospect)
  })
)

// DELETE /api/prospects/:id - Delete prospect
router.delete(
  '/:id',
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const prospectsService = new ProspectsService()
    const deleted = await prospectsService.delete(req.params.id)

    if (!deleted) {
      return res.status(404).json({
        error: {
          message: `Prospect ${req.params.id} not found`,
          code: 'NOT_FOUND',
          statusCode: 404
        }
      })
    }

    res.status(204).send()
  })
)

export default router
