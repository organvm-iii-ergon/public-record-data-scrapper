import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  Deal,
  DealWithDocuments,
  DealListParams,
  DealListResponse,
  DealStage,
  DealStats,
  DealDocument,
  DocumentChecklist,
  PipelineView,
  CreateDealParams,
  UpdateDealParams,
  MoveStageParams,
  UploadDocumentParams,
  fetchDeals,
  fetchDeal,
  fetchPipelineView,
  fetchDealStages,
  fetchDealStats,
  createDeal,
  updateDeal,
  moveDealToStage,
  uploadDealDocument,
  fetchDealDocuments,
  fetchDocumentChecklist,
  verifyDealDocument,
  deleteDealDocument
} from '@/lib/api/deals'

export interface UseDealActionsOptions {
  orgId: string
  onDealCreated?: (deal: Deal) => void
  onDealUpdated?: (deal: Deal) => void
  onStageMoved?: (deal: Deal) => void
  onDocumentUploaded?: (document: DealDocument) => void
  onDocumentDeleted?: (documentId: string) => void
}

export interface UseDealActionsResult {
  isLoading: boolean
  error: Error | null
  handleFetchDeals: (params?: Partial<DealListParams>) => Promise<DealListResponse | null>
  handleFetchDeal: (id: string) => Promise<DealWithDocuments | null>
  handleFetchPipelineView: () => Promise<PipelineView | null>
  handleFetchStages: () => Promise<DealStage[]>
  handleFetchStats: () => Promise<DealStats | null>
  handleCreateDeal: (params: Omit<CreateDealParams, 'org_id'>) => Promise<Deal | null>
  handleUpdateDeal: (id: string, params: UpdateDealParams) => Promise<Deal | null>
  handleMoveToStage: (id: string, params: MoveStageParams) => Promise<Deal | null>
  handleUploadDocument: (
    dealId: string,
    params: UploadDocumentParams
  ) => Promise<DealDocument | null>
  handleFetchDocuments: (dealId: string) => Promise<DealDocument[]>
  handleFetchDocumentChecklist: (dealId: string) => Promise<DocumentChecklist[]>
  handleVerifyDocument: (
    dealId: string,
    documentId: string,
    verifiedBy: string
  ) => Promise<DealDocument | null>
  handleDeleteDocument: (dealId: string, documentId: string) => Promise<boolean>
}

export function useDealActions({
  orgId,
  onDealCreated,
  onDealUpdated,
  onStageMoved,
  onDocumentUploaded,
  onDocumentDeleted
}: UseDealActionsOptions): UseDealActionsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const handleFetchDeals = useCallback(
    async (params: Partial<DealListParams> = {}): Promise<DealListResponse | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchDeals({ org_id: orgId, ...params })
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch deals')
        setError(error)
        toast.error('Failed to fetch deals', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId]
  )

  const handleFetchDeal = useCallback(
    async (id: string): Promise<DealWithDocuments | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const deal = await fetchDeal(id, orgId)
        return deal
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch deal')
        setError(error)
        toast.error('Failed to fetch deal', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId]
  )

  const handleFetchPipelineView = useCallback(async (): Promise<PipelineView | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const pipeline = await fetchPipelineView(orgId)
      return pipeline
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch pipeline view')
      setError(error)
      toast.error('Failed to fetch pipeline', {
        description: error.message
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  const handleFetchStages = useCallback(async (): Promise<DealStage[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchDealStages(orgId)
      return result.stages
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch stages')
      setError(error)
      toast.error('Failed to fetch stages', {
        description: error.message
      })
      return []
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  const handleFetchStats = useCallback(async (): Promise<DealStats | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const stats = await fetchDealStats(orgId)
      return stats
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch deal stats')
      setError(error)
      toast.error('Failed to fetch statistics', {
        description: error.message
      })
      return null
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  const handleCreateDeal = useCallback(
    async (params: Omit<CreateDealParams, 'org_id'>): Promise<Deal | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const deal = await createDeal({ org_id: orgId, ...params })
        toast.success('Deal created', {
          description: `Deal has been added to your pipeline.`
        })
        onDealCreated?.(deal)
        return deal
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create deal')
        setError(error)
        toast.error('Failed to create deal', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId, onDealCreated]
  )

  const handleUpdateDeal = useCallback(
    async (id: string, params: UpdateDealParams): Promise<Deal | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const deal = await updateDeal(id, orgId, params)
        toast.success('Deal updated', {
          description: 'Deal has been updated successfully.'
        })
        onDealUpdated?.(deal)
        return deal
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update deal')
        setError(error)
        toast.error('Failed to update deal', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId, onDealUpdated]
  )

  const handleMoveToStage = useCallback(
    async (id: string, params: MoveStageParams): Promise<Deal | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const deal = await moveDealToStage(id, orgId, params)
        toast.success('Deal moved', {
          description: 'Deal has been moved to the new stage.'
        })
        onStageMoved?.(deal)
        return deal
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to move deal')
        setError(error)
        toast.error('Failed to move deal', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId, onStageMoved]
  )

  const handleUploadDocument = useCallback(
    async (dealId: string, params: UploadDocumentParams): Promise<DealDocument | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const document = await uploadDealDocument(dealId, params)
        toast.success('Document uploaded', {
          description: `${params.file_name} has been uploaded.`
        })
        onDocumentUploaded?.(document)
        return document
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to upload document')
        setError(error)
        toast.error('Failed to upload document', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [onDocumentUploaded]
  )

  const handleFetchDocuments = useCallback(async (dealId: string): Promise<DealDocument[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchDealDocuments(dealId)
      return result.documents
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch documents')
      setError(error)
      toast.error('Failed to fetch documents', {
        description: error.message
      })
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleFetchDocumentChecklist = useCallback(
    async (dealId: string): Promise<DocumentChecklist[]> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchDocumentChecklist(dealId)
        return result.checklist
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch document checklist')
        setError(error)
        toast.error('Failed to fetch document checklist', {
          description: error.message
        })
        return []
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const handleVerifyDocument = useCallback(
    async (
      dealId: string,
      documentId: string,
      verifiedBy: string
    ): Promise<DealDocument | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const document = await verifyDealDocument(dealId, documentId, verifiedBy)
        toast.success('Document verified', {
          description: 'Document has been marked as verified.'
        })
        return document
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to verify document')
        setError(error)
        toast.error('Failed to verify document', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const handleDeleteDocument = useCallback(
    async (dealId: string, documentId: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        await deleteDealDocument(dealId, documentId)
        toast.info('Document deleted', {
          description: 'Document has been removed from the deal.'
        })
        onDocumentDeleted?.(documentId)
        return true
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete document')
        setError(error)
        toast.error('Failed to delete document', {
          description: error.message
        })
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [onDocumentDeleted]
  )

  return {
    isLoading,
    error,
    handleFetchDeals,
    handleFetchDeal,
    handleFetchPipelineView,
    handleFetchStages,
    handleFetchStats,
    handleCreateDeal,
    handleUpdateDeal,
    handleMoveToStage,
    handleUploadDocument,
    handleFetchDocuments,
    handleFetchDocumentChecklist,
    handleVerifyDocument,
    handleDeleteDocument
  }
}
