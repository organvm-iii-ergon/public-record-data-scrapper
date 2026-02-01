import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { SortControls, SortField, SortDirection } from '../SortControls'

vi.mock('@public-records/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange
  }: {
    children: ReactNode
    value: string
    onValueChange: (val: string) => void
  }) => (
    <div data-testid="select" data-value={value}>
      {children}
      <input
        data-testid="select-input"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      />
    </div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option data-testid="select-item" value={value}>
      {children}
    </option>
  )
}))

vi.mock('@public-records/ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel
  }: {
    children: ReactNode
    onClick?: () => void
    'aria-label'?: string
  }) => (
    <button data-testid="direction-button" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  )
}))

vi.mock('@phosphor-icons/react', () => ({
  ArrowUp: () => <span data-testid="arrow-up">ArrowUp</span>,
  ArrowDown: () => <span data-testid="arrow-down">ArrowDown</span>,
  ListNumbers: () => <span data-testid="list-numbers">ListNumbers</span>
}))

describe('SortControls', () => {
  const mockOnSortChange = vi.fn()

  const defaultProps = {
    sortField: 'priorityScore' as SortField,
    sortDirection: 'desc' as SortDirection,
    onSortChange: mockOnSortChange
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders select component', () => {
      render(<SortControls {...defaultProps} />)

      expect(screen.getByTestId('select')).toBeInTheDocument()
    })

    it('renders direction toggle button', () => {
      render(<SortControls {...defaultProps} />)

      expect(screen.getByTestId('direction-button')).toBeInTheDocument()
    })

    it('renders list numbers icon', () => {
      render(<SortControls {...defaultProps} />)

      expect(screen.getByTestId('list-numbers')).toBeInTheDocument()
    })

    it('renders all sort field options', () => {
      render(<SortControls {...defaultProps} />)

      expect(screen.getByText('Priority Score')).toBeInTheDocument()
      expect(screen.getByText('Health Score')).toBeInTheDocument()
      expect(screen.getByText('Growth Signals')).toBeInTheDocument()
      expect(screen.getByText('Default Age')).toBeInTheDocument()
      expect(screen.getByText('Company Name')).toBeInTheDocument()
    })
  })

  describe('direction indicator', () => {
    it('shows arrow down when sortDirection is desc', () => {
      render(<SortControls {...defaultProps} sortDirection="desc" />)

      expect(screen.getByTestId('arrow-down')).toBeInTheDocument()
      expect(screen.queryByTestId('arrow-up')).not.toBeInTheDocument()
    })

    it('shows arrow up when sortDirection is asc', () => {
      render(<SortControls {...defaultProps} sortDirection="asc" />)

      expect(screen.getByTestId('arrow-up')).toBeInTheDocument()
      expect(screen.queryByTestId('arrow-down')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has aria-label for sort descending', () => {
      render(<SortControls {...defaultProps} sortDirection="asc" />)

      expect(screen.getByLabelText('Sort descending')).toBeInTheDocument()
    })

    it('has aria-label for sort ascending', () => {
      render(<SortControls {...defaultProps} sortDirection="desc" />)

      expect(screen.getByLabelText('Sort ascending')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('toggles direction from desc to asc when button clicked', () => {
      render(<SortControls {...defaultProps} sortDirection="desc" />)

      fireEvent.click(screen.getByTestId('direction-button'))

      expect(mockOnSortChange).toHaveBeenCalledWith('priorityScore', 'asc')
    })

    it('toggles direction from asc to desc when button clicked', () => {
      render(<SortControls {...defaultProps} sortDirection="asc" />)

      fireEvent.click(screen.getByTestId('direction-button'))

      expect(mockOnSortChange).toHaveBeenCalledWith('priorityScore', 'desc')
    })

    it('calls onSortChange when sort field changes', () => {
      render(<SortControls {...defaultProps} />)

      const selectInput = screen.getByTestId('select-input')
      fireEvent.change(selectInput, { target: { value: 'healthScore' } })

      expect(mockOnSortChange).toHaveBeenCalledWith('healthScore', 'desc')
    })
  })

  describe('current value display', () => {
    it('displays current sort field value', () => {
      render(<SortControls {...defaultProps} sortField="healthScore" />)

      const select = screen.getByTestId('select')
      expect(select).toHaveAttribute('data-value', 'healthScore')
    })
  })
})
