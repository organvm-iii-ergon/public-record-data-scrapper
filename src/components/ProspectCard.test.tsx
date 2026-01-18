import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProspectCard } from './ProspectCard'
import { Prospect } from '@/lib/types'

// Mocking framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, className, ...props }: any) => {
      // Pass down onClick and other relevant props
      return (
        <div className={className} {...props}>
          {children}
        </div>
      )
    },
  },
}))

describe('ProspectCard', () => {
  const mockProspect: Prospect = {
    id: '1',
    companyName: 'Test Company',
    industry: 'technology',
    state: 'CA',
    status: 'new',
    priorityScore: 85,
    defaultDate: '2023-01-01',
    timeSinceDefault: 365,
    growthSignals: [],
    healthScore: {
      grade: 'A',
      score: 90,
      sentimentTrend: 'improving',
      reviewCount: 10,
      avgSentiment: 4.5,
      violationCount: 0,
      lastUpdated: '2023-01-01',
    },
    narrative: 'A promising tech company.',
    uccFilings: [],
    mlScoring: {
      confidence: 80,
      recoveryLikelihood: 75,
      modelVersion: '1.0',
      lastUpdated: '2023-01-01',
      factors: {
        healthTrend: 0.5,
        signalQuality: 0.8,
        industryRisk: 0.2,
        timeToRecovery: 0.6,
        financialStability: 0.7,
      }
    },
  }

  const mockOnSelect = vi.fn()

  it('renders correctly and is interactive', () => {
    render(<ProspectCard prospect={mockProspect} onSelect={mockOnSelect} />)

    // Check if the card is rendered as a button (accessible role)
    const card = screen.getByRole('button', { name: /view details for test company/i })

    expect(card).toBeInTheDocument()

    // Check click interaction
    fireEvent.click(card)
    expect(mockOnSelect).toHaveBeenCalledWith(mockProspect)
  })

  it('handles keyboard interaction (Enter key)', () => {
    render(<ProspectCard prospect={mockProspect} onSelect={mockOnSelect} />)

    const card = screen.getByRole('button', { name: /view details for test company/i })

    // Reset mock
    mockOnSelect.mockClear()

    // Simulate Enter key
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' })
    expect(mockOnSelect).toHaveBeenCalledWith(mockProspect)
  })

  it('handles keyboard interaction (Space key)', () => {
    render(<ProspectCard prospect={mockProspect} onSelect={mockOnSelect} />)

    const card = screen.getByRole('button', { name: /view details for test company/i })

    // Reset mock
    mockOnSelect.mockClear()

    // Simulate Space key
    fireEvent.keyDown(card, { key: ' ', code: 'Space' })
    expect(mockOnSelect).toHaveBeenCalledWith(mockProspect)
  })

  it('displays the inner "button" visual but does not nest interactive controls', () => {
    render(<ProspectCard prospect={mockProspect} onSelect={mockOnSelect} />)

    // The text "View Details" should be present
    expect(screen.getByText('View Details')).toBeInTheDocument()

    // However, it should NOT be a button itself to avoid nested controls
    // We check that there is only one button (the card itself)
    const buttons = screen.getAllByRole('button')
    // Ideally only 1 button (the card), unless there are other buttons (like badges behaving as buttons?)
    // But in this simple card, we expect 1 main interactive element.
    expect(buttons).toHaveLength(1)
  })
})
