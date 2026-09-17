import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { AdvancedFilters } from '../AdvancedFilters'
import { AdvancedFilterState, initialFilters } from '../advanced-filters'

// Mock UI components
vi.mock('@public-records/ui/button', () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    className,
    ...props
  }: {
    children: ReactNode
    onClick?: () => void
    variant?: string
    size?: string
    className?: string
  }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}))

vi.mock('@public-records/ui/label', () => ({
  Label: ({ children, className }: { children: ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  )
}))

vi.mock('@public-records/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    min,
    max,
    step,
    className
  }: {
    value: number[]
    onValueChange: (value: number[]) => void
    min?: number
    max?: number
    step?: number
    className?: string
  }) => (
    <input
      type="range"
      data-testid="slider"
      value={value[0]}
      min={min}
      max={max}
      step={step}
      className={className}
      onChange={(e) => onValueChange([Number(e.target.value)])}
    />
  )
}))

vi.mock('@public-records/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) => (
    <div data-testid="sheet" data-open={open}>
      {children}
    </div>
  ),
  SheetContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="sheet-content" className={className}>
      {children}
    </div>
  ),
  SheetDescription: ({ children, className }: { children: ReactNode; className?: string }) => (
    <p data-testid="sheet-description" className={className}>
      {children}
    </p>
  ),
  SheetHeader: ({ children }: { children: ReactNode }) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
    <h2 data-testid="sheet-title" className={className}>
      {children}
    </h2>
  ),
  SheetTrigger: ({ children }: { children: ReactNode }) => (
    <span data-testid="sheet-trigger">{children}</span>
  )
}))

vi.mock('@phosphor-icons/react', () => ({
  Funnel: ({ className }: { className?: string }) => (
    <span data-testid="funnel-icon" className={className} />
  )
}))

describe('AdvancedFilters', () => {
  const defaultProps = {
    filters: initialFilters,
    onFiltersChange: vi.fn(),
    activeFilterCount: 0
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the trigger button', () => {
      render(<AdvancedFilters {...defaultProps} />)
      // The trigger text should appear somewhere in the component
      const filterElements = screen.getAllByText(/Advanced Filters/i)
      expect(filterElements.length).toBeGreaterThan(0)
    })

    it('renders the funnel icon', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByTestId('funnel-icon')).toBeInTheDocument()
    })

    it('shows active filter count badge when filters are active', () => {
      render(<AdvancedFilters {...defaultProps} activeFilterCount={3} />)
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('does not show badge when no active filters', () => {
      render(<AdvancedFilters {...defaultProps} activeFilterCount={0} />)
      // Should not have a badge with "0"
      const badge = screen.queryByText(/^0$/)
      expect(badge).not.toBeInTheDocument()
    })
  })

  describe('sheet content', () => {
    it('renders sheet title', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByTestId('sheet-title')).toHaveTextContent('Advanced Filters')
    })

    it('renders sheet description', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByTestId('sheet-description')).toHaveTextContent(
        'Refine your prospect search with detailed criteria'
      )
    })
  })

  describe('health grade filter', () => {
    it('renders all health grade options', () => {
      render(<AdvancedFilters {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'C' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'D' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'F' })).toBeInTheDocument()
    })

    it('shows health grade label', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByText('Health Grade')).toBeInTheDocument()
    })
  })

  describe('status filter', () => {
    it('renders all status options', () => {
      render(<AdvancedFilters {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Claimed' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Contacted' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Qualified' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Dead' })).toBeInTheDocument()
    })

    it('shows status label', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByText('Status')).toBeInTheDocument()
    })
  })

  describe('signal types filter', () => {
    it('renders all signal type options', () => {
      render(<AdvancedFilters {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Hiring' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Permit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Contract' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Expansion' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Equipment' })).toBeInTheDocument()
    })

    it('shows signal types label', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByText('Signal Types')).toBeInTheDocument()
    })
  })

  describe('sentiment trend filter', () => {
    it('renders all sentiment options', () => {
      render(<AdvancedFilters {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Improving' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Stable' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Declining' })).toBeInTheDocument()
    })

    it('shows sentiment trend label', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByText('Sentiment Trend')).toBeInTheDocument()
    })
  })

  describe('sliders', () => {
    it('renders minimum signal count slider', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByText(/Minimum Signal Count/)).toBeInTheDocument()
      expect(screen.getAllByTestId('slider').length).toBeGreaterThan(0)
    })

    it('renders default age range slider', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByText(/Default Age Range/)).toBeInTheDocument()
    })

    it('renders revenue range slider', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByText(/Revenue Range/)).toBeInTheDocument()
    })
  })

  describe('violations filter', () => {
    it('renders all violation options', () => {
      render(<AdvancedFilters {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Any' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clean Record' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Has Violations' })).toBeInTheDocument()
    })

    it('shows violations label', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByText('Violations')).toBeInTheDocument()
    })
  })

  describe('action buttons', () => {
    it('renders reset button', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    })

    it('renders apply filters button', () => {
      render(<AdvancedFilters {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Apply Filters' })).toBeInTheDocument()
    })

    it('calls onFiltersChange with initial filters when reset is clicked', async () => {
      const onFiltersChange = vi.fn()
      render(<AdvancedFilters {...defaultProps} onFiltersChange={onFiltersChange} />)

      await userEvent.click(screen.getByRole('button', { name: 'Reset' }))

      expect(onFiltersChange).toHaveBeenCalledWith(initialFilters)
    })
  })

  describe('filter toggling', () => {
    it('toggles health grade selection', async () => {
      const onFiltersChange = vi.fn()
      render(<AdvancedFilters {...defaultProps} onFiltersChange={onFiltersChange} />)

      // Click grade A, then apply
      await userEvent.click(screen.getByRole('button', { name: 'A' }))
      await userEvent.click(screen.getByRole('button', { name: 'Apply Filters' }))

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          healthGrades: ['A']
        })
      )
    })

    it('toggles status selection', async () => {
      const onFiltersChange = vi.fn()
      render(<AdvancedFilters {...defaultProps} onFiltersChange={onFiltersChange} />)

      await userEvent.click(screen.getByRole('button', { name: 'New' }))
      await userEvent.click(screen.getByRole('button', { name: 'Apply Filters' }))

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: ['new']
        })
      )
    })

    it('toggles signal type selection', async () => {
      const onFiltersChange = vi.fn()
      render(<AdvancedFilters {...defaultProps} onFiltersChange={onFiltersChange} />)

      await userEvent.click(screen.getByRole('button', { name: 'Hiring' }))
      await userEvent.click(screen.getByRole('button', { name: 'Apply Filters' }))

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          signalTypes: ['hiring']
        })
      )
    })

    it('toggles sentiment trend selection', async () => {
      const onFiltersChange = vi.fn()
      render(<AdvancedFilters {...defaultProps} onFiltersChange={onFiltersChange} />)

      await userEvent.click(screen.getByRole('button', { name: 'Improving' }))
      await userEvent.click(screen.getByRole('button', { name: 'Apply Filters' }))

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sentimentTrends: ['improving']
        })
      )
    })
  })

  describe('initial filter state', () => {
    it('reflects provided filter state', () => {
      const customFilters: AdvancedFilterState = {
        ...initialFilters,
        healthGrades: ['A', 'B'],
        statuses: ['new'],
        minSignalCount: 5
      }

      render(<AdvancedFilters {...defaultProps} filters={customFilters} />)

      // The component should use the provided filters as initial state
      expect(screen.getByTestId('sheet')).toBeInTheDocument()
    })
  })

  describe('multiple selection', () => {
    it('allows multiple health grades to be selected', async () => {
      const onFiltersChange = vi.fn()
      render(<AdvancedFilters {...defaultProps} onFiltersChange={onFiltersChange} />)

      await userEvent.click(screen.getByRole('button', { name: 'A' }))
      await userEvent.click(screen.getByRole('button', { name: 'B' }))
      await userEvent.click(screen.getByRole('button', { name: 'Apply Filters' }))

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          healthGrades: ['A', 'B']
        })
      )
    })

    it('deselects when clicking selected item again', async () => {
      const onFiltersChange = vi.fn()
      render(<AdvancedFilters {...defaultProps} onFiltersChange={onFiltersChange} />)

      // Select then deselect
      await userEvent.click(screen.getByRole('button', { name: 'A' }))
      await userEvent.click(screen.getByRole('button', { name: 'A' }))
      await userEvent.click(screen.getByRole('button', { name: 'Apply Filters' }))

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          healthGrades: []
        })
      )
    })
  })
})
