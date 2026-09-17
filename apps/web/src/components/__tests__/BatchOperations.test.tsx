import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { BatchOperations } from '../BatchOperations'
import type { Prospect } from '@public-records/core'

vi.mock('@public-records/ui/button', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button data-testid="button" onClick={onClick}>
      {children}
    </button>
  )
}))

vi.mock('@public-records/ui/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span data-testid="badge">{children}</span>
}))

vi.mock('@public-records/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange
  }: {
    checked: boolean | 'indeterminate'
    onCheckedChange: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked === true}
      data-indeterminate={checked === 'indeterminate'}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  )
}))

vi.mock('@public-records/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button data-testid="dropdown-item" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />
}))

vi.mock('@phosphor-icons/react', () => ({
  CaretDown: () => <span>CaretDown</span>,
  Export: () => <span>Export</span>,
  CheckSquare: () => <span>CheckSquare</span>,
  Trash: () => <span>Trash</span>,
  UserPlus: () => <span>UserPlus</span>
}))

describe('BatchOperations', () => {
  const mockOnSelectionChange = vi.fn()
  const mockOnBatchClaim = vi.fn()
  const mockOnBatchExport = vi.fn()
  const mockOnBatchDelete = vi.fn()

  const createProspect = (id: string): Prospect =>
    ({
      id,
      companyName: `Company ${id}`,
      state: 'CA',
      industry: 'technology',
      priorityScore: 80,
      status: 'new'
    }) as Prospect

  const defaultProps = {
    prospects: [createProspect('1'), createProspect('2'), createProspect('3')],
    selectedIds: new Set<string>(),
    onSelectionChange: mockOnSelectionChange,
    onBatchClaim: mockOnBatchClaim,
    onBatchExport: mockOnBatchExport,
    onBatchDelete: mockOnBatchDelete
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty state', () => {
    it('returns null when prospects array is empty', () => {
      const { container } = render(<BatchOperations {...defaultProps} prospects={[]} />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('rendering', () => {
    it('renders checkbox', () => {
      render(<BatchOperations {...defaultProps} />)

      // Both desktop and mobile checkboxes are rendered
      const checkboxes = screen.getAllByTestId('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
      expect(checkboxes[0]).toBeInTheDocument()
    })

    it('renders "Select all" text when nothing selected', () => {
      render(<BatchOperations {...defaultProps} />)

      // Both desktop and mobile versions show "Select all"
      const selectAllTexts = screen.getAllByText('Select all')
      expect(selectAllTexts.length).toBeGreaterThan(0)
      expect(selectAllTexts[0]).toBeInTheDocument()
    })

    it('renders selection count when items selected', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      // Both desktop and mobile versions show selection count
      const selectedTexts = screen.getAllByText('2 selected')
      expect(selectedTexts.length).toBeGreaterThan(0)
      expect(selectedTexts[0]).toBeInTheDocument()
    })

    it('does not render dropdown when nothing selected', () => {
      render(<BatchOperations {...defaultProps} />)

      expect(screen.queryByTestId('dropdown')).not.toBeInTheDocument()
    })

    it('renders dropdown when items selected', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1'])} />)

      expect(screen.getByTestId('dropdown')).toBeInTheDocument()
    })

    it('renders badge with selected count', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      expect(screen.getByText('2 prospects')).toBeInTheDocument()
    })
  })

  describe('checkbox state', () => {
    it('checkbox is unchecked when nothing selected', () => {
      render(<BatchOperations {...defaultProps} />)

      const checkboxes = screen.getAllByTestId('checkbox')
      expect(checkboxes[0]).not.toBeChecked()
    })

    it('checkbox is checked when all selected', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2', '3'])} />)

      const checkboxes = screen.getAllByTestId('checkbox')
      expect(checkboxes[0]).toBeChecked()
    })

    it('checkbox is indeterminate when some selected', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1'])} />)

      const checkboxes = screen.getAllByTestId('checkbox')
      expect(checkboxes[0]).toHaveAttribute('data-indeterminate', 'true')
    })
  })

  describe('select all toggle', () => {
    it('selects all when checkbox clicked and none selected', () => {
      render(<BatchOperations {...defaultProps} />)

      const checkboxes = screen.getAllByTestId('checkbox')
      fireEvent.click(checkboxes[0])

      expect(mockOnSelectionChange).toHaveBeenCalledWith(new Set(['1', '2', '3']))
    })

    it('deselects all when checkbox clicked and all selected', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2', '3'])} />)

      const checkboxes = screen.getAllByTestId('checkbox')
      fireEvent.click(checkboxes[0])

      expect(mockOnSelectionChange).toHaveBeenCalledWith(new Set())
    })

    it('selects all when checkbox clicked and some selected', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1'])} />)

      const checkboxes = screen.getAllByTestId('checkbox')
      fireEvent.click(checkboxes[0])

      expect(mockOnSelectionChange).toHaveBeenCalledWith(new Set(['1', '2', '3']))
    })
  })

  describe('batch actions', () => {
    it('renders claim action with count', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      expect(screen.getByText(/Claim Selected \(2\)/)).toBeInTheDocument()
    })

    it('renders export action with count', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      expect(screen.getByText(/Export Selected \(2\)/)).toBeInTheDocument()
    })

    it('renders delete action with count', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      expect(screen.getByText(/Remove Selected \(2\)/)).toBeInTheDocument()
    })

    it('calls onBatchClaim when claim action clicked', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      const items = screen.getAllByTestId('dropdown-item')
      const claimItem = items.find((item) => item.textContent?.includes('Claim'))
      fireEvent.click(claimItem!)

      expect(mockOnBatchClaim).toHaveBeenCalledWith(['1', '2'])
    })

    it('calls onBatchExport when export action clicked', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      const items = screen.getAllByTestId('dropdown-item')
      const exportItem = items.find((item) => item.textContent?.includes('Export'))
      fireEvent.click(exportItem!)

      expect(mockOnBatchExport).toHaveBeenCalledWith(['1', '2'])
    })

    it('calls onBatchDelete when delete action clicked', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      const items = screen.getAllByTestId('dropdown-item')
      const deleteItem = items.find((item) => item.textContent?.includes('Remove'))
      fireEvent.click(deleteItem!)

      expect(mockOnBatchDelete).toHaveBeenCalledWith(['1', '2'])
    })

    it('clears selection after batch action', () => {
      render(<BatchOperations {...defaultProps} selectedIds={new Set(['1', '2'])} />)

      const items = screen.getAllByTestId('dropdown-item')
      const claimItem = items.find((item) => item.textContent?.includes('Claim'))
      fireEvent.click(claimItem!)

      expect(mockOnSelectionChange).toHaveBeenCalledWith(new Set())
    })
  })
})
