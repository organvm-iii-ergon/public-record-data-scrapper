import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { StatsOverview } from './StatsOverview'
import type { DashboardStats } from '@/lib/types'

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>
  }
}))

describe('StatsOverview', () => {
  const renderComponent = (overrides: Partial<DashboardStats> = {}) => {
    const stats: DashboardStats = {
      totalProspects: 0,
      highValueProspects: 0,
      avgPriorityScore: 0,
      newSignalsToday: 0,
      portfolioAtRisk: 0,
      avgHealthGrade: 'N/A',
      ...overrides
    }

    render(<StatsOverview stats={stats} />)
  }

  it('renders zero values without crashing', () => {
    renderComponent()

    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
    expect(screen.getByText('0% of total')).toBeInTheDocument()
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.queryByText(/NaN%/i)).not.toBeInTheDocument()
  })

  it('renders provided stats', () => {
    renderComponent({
      totalProspects: 10,
      highValueProspects: 5,
      avgPriorityScore: 75,
      newSignalsToday: 3,
      portfolioAtRisk: 2,
      avgHealthGrade: 'B'
    })

    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('50% of total')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})
