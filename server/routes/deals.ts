import { Router } from 'express'
import { z } from 'zod'
import { validateRequest } from '../middleware/validateRequest'
import { asyncHandler } from '../middleware/errorHandler'
import { DealsService } from '../services/DealsService'

const router = Router()

// Validation schemas
const dealPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent'])
const documentTypeEnum = z.enum([
  'application', 'bank_statement', 'tax_return', 'voided_check',
  'drivers_license', 'business_license', 'landlord_letter',
  'contract', 'signed_contract', 'disclosure', 'signed_disclosure',
  'other'
])
const useOfFundsEnum = z.enum([
  'working_capital', 'inventory', 'equipment', 'expansion',
  'payroll', 'marketing', 'debt_consolidation', 'real_estate', 'other'
])

const listDealsQuerySchema = z.object({
  org_id: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  stage_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  prospect_id: z.string().uuid().optional(),
  priority: dealPriorityEnum.optional(),
  search: z.string().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'amount_requested', 'expected_close_date']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
})

const createDealSchema = z.object({
  org_id: z.string().uuid(),
  prospect_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  amount_requested: z.number().positive().optional(),
  term_months: z.number().int().positive().optional(),
  use_of_funds: useOfFundsEnum.optional(),
  use_of_funds_details: z.string().optional(),
  priority: dealPriorityEnum.default('normal'),
  expected_close_date: z.string().datetime().optional()
})

const updateDealSchema = z.object({
  prospect_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  lender_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  amount_requested: z.number().positive().optional(),
  amount_approved: z.number().positive().optional().nullable(),
  term_months: z.number().int().positive().optional(),
  factor_rate: z.number().positive().optional().nullable(),
  daily_payment: z.number().positive().optional().nullable(),
  weekly_payment: z.number().positive().optional().nullable(),
  use_of_funds: useOfFundsEnum.optional(),
  use_of_funds_details: z.string().optional().nullable(),
  average_daily_balance: z.number().optional().nullable(),
  monthly_revenue: z.number().positive().optional().nullable(),
  nsf_count: z.number().int().min(0).optional(),
  existing_positions: z.number().int().min(0).optional(),
  priority: dealPriorityEnum.optional(),
  probability: z.number().min(0).max(100).optional(),
  expected_close_date: z.string().datetime().optional().nullable(),
  lost_reason: z.string().optional().nullable(),
  lost_notes: z.string().optional().nullable()
})

const moveStageSchema = z.object({
  stage_id: z.string().uuid(),
  notes: z.string().optional(),
  changed_by: z.string().uuid().optional()
})

const uploadDocumentSchema = z.object({
  document_type: documentTypeEnum,
  file_name: z.string().min(1),
  file_path: z.string().min(1),
  file_size: z.number().int().positive().optional(),
  mime_type: z.string().optional(),
  is_required: z.boolean().default(false),
  uploaded_by: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
})

const idParamSchema = z.object({
  id: z.string().uuid()
})

const orgIdQuerySchema = z.object({
  org_id: z.string().uuid()
})

// GET /api/deals - List deals with pipeline view and stage grouping
router.get(
  '/',
  validateRequest({ query: listDealsQuerySchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const query = req.query as z.infer<typeof listDealsQuerySchema>

    const result = await dealsService.list({
      orgId: query.org_id,
      page: query.page,
      limit: query.limit,
      stageId: query.stage_id,
      assignedTo: query.assigned_to,
      prospectId: query.prospect_id,
      priority: query.priority,
      search: query.search,
      sortBy: query.sort_by,
      sortOrder: query.sort_order
    })

    res.json({
      deals: result.deals,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit)
      }
    })
  })
)

// GET /api/deals/pipeline - Get pipeline view with deals grouped by stage
router.get(
  '/pipeline',
  validateRequest({ query: orgIdQuerySchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { org_id } = req.query as z.infer<typeof orgIdQuerySchema>

    const pipeline = await dealsService.getPipelineView(org_id)

    res.json(pipeline)
  })
)

// GET /api/deals/stages - Get all stages for an organization
router.get(
  '/stages',
  validateRequest({ query: orgIdQuerySchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { org_id } = req.query as z.infer<typeof orgIdQuerySchema>

    const stages = await dealsService.getStages(org_id)

    res.json({ stages })
  })
)

// GET /api/deals/stats - Get pipeline statistics
router.get(
  '/stats',
  validateRequest({ query: orgIdQuerySchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { org_id } = req.query as z.infer<typeof orgIdQuerySchema>

    const stats = await dealsService.getStats(org_id)

    res.json(stats)
  })
)

// POST /api/deals - Create deal (often from a prospect)
router.post(
  '/',
  validateRequest({ body: createDealSchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const body = req.body as z.infer<typeof createDealSchema>

    const deal = await dealsService.create({
      orgId: body.org_id,
      prospectId: body.prospect_id,
      contactId: body.contact_id,
      stageId: body.stage_id,
      assignedTo: body.assigned_to,
      amountRequested: body.amount_requested,
      termMonths: body.term_months,
      useOfFunds: body.use_of_funds,
      useOfFundsDetails: body.use_of_funds_details,
      priority: body.priority,
      expectedCloseDate: body.expected_close_date
    })

    res.status(201).json(deal)
  })
)

// GET /api/deals/:id - Get deal details
router.get(
  '/:id',
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { id } = req.params
    const orgId = req.query.org_id as string

    if (!orgId) {
      return res.status(400).json({
        error: {
          message: 'org_id query parameter is required',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        }
      })
    }

    const deal = await dealsService.getById(id, orgId)

    if (!deal) {
      return res.status(404).json({
        error: {
          message: `Deal ${id} not found`,
          code: 'NOT_FOUND',
          statusCode: 404
        }
      })
    }

    // Fetch documents for the deal
    const documents = await dealsService.getDocuments(id)
    const checklist = await dealsService.getDocumentChecklist(id)

    res.json({
      ...deal,
      documents,
      documentChecklist: checklist
    })
  })
)

// PUT /api/deals/:id - Update deal
router.put(
  '/:id',
  validateRequest({ params: idParamSchema, body: updateDealSchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { id } = req.params
    const orgId = req.query.org_id as string

    if (!orgId) {
      return res.status(400).json({
        error: {
          message: 'org_id query parameter is required',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        }
      })
    }

    const body = req.body as z.infer<typeof updateDealSchema>

    const deal = await dealsService.update(id, orgId, {
      prospectId: body.prospect_id ?? undefined,
      contactId: body.contact_id ?? undefined,
      lenderId: body.lender_id ?? undefined,
      assignedTo: body.assigned_to ?? undefined,
      amountRequested: body.amount_requested,
      amountApproved: body.amount_approved ?? undefined,
      termMonths: body.term_months,
      factorRate: body.factor_rate ?? undefined,
      dailyPayment: body.daily_payment ?? undefined,
      weeklyPayment: body.weekly_payment ?? undefined,
      useOfFunds: body.use_of_funds,
      useOfFundsDetails: body.use_of_funds_details ?? undefined,
      averageDailyBalance: body.average_daily_balance ?? undefined,
      monthlyRevenue: body.monthly_revenue ?? undefined,
      nsfCount: body.nsf_count,
      existingPositions: body.existing_positions,
      priority: body.priority,
      probability: body.probability,
      expectedCloseDate: body.expected_close_date ?? undefined,
      lostReason: body.lost_reason ?? undefined,
      lostNotes: body.lost_notes ?? undefined
    })

    res.json(deal)
  })
)

// PATCH /api/deals/:id/stage - Move deal to a new stage
router.patch(
  '/:id/stage',
  validateRequest({ params: idParamSchema, body: moveStageSchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { id } = req.params
    const orgId = req.query.org_id as string

    if (!orgId) {
      return res.status(400).json({
        error: {
          message: 'org_id query parameter is required',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        }
      })
    }

    const body = req.body as z.infer<typeof moveStageSchema>

    const deal = await dealsService.moveToStage(id, orgId, body.stage_id, {
      notes: body.notes,
      changedBy: body.changed_by
    })

    res.json(deal)
  })
)

// POST /api/deals/:id/documents - Upload document to deal
router.post(
  '/:id/documents',
  validateRequest({ params: idParamSchema, body: uploadDocumentSchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { id } = req.params
    const body = req.body as z.infer<typeof uploadDocumentSchema>

    const document = await dealsService.uploadDocument({
      dealId: id,
      documentType: body.document_type,
      fileName: body.file_name,
      filePath: body.file_path,
      fileSize: body.file_size,
      mimeType: body.mime_type,
      isRequired: body.is_required,
      uploadedBy: body.uploaded_by,
      metadata: body.metadata
    })

    res.status(201).json(document)
  })
)

// GET /api/deals/:id/documents - Get documents for a deal
router.get(
  '/:id/documents',
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { id } = req.params

    const documents = await dealsService.getDocuments(id)

    res.json({ documents })
  })
)

// GET /api/deals/:id/documents/checklist - Get document checklist for a deal
router.get(
  '/:id/documents/checklist',
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { id } = req.params

    const checklist = await dealsService.getDocumentChecklist(id)

    res.json({ checklist })
  })
)

// PATCH /api/deals/:id/documents/:documentId/verify - Verify a document
router.patch(
  '/:id/documents/:documentId/verify',
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { documentId } = req.params
    const verifiedBy = req.body.verified_by as string

    if (!verifiedBy) {
      return res.status(400).json({
        error: {
          message: 'verified_by is required',
          code: 'VALIDATION_ERROR',
          statusCode: 400
        }
      })
    }

    const document = await dealsService.verifyDocument(documentId, verifiedBy)

    res.json(document)
  })
)

// DELETE /api/deals/:id/documents/:documentId - Delete a document
router.delete(
  '/:id/documents/:documentId',
  asyncHandler(async (req, res) => {
    const dealsService = new DealsService()
    const { documentId } = req.params

    const deleted = await dealsService.deleteDocument(documentId)

    if (!deleted) {
      return res.status(404).json({
        error: {
          message: `Document ${documentId} not found`,
          code: 'NOT_FOUND',
          statusCode: 404
        }
      })
    }

    res.status(204).send()
  })
)

export default router
