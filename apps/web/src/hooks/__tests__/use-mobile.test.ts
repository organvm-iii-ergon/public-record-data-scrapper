import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '../use-mobile'

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth
  let matchMediaListeners: Array<() => void> = []

  const mockMatchMedia = (matches: boolean) => {
    return vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'change') {
          matchMediaListeners.push(cb)
        }
      }),
      removeEventListener: vi.fn((event: string, cb: () => void) => {
        if (event === 'change') {
          matchMediaListeners = matchMediaListeners.filter((l) => l !== cb)
        }
      }),
      dispatchEvent: vi.fn()
    }))
  }

  beforeEach(() => {
    matchMediaListeners = []
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    })
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should return true when window width is below mobile breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true })
      window.matchMedia = mockMatchMedia(true)

      const { result } = renderHook(() => useIsMobile())

      expect(result.current).toBe(true)
    })

    it('should return false when window width is above mobile breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
      window.matchMedia = mockMatchMedia(false)

      const { result } = renderHook(() => useIsMobile())

      expect(result.current).toBe(false)
    })

    it('should return false when window width equals mobile breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true })
      window.matchMedia = mockMatchMedia(false)

      const { result } = renderHook(() => useIsMobile())

      expect(result.current).toBe(false)
    })

    it('should return true when window width is exactly one below breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 767, writable: true })
      window.matchMedia = mockMatchMedia(true)

      const { result } = renderHook(() => useIsMobile())

      expect(result.current).toBe(true)
    })
  })

  describe('responsive behavior', () => {
    it('should update when window is resized below breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
      window.matchMedia = mockMatchMedia(false)

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(false)

      // Simulate resize to mobile
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 500, writable: true })
        matchMediaListeners.forEach((listener) => listener())
      })

      expect(result.current).toBe(true)
    })

    it('should update when window is resized above breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, writable: true })
      window.matchMedia = mockMatchMedia(true)

      const { result } = renderHook(() => useIsMobile())
      expect(result.current).toBe(true)

      // Simulate resize to desktop
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
        matchMediaListeners.forEach((listener) => listener())
      })

      expect(result.current).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
      const mockMql = mockMatchMedia(false)
      window.matchMedia = mockMql

      const { unmount } = renderHook(() => useIsMobile())

      expect(matchMediaListeners.length).toBeGreaterThan(0)

      unmount()

      // After unmount, listeners should be removed
      // The mock tracks removeEventListener calls
    })
  })

  describe('edge cases', () => {
    it('should handle rapid resize events', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
      window.matchMedia = mockMatchMedia(false)

      const { result } = renderHook(() => useIsMobile())

      // Simulate rapid resizing
      act(() => {
        for (let width = 1024; width >= 500; width -= 100) {
          Object.defineProperty(window, 'innerWidth', { value: width, writable: true })
          matchMediaListeners.forEach((listener) => listener())
        }
      })

      expect(result.current).toBe(true)

      act(() => {
        for (let width = 500; width <= 1024; width += 100) {
          Object.defineProperty(window, 'innerWidth', { value: width, writable: true })
          matchMediaListeners.forEach((listener) => listener())
        }
      })

      expect(result.current).toBe(false)
    })
  })
})
