import { useState, useMemo } from 'react'
import { Prospect } from '@/lib/types'
import { SortField, SortDirection } from '@/components/SortControls'

export function useProspectSorting(prospects: Prospect[]) {
  const [sortField, setSortField] = useState<SortField>('priorityScore')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sortedProspects = useMemo(() => {
    return [...prospects].sort((a, b) => {
      let compareValue = 0

      switch (sortField) {
        case 'priorityScore':
          compareValue = a.priorityScore - b.priorityScore
          break
        case 'healthScore':
          compareValue = a.healthScore.score - b.healthScore.score
          break
        case 'signalCount':
          compareValue = a.growthSignals.length - b.growthSignals.length
          break
        case 'defaultAge':
          compareValue = a.timeSinceDefault - b.timeSinceDefault
          break
        case 'companyName':
          compareValue = a.companyName.localeCompare(b.companyName)
          break
      }

      return sortDirection === 'desc' ? -compareValue : compareValue
    })
  }, [prospects, sortField, sortDirection])

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field)
    setSortDirection(direction)
  }

  return {
    sortField,
    sortDirection,
    sortedProspects,
    setSortField,
    setSortDirection,
    handleSortChange
  }
}
