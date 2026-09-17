import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { HealthGradeBadge } from '../HealthGradeBadge'
import type { HealthGrade } from '@public-records/core'

vi.mock('@public-records/ui/badge', () => ({
  Badge: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  )
}))

describe('HealthGradeBadge', () => {
  const grades: HealthGrade[] = ['A', 'B', 'C', 'D', 'F']

  describe('rendering', () => {
    it.each(grades)('renders grade %s with correct label', (grade) => {
      render(<HealthGradeBadge grade={grade} />)

      const expectedLabels: Record<HealthGrade, string> = {
        A: 'A - Excellent',
        B: 'B - Good',
        C: 'C - Fair',
        D: 'D - Poor',
        F: 'F - Critical'
      }

      expect(screen.getByText(expectedLabels[grade])).toBeInTheDocument()
    })

    it('renders badge element', () => {
      render(<HealthGradeBadge grade="A" />)

      expect(screen.getByTestId('badge')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies success color for grade A', () => {
      render(<HealthGradeBadge grade="A" />)

      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-success')
    })

    it('applies secondary color for grade B', () => {
      render(<HealthGradeBadge grade="B" />)

      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-secondary')
    })

    it('applies warning color for grade C', () => {
      render(<HealthGradeBadge grade="C" />)

      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-warning')
    })

    it('applies accent color for grade D', () => {
      render(<HealthGradeBadge grade="D" />)

      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-accent')
    })

    it('applies destructive color for grade F', () => {
      render(<HealthGradeBadge grade="F" />)

      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('bg-destructive')
    })

    it('applies font-semibold and font-mono classes', () => {
      render(<HealthGradeBadge grade="A" />)

      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('font-semibold')
      expect(badge.className).toContain('font-mono')
    })

    it('applies custom className', () => {
      render(<HealthGradeBadge grade="A" className="custom-class" />)

      const badge = screen.getByTestId('badge')
      expect(badge.className).toContain('custom-class')
    })
  })
})
