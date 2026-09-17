import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProspectSelection } from '../useProspectSelection'

describe('useProspectSelection', () => {
  describe('initial state', () => {
    it('should initialize with empty selection', () => {
      const { result } = renderHook(() => useProspectSelection())

      expect(result.current.selectedIds.size).toBe(0)
    })

    it('should have selectedCount of 0', () => {
      const { result } = renderHook(() => useProspectSelection())

      expect(result.current.selectedCount).toBe(0)
    })
  })

  describe('selectProspect', () => {
    it('should add id to selection', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })

      expect(result.current.selectedIds.has('id-1')).toBe(true)
      expect(result.current.selectedCount).toBe(1)
    })

    it('should add multiple ids to selection', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })
      act(() => {
        result.current.selectProspect('id-2')
      })
      act(() => {
        result.current.selectProspect('id-3')
      })

      expect(result.current.selectedCount).toBe(3)
      expect(result.current.selectedIds.has('id-1')).toBe(true)
      expect(result.current.selectedIds.has('id-2')).toBe(true)
      expect(result.current.selectedIds.has('id-3')).toBe(true)
    })

    it('should be idempotent - adding same id twice does not duplicate', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })
      act(() => {
        result.current.selectProspect('id-1')
      })

      expect(result.current.selectedCount).toBe(1)
    })
  })

  describe('deselectProspect', () => {
    it('should remove id from selection', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
        result.current.selectProspect('id-2')
      })
      act(() => {
        result.current.deselectProspect('id-1')
      })

      expect(result.current.selectedIds.has('id-1')).toBe(false)
      expect(result.current.selectedIds.has('id-2')).toBe(true)
      expect(result.current.selectedCount).toBe(1)
    })

    it('should not error when deselecting non-existent id', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.deselectProspect('non-existent')
      })

      expect(result.current.selectedCount).toBe(0)
    })

    it('should be idempotent - deselecting same id twice is safe', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })
      act(() => {
        result.current.deselectProspect('id-1')
      })
      act(() => {
        result.current.deselectProspect('id-1')
      })

      expect(result.current.selectedCount).toBe(0)
    })
  })

  describe('toggleProspect', () => {
    it('should add id when not selected', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.toggleProspect('id-1')
      })

      expect(result.current.selectedIds.has('id-1')).toBe(true)
      expect(result.current.selectedCount).toBe(1)
    })

    it('should remove id when already selected', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })
      act(() => {
        result.current.toggleProspect('id-1')
      })

      expect(result.current.selectedIds.has('id-1')).toBe(false)
      expect(result.current.selectedCount).toBe(0)
    })

    it('should toggle back and forth', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.toggleProspect('id-1')
      })
      expect(result.current.selectedIds.has('id-1')).toBe(true)

      act(() => {
        result.current.toggleProspect('id-1')
      })
      expect(result.current.selectedIds.has('id-1')).toBe(false)

      act(() => {
        result.current.toggleProspect('id-1')
      })
      expect(result.current.selectedIds.has('id-1')).toBe(true)
    })
  })

  describe('selectAll', () => {
    it('should select all provided ids', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectAll(['id-1', 'id-2', 'id-3', 'id-4', 'id-5'])
      })

      expect(result.current.selectedCount).toBe(5)
      expect(result.current.selectedIds.has('id-1')).toBe(true)
      expect(result.current.selectedIds.has('id-5')).toBe(true)
    })

    it('should replace existing selection', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('old-id')
      })
      act(() => {
        result.current.selectAll(['id-1', 'id-2'])
      })

      expect(result.current.selectedIds.has('old-id')).toBe(false)
      expect(result.current.selectedCount).toBe(2)
    })

    it('should handle empty array', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })
      act(() => {
        result.current.selectAll([])
      })

      expect(result.current.selectedCount).toBe(0)
    })

    it('should handle duplicate ids in array', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectAll(['id-1', 'id-1', 'id-2', 'id-2'])
      })

      expect(result.current.selectedCount).toBe(2)
    })
  })

  describe('clearSelection', () => {
    it('should remove all selections', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectAll(['id-1', 'id-2', 'id-3'])
      })
      act(() => {
        result.current.clearSelection()
      })

      expect(result.current.selectedCount).toBe(0)
      expect(result.current.selectedIds.size).toBe(0)
    })

    it('should be safe to call on empty selection', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.clearSelection()
      })

      expect(result.current.selectedCount).toBe(0)
    })
  })

  describe('isSelected', () => {
    it('should return true for selected id', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })

      expect(result.current.isSelected('id-1')).toBe(true)
    })

    it('should return false for unselected id', () => {
      const { result } = renderHook(() => useProspectSelection())

      expect(result.current.isSelected('id-1')).toBe(false)
    })

    it('should return false after deselection', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })
      act(() => {
        result.current.deselectProspect('id-1')
      })

      expect(result.current.isSelected('id-1')).toBe(false)
    })

    it('should return false after clearSelection', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })
      act(() => {
        result.current.clearSelection()
      })

      expect(result.current.isSelected('id-1')).toBe(false)
    })
  })

  describe('selectedCount', () => {
    it('should track selection count accurately', () => {
      const { result } = renderHook(() => useProspectSelection())

      expect(result.current.selectedCount).toBe(0)

      act(() => {
        result.current.selectProspect('id-1')
      })
      expect(result.current.selectedCount).toBe(1)

      act(() => {
        result.current.selectProspect('id-2')
      })
      expect(result.current.selectedCount).toBe(2)

      act(() => {
        result.current.deselectProspect('id-1')
      })
      expect(result.current.selectedCount).toBe(1)

      act(() => {
        result.current.clearSelection()
      })
      expect(result.current.selectedCount).toBe(0)
    })
  })

  describe('setSelectedIds', () => {
    it('should allow direct Set manipulation', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.setSelectedIds(new Set(['id-1', 'id-2', 'id-3']))
      })

      expect(result.current.selectedCount).toBe(3)
      expect(result.current.selectedIds.has('id-1')).toBe(true)
      expect(result.current.selectedIds.has('id-2')).toBe(true)
      expect(result.current.selectedIds.has('id-3')).toBe(true)
    })
  })

  describe('large-scale operations', () => {
    it('should handle large selections efficiently', () => {
      const { result } = renderHook(() => useProspectSelection())

      const largeIdArray = Array.from({ length: 1000 }, (_, i) => `id-${i}`)

      act(() => {
        result.current.selectAll(largeIdArray)
      })

      expect(result.current.selectedCount).toBe(1000)
      expect(result.current.isSelected('id-0')).toBe(true)
      expect(result.current.isSelected('id-999')).toBe(true)
    })

    it('should handle rapid toggle operations', () => {
      const { result } = renderHook(() => useProspectSelection())

      // Perform many rapid toggles
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.toggleProspect('id-1')
        })
      }

      // After 100 toggles (even number), should be deselected
      expect(result.current.isSelected('id-1')).toBe(false)
    })
  })

  describe('callback stability', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(() => useProspectSelection())

      const firstSelectProspect = result.current.selectProspect
      const firstDeselectProspect = result.current.deselectProspect
      const firstToggleProspect = result.current.toggleProspect
      const firstSelectAll = result.current.selectAll
      const firstClearSelection = result.current.clearSelection

      rerender()

      expect(result.current.selectProspect).toBe(firstSelectProspect)
      expect(result.current.deselectProspect).toBe(firstDeselectProspect)
      expect(result.current.toggleProspect).toBe(firstToggleProspect)
      expect(result.current.selectAll).toBe(firstSelectAll)
      expect(result.current.clearSelection).toBe(firstClearSelection)
    })

    it('should update isSelected when selection changes', () => {
      const { result } = renderHook(() => useProspectSelection())

      act(() => {
        result.current.selectProspect('id-1')
      })

      // isSelected should use the updated selectedIds
      expect(result.current.isSelected('id-1')).toBe(true)

      act(() => {
        result.current.deselectProspect('id-1')
      })

      expect(result.current.isSelected('id-1')).toBe(false)
    })
  })
})
