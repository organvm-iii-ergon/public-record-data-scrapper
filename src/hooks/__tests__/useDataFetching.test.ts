import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDataFetching } from '../useDataFetching'

// Mock data generators
vi.mock('@/lib/mockData', () => ({
  generateProspects: vi.fn((count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `mock-prospect-${i}`,
      companyName: `Mock Company ${i}`
    }))
  ),
  generateCompetitorData: vi.fn(() => [{ id: 'mock-competitor-1', name: 'Mock Competitor' }]),
  generatePortfolioCompanies: vi.fn((count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `mock-portfolio-${i}`,
      name: `Mock Portfolio ${i}`
    }))
  )
}))

// Mock API functions
const mockFetchProspects = vi.fn()
const mockFetchCompetitors = vi.fn()
const mockFetchPortfolio = vi.fn()
const mockFetchUserActions = vi.fn()

vi.mock('@/lib/api/prospects', () => ({
  fetchProspects: (...args: unknown[]) => mockFetchProspects(...args)
}))

vi.mock('@/lib/api/competitors', () => ({
  fetchCompetitors: (...args: unknown[]) => mockFetchCompetitors(...args)
}))

vi.mock('@/lib/api/portfolio', () => ({
  fetchPortfolio: (...args: unknown[]) => mockFetchPortfolio(...args)
}))

vi.mock('@/lib/api/userActions', () => ({
  fetchUserActions: (...args: unknown[]) => mockFetchUserActions(...args)
}))

// Mock useSafeKV
const mockKVStore: Record<string, unknown> = {}
const mockSetKV = vi.fn()

vi.mock('@/hooks/useSparkKV', async () => {
  const React = await import('react')

  const useSafeKV = (key: string, defaultValue: unknown) => {
    const [value, setValue] = React.useState(() => {
      if (!(key in mockKVStore)) {
        mockKVStore[key] = defaultValue
      }
      return mockKVStore[key]
    })

    const setPersistedValue = React.useCallback(
      (updater: unknown) => {
        mockSetKV(key, updater)
        const nextValue =
          typeof updater === 'function'
            ? (updater as (current: unknown) => unknown)(mockKVStore[key])
            : updater
        mockKVStore[key] = nextValue
        setValue(nextValue)
      },
      [key, setValue]
    )

    const deleteValue = React.useCallback(() => {
      delete mockKVStore[key]
      setValue(undefined)
    }, [key, setValue])

    return React.useMemo(
      () => [value, setPersistedValue, deleteValue] as const,
      [value, setPersistedValue, deleteValue]
    )
  }

  return { useSafeKV, useKV: useSafeKV }
})

describe('useDataFetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockKVStore).forEach((key) => delete mockKVStore[key])

    // Default mock implementations
    mockFetchProspects.mockResolvedValue([{ id: 'live-1', companyName: 'Live Company' }])
    mockFetchCompetitors.mockResolvedValue([{ id: 'comp-1', name: 'Competitor 1' }])
    mockFetchPortfolio.mockResolvedValue([{ id: 'port-1', name: 'Portfolio 1' }])
    mockFetchUserActions.mockResolvedValue([{ id: 'action-1', type: 'click' }])
  })

  describe('initial state', () => {
    it('should start loading and complete', async () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      // Hook manages loading state internally and completes quickly
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should initialize with array defaults', () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(Array.isArray(result.current.prospects)).toBe(true)
      expect(Array.isArray(result.current.competitors)).toBe(true)
      expect(Array.isArray(result.current.portfolio)).toBe(true)
      expect(Array.isArray(result.current.userActions)).toBe(true)
    })

    it('should have null loadError initially', () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(result.current.loadError).toBe(null)
    })
  })

  describe('mock data mode', () => {
    it('should load mock data when useMockData is true', async () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Mock data should be set
      expect(mockSetKV).toHaveBeenCalled()
      expect(result.current.prospects).toHaveLength(24)
      expect(result.current.competitors).toHaveLength(1)
      expect(result.current.portfolio).toHaveLength(15)
      expect(result.current.userActions).toEqual([])
    })

    it('should not call live API endpoints in mock mode', async () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockFetchProspects).not.toHaveBeenCalled()
      expect(mockFetchCompetitors).not.toHaveBeenCalled()
      expect(mockFetchPortfolio).not.toHaveBeenCalled()
      expect(mockFetchUserActions).not.toHaveBeenCalled()
    })
  })

  describe('live data mode', () => {
    it('should call all API endpoints when useMockData is false', async () => {
      renderHook(() => useDataFetching({ useMockData: false }))

      await waitFor(() => {
        expect(mockFetchProspects).toHaveBeenCalled()
      })

      expect(mockFetchCompetitors).toHaveBeenCalled()
      expect(mockFetchPortfolio).toHaveBeenCalled()
      expect(mockFetchUserActions).toHaveBeenCalled()
    })

    it('should pass abort signal to API calls', async () => {
      renderHook(() => useDataFetching({ useMockData: false }))

      await waitFor(() => {
        expect(mockFetchProspects).toHaveBeenCalled()
      })

      // Check that abort signal was passed
      const callArg = mockFetchProspects.mock.calls[0][0]
      expect(callArg).toBeDefined()
      expect(callArg instanceof AbortSignal).toBe(true)
    })

    it('should handle API errors', async () => {
      mockFetchProspects.mockRejectedValueOnce(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useDataFetching({ useMockData: false }))

      await waitFor(() => {
        expect(result.current.loadError).toBe('Network error')
      })

      expect(result.current.isLoading).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('fetchData function', () => {
    it('should return true on successful fetch', async () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      let fetchResult: boolean = false
      await act(async () => {
        fetchResult = await result.current.fetchData()
      })

      expect(fetchResult).toBe(true)
    })

    it('should return false on fetch error', async () => {
      mockFetchProspects.mockRejectedValue(new Error('Error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useDataFetching({ useMockData: false }))

      await waitFor(() => {
        expect(result.current.loadError).not.toBe(null)
      })

      let fetchResult = true
      await act(async () => {
        fetchResult = await result.current.fetchData()
      })

      expect(fetchResult).toBe(false)

      consoleSpy.mockRestore()
    })

    it('should support silent mode', async () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.fetchData({ silent: true })
      })

      // In silent mode, isLoading should not be set to true
      // The implementation still works, just doesn't update loading state
    })

    it('should handle abort signal', async () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const controller = new AbortController()
      controller.abort()

      let fetchResult: boolean = true
      await act(async () => {
        fetchResult = await result.current.fetchData({ signal: controller.signal })
      })

      expect(fetchResult).toBe(false)
    })
  })

  describe('setters', () => {
    it('should expose setProspects function', () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(typeof result.current.setProspects).toBe('function')
    })

    it('should expose setCompetitors function', () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(typeof result.current.setCompetitors).toBe('function')
    })

    it('should expose setPortfolio function', () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(typeof result.current.setPortfolio).toBe('function')
    })

    it('should expose setUserActions function', () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(typeof result.current.setUserActions).toBe('function')
    })
  })

  describe('lastDataRefresh', () => {
    it('should return a valid ISO date string', () => {
      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(result.current.lastDataRefresh).toBeDefined()
      expect(() => new Date(result.current.lastDataRefresh)).not.toThrow()
    })
  })

  describe('cleanup on unmount', () => {
    it('should abort pending requests on unmount', async () => {
      const { unmount } = renderHook(() => useDataFetching({ useMockData: false }))

      // Unmount immediately to trigger abort
      unmount()

      // The abort should prevent any state updates after unmount
    })
  })

  describe('data defaults', () => {
    it('should return empty array when prospects is null/undefined', () => {
      mockKVStore['ucc-prospects'] = null

      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(Array.isArray(result.current.prospects)).toBe(true)
    })

    it('should return empty array when competitors is null/undefined', () => {
      mockKVStore['competitor-data'] = null

      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(Array.isArray(result.current.competitors)).toBe(true)
    })

    it('should return empty array when portfolio is null/undefined', () => {
      mockKVStore['portfolio-companies'] = null

      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(Array.isArray(result.current.portfolio)).toBe(true)
    })

    it('should return empty array when userActions is null/undefined', () => {
      mockKVStore['user-actions'] = null

      const { result } = renderHook(() => useDataFetching({ useMockData: true }))

      expect(Array.isArray(result.current.userActions)).toBe(true)
    })
  })
})
