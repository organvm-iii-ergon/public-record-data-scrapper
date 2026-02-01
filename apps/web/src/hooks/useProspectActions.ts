import { useCallback } from 'react'
import { Prospect } from '@public-records/core'
import { ExportFormat, exportProspects } from '@/lib/exportUtils'
import {
  claimProspect,
  unclaimProspect,
  batchClaimProspects,
  deleteProspects as deleteProspectsApi
} from '@/lib/api/prospects'
import { toast } from 'sonner'

export interface UseProspectActionsOptions {
  useMockData: boolean
  prospects: Prospect[]
  setProspects: (updater: Prospect[] | ((prev: Prospect[]) => Prospect[])) => void
  trackAction: (type: string, details?: Record<string, unknown>) => Promise<void>
  exportFormat: ExportFormat
  hasFilters: boolean
}

export interface UseProspectActionsResult {
  handleClaimLead: (prospect: Prospect) => Promise<void>
  handleUnclaimLead: (prospect: Prospect) => Promise<void>
  handleExportProspect: (prospect: Prospect) => void
  handleExportProspects: (prospectsToExport: Prospect[]) => void
  handleBatchClaim: (ids: string[]) => Promise<void>
  handleBatchExport: (ids: string[]) => void
  handleBatchDelete: (ids: string[]) => Promise<void>
}

export function useProspectActions({
  useMockData,
  prospects,
  setProspects,
  trackAction,
  exportFormat,
  hasFilters
}: UseProspectActionsOptions): UseProspectActionsResult {
  const handleExportProspects = useCallback(
    (prospectsToExport: Prospect[]) => {
      try {
        const filterInfo = hasFilters ? 'filtered' : undefined
        const format = exportFormat || 'json'

        exportProspects(prospectsToExport, format, filterInfo)

        const formatLabel = format.toUpperCase()
        toast.success(`Prospect(s) exported as ${formatLabel}`, {
          description: `${prospectsToExport.length} lead(s) exported successfully.`
        })
        void trackAction('export-prospects', {
          format,
          count: prospectsToExport.length,
          filtered: Boolean(filterInfo)
        })
      } catch (error) {
        toast.error('Export failed', {
          description: error instanceof Error ? error.message : 'Unknown error occurred'
        })
      }
    },
    [exportFormat, hasFilters, trackAction]
  )

  const handleExportProspect = useCallback(
    (prospect: Prospect) => {
      handleExportProspects([prospect])
    },
    [handleExportProspects]
  )

  const handleClaimLead = useCallback(
    async (prospect: Prospect) => {
      const user = 'Current User'
      const today = new Date().toISOString().split('T')[0]

      try {
        const updatedProspect = useMockData
          ? {
              ...prospect,
              status: 'claimed' as const,
              claimedBy: user,
              claimedDate: today
            }
          : await claimProspect(prospect.id, user)

        setProspects((currentProspects) => {
          const list = currentProspects ?? []
          const exists = list.some((p) => p.id === updatedProspect.id)
          if (!exists) {
            return [...list, updatedProspect]
          }
          return list.map((p) => (p.id === updatedProspect.id ? updatedProspect : p))
        })

        void trackAction('claim', { prospectId: prospect.id })
        toast.success('Lead claimed successfully', {
          description: `${updatedProspect.companyName} has been added to your pipeline.`
        })
      } catch (error) {
        console.error('Failed to claim prospect', error)
        toast.error('Unable to claim lead', {
          description:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while claiming the lead.'
        })
      }
    },
    [useMockData, setProspects, trackAction]
  )

  const handleUnclaimLead = useCallback(
    async (prospect: Prospect) => {
      try {
        const updatedProspect = useMockData
          ? {
              ...prospect,
              status: 'new' as const,
              claimedBy: undefined,
              claimedDate: undefined
            }
          : await unclaimProspect(prospect.id)

        setProspects((currentProspects) => {
          const list = currentProspects ?? []
          const exists = list.some((p) => p.id === updatedProspect.id)
          if (!exists) {
            return list
          }
          return list.map((p) => (p.id === updatedProspect.id ? updatedProspect : p))
        })

        toast.info('Lead unclaimed', {
          description: `${updatedProspect.companyName} is now available for claiming.`
        })
        void trackAction('unclaim', { prospectId: prospect.id })
      } catch (error) {
        console.error('Failed to unclaim prospect', error)
        toast.error('Unable to unclaim lead', {
          description:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while unclaiming the lead.'
        })
      }
    },
    [useMockData, setProspects, trackAction]
  )

  const handleBatchClaim = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return

      const user = 'Current User'
      const today = new Date().toISOString().split('T')[0]

      if (useMockData) {
        setProspects((currentProspects) => {
          if (!currentProspects) return []
          return currentProspects.map((p) =>
            ids.includes(p.id) && p.status !== 'claimed'
              ? { ...p, status: 'claimed' as const, claimedBy: user, claimedDate: today }
              : p
          )
        })

        toast.success(`${ids.length} leads claimed`, {
          description: 'Selected leads have been added to your pipeline.'
        })
        void trackAction('batch-claim', { prospectIds: ids })
        return
      }

      try {
        const updatedProspects = await batchClaimProspects(ids, user)
        const updates = new Map(updatedProspects.map((p) => [p.id, p]))

        setProspects((currentProspects) => {
          const list = currentProspects ?? []
          return list.map((p) => updates.get(p.id) ?? p)
        })

        toast.success(`${ids.length} leads claimed`, {
          description: 'Selected leads have been added to your pipeline.'
        })
        void trackAction('batch-claim', { prospectIds: ids })
      } catch (error) {
        console.error('Failed to batch claim prospects', error)
        toast.error('Unable to claim selected leads', {
          description:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while claiming the selected leads.'
        })
      }
    },
    [useMockData, setProspects, trackAction]
  )

  const handleBatchExport = useCallback(
    (ids: string[]) => {
      const prospectsToExport = prospects.filter((p) => ids.includes(p.id))
      handleExportProspects(prospectsToExport)
    },
    [prospects, handleExportProspects]
  )

  const handleBatchDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return

      if (useMockData) {
        setProspects((currentProspects) => {
          if (!currentProspects) return []
          return currentProspects.filter((p) => !ids.includes(p.id))
        })

        toast.info(`${ids.length} prospects removed`, {
          description: 'Selected prospects have been removed from the list.'
        })
        void trackAction('batch-delete', { prospectIds: ids })
        return
      }

      try {
        await deleteProspectsApi(ids)
        setProspects((currentProspects) => {
          if (!currentProspects) return []
          return currentProspects.filter((p) => !ids.includes(p.id))
        })

        toast.info(`${ids.length} prospects removed`, {
          description: 'Selected prospects have been removed from the list.'
        })
        void trackAction('batch-delete', { prospectIds: ids })
      } catch (error) {
        console.error('Failed to delete prospects', error)
        toast.error('Unable to delete selected prospects', {
          description:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while deleting the selected prospects.'
        })
      }
    },
    [useMockData, setProspects, trackAction]
  )

  return {
    handleClaimLead,
    handleUnclaimLead,
    handleExportProspect,
    handleExportProspects,
    handleBatchClaim,
    handleBatchExport,
    handleBatchDelete
  }
}
