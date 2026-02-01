import { useState, useCallback } from 'react'

export function useProspectSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectProspect = useCallback((id: string) => {
    setSelectedIds((prev) => new Set([...prev, id]))
  }, [])

  const deselectProspect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }, [])

  const toggleProspect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  return {
    selectedIds,
    setSelectedIds,
    selectProspect,
    deselectProspect,
    toggleProspect,
    selectAll,
    clearSelection,
    isSelected,
    selectedCount: selectedIds.size
  }
}
