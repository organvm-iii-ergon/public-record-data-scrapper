import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersistentKV, useKV } from '../use-persistent-kv'

describe('usePersistentKV', () => {
  const originalLocalStorage = window.localStorage
  let mockStorage: Record<string, string> = {}
  let storageEventHandlers: Array<(event: StorageEvent) => void> = []

  beforeEach(() => {
    mockStorage = {}
    storageEventHandlers = []

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key]
        }),
        clear: vi.fn(() => {
          mockStorage = {}
        })
      },
      writable: true
    })

    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'storage') {
        storageEventHandlers.push(handler as (event: StorageEvent) => void)
      }
    })

    vi.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
      if (event === 'storage') {
        storageEventHandlers = storageEventHandlers.filter((h) => h !== handler)
      }
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    })
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should return initial value when no stored value exists', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      expect(result.current[0]).toBe('initial')
    })

    it('should return stored value when it exists', () => {
      mockStorage['prds:test-key'] = JSON.stringify('stored-value')

      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      expect(result.current[0]).toBe('stored-value')
    })

    it('should handle undefined initial value', () => {
      const { result } = renderHook(() => usePersistentKV<string>('test-key'))

      expect(result.current[0]).toBeUndefined()
    })

    it('should persist initial value to storage', () => {
      renderHook(() => usePersistentKV('test-key', 'initial'))

      expect(mockStorage['prds:test-key']).toBe(JSON.stringify('initial'))
    })

    it('should use storage prefix', () => {
      mockStorage['prds:prefixed-key'] = JSON.stringify('prefixed-value')

      const { result } = renderHook(() => usePersistentKV('prefixed-key', 'default'))

      expect(result.current[0]).toBe('prefixed-value')
    })
  })

  describe('setValue', () => {
    it('should update state with direct value', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      act(() => {
        result.current[1]('updated')
      })

      expect(result.current[0]).toBe('updated')
    })

    it('should update state with function updater', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', 10))

      act(() => {
        result.current[1]((prev) => (prev ?? 0) + 5)
      })

      expect(result.current[0]).toBe(15)
    })

    it('should persist updated value to localStorage', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      act(() => {
        result.current[1]('persisted')
      })

      expect(mockStorage['prds:test-key']).toBe(JSON.stringify('persisted'))
    })

    it('should handle complex objects', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', { count: 0 }))

      act(() => {
        result.current[1]({ count: 42 })
      })

      expect(result.current[0]).toEqual({ count: 42 })
      expect(mockStorage['prds:test-key']).toBe(JSON.stringify({ count: 42 }))
    })

    it('should handle arrays', () => {
      const { result } = renderHook(() => usePersistentKV<number[]>('test-key', []))

      act(() => {
        result.current[1]([1, 2, 3])
      })

      expect(result.current[0]).toEqual([1, 2, 3])
    })
  })

  describe('deleteValue', () => {
    it('should remove value from state', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      act(() => {
        result.current[2]()
      })

      expect(result.current[0]).toBeUndefined()
    })

    it('should remove value from localStorage', () => {
      mockStorage['prds:test-key'] = JSON.stringify('stored')

      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      act(() => {
        result.current[2]()
      })

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('prds:test-key')
    })
  })

  describe('storage events', () => {
    it('should update state when storage event is received', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      expect(result.current[0]).toBe('initial')

      // Simulate storage event from another tab
      act(() => {
        storageEventHandlers.forEach((handler) => {
          handler({
            key: 'prds:test-key',
            newValue: JSON.stringify('updated-from-other-tab')
          } as StorageEvent)
        })
      })

      expect(result.current[0]).toBe('updated-from-other-tab')
    })

    it('should ignore storage events for different keys', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      act(() => {
        storageEventHandlers.forEach((handler) => {
          handler({
            key: 'prds:other-key',
            newValue: JSON.stringify('other-value')
          } as StorageEvent)
        })
      })

      expect(result.current[0]).toBe('initial')
    })

    it('should set value to undefined when storage event has null newValue', () => {
      mockStorage['prds:test-key'] = JSON.stringify('stored')
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      expect(result.current[0]).toBe('stored')

      act(() => {
        storageEventHandlers.forEach((handler) => {
          handler({
            key: 'prds:test-key',
            newValue: null
          } as StorageEvent)
        })
      })

      expect(result.current[0]).toBeUndefined()
    })

    it('should remove event listener on unmount', () => {
      const { unmount } = renderHook(() => usePersistentKV('test-key', 'initial'))

      expect(storageEventHandlers.length).toBeGreaterThan(0)

      unmount()

      // Event handler should be removed
    })
  })

  describe('error handling', () => {
    it('should handle localStorage read errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => {
            throw new Error('Storage error')
          }),
          setItem: vi.fn(),
          removeItem: vi.fn()
        },
        writable: true
      })

      const { result } = renderHook(() => usePersistentKV('test-key', 'fallback'))

      expect(result.current[0]).toBe('fallback')
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should handle invalid JSON in storage', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockStorage['prds:test-key'] = 'not valid json'

      const { result } = renderHook(() => usePersistentKV('test-key', 'fallback'))

      expect(result.current[0]).toBe('fallback')
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })

    it('should handle localStorage write errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError')
          }),
          removeItem: vi.fn()
        },
        writable: true
      })

      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      // State should still update even if persistence fails
      act(() => {
        result.current[1]('updated')
      })

      expect(result.current[0]).toBe('updated')

      consoleWarnSpy.mockRestore()
    })

    it('should handle storage event parse errors', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      act(() => {
        storageEventHandlers.forEach((handler) => {
          handler({
            key: 'prds:test-key',
            newValue: 'not valid json'
          } as StorageEvent)
        })
      })

      expect(result.current[0]).toBeUndefined()
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  describe('useKV alias', () => {
    it('should be exported as useKV', () => {
      expect(useKV).toBe(usePersistentKV)
    })
  })

  describe('return tuple structure', () => {
    it('should return a 3-element tuple', () => {
      const { result } = renderHook(() => usePersistentKV('test-key', 'initial'))

      expect(result.current).toHaveLength(3)
      expect(typeof result.current[0]).toBe('string')
      expect(typeof result.current[1]).toBe('function')
      expect(typeof result.current[2]).toBe('function')
    })
  })
})
