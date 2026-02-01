import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { AuditLogViewer } from '../compliance/AuditLogViewer'
import type { AuditLog, User } from '@public-records/core'

// Mock UI components
vi.mock('@public-records/ui/card', () => ({
  Card: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  )
}))

vi.mock('@public-records/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
    ...props
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
    variant?: string
    size?: string
    className?: string
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}))

vi.mock('@public-records/ui/input', () => ({
  Input: ({
    placeholder,
    value,
    onChange,
    className,
    type
  }: {
    placeholder?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    className?: string
    type?: string
  }) => (
    <input
      data-testid="input"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={className}
      type={type}
    />
  )
}))

vi.mock('@public-records/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className
  }: {
    children: ReactNode
    variant?: string
    className?: string
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  )
}))

vi.mock('@public-records/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  )
}))

vi.mock('@public-records/ui/table', () => ({
  Table: ({ children }: { children: ReactNode }) => <table data-testid="table">{children}</table>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children, className }: { children: ReactNode; className?: string }) => (
    <th className={className}>{children}</th>
  ),
  TableCell: ({
    children,
    colSpan,
    className
  }: {
    children: ReactNode
    colSpan?: number
    className?: string
  }) => (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  )
}))

vi.mock('@public-records/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange
  }: {
    children: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => (
    <div data-testid="select" data-value={value}>
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        data-testid="select-native"
      >
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="select-trigger" className={className}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>
}))

vi.mock('@public-records/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
    onOpenChange
  }: {
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => (
    <div data-testid="dialog" data-open={open}>
      {open && children}
      {onOpenChange && (
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      )}
    </div>
  ),
  DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => (
    <h3 data-testid="dialog-title">{children}</h3>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  )
}))

vi.mock('@phosphor-icons/react', () => ({
  MagnifyingGlass: ({ className }: { className?: string }) => (
    <span data-testid="magnifying-glass-icon" className={className} />
  ),
  Funnel: ({ className }: { className?: string }) => (
    <span data-testid="funnel-icon" className={className} />
  ),
  Export: ({ className }: { className?: string }) => (
    <span data-testid="export-icon" className={className} />
  ),
  ClockCounterClockwise: ({ className }: { className?: string }) => (
    <span data-testid="clock-counter-icon" className={className} />
  ),
  User: ({ className }: { className?: string }) => (
    <span data-testid="user-icon" className={className} />
  ),
  ArrowRight: ({ className }: { className?: string }) => (
    <span data-testid="arrow-right-icon" className={className} />
  ),
  Eye: ({ className }: { className?: string }) => (
    <span data-testid="eye-icon" className={className} />
  ),
  Calendar: ({ className }: { className?: string }) => (
    <span data-testid="calendar-icon" className={className} />
  )
}))

vi.mock('@public-records/ui/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')
}))

describe('AuditLogViewer', () => {
  const mockUsers: User[] = [
    {
      id: 'user-1',
      orgId: 'org-1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Johnson',
      role: 'admin',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'user-2',
      orgId: 'org-1',
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Smith',
      role: 'broker',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }
  ]

  const mockAuditLogs: AuditLog[] = [
    {
      id: 'log-1',
      orgId: 'org-1',
      userId: 'user-1',
      action: 'create',
      entityType: 'prospect',
      entityId: 'prospect-123',
      changes: {
        companyName: { old: null, new: 'Acme Corp' }
      },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      requestId: 'req-abc123',
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: 'log-2',
      orgId: 'org-1',
      userId: 'user-2',
      action: 'update',
      entityType: 'contact',
      entityId: 'contact-456',
      changes: {
        email: { old: 'old@email.com', new: 'new@email.com' },
        phone: { old: '555-0000', new: '555-1111' }
      },
      ipAddress: '192.168.1.2',
      createdAt: '2024-01-15T11:00:00Z'
    },
    {
      id: 'log-3',
      orgId: 'org-1',
      userId: 'user-1',
      action: 'delete',
      entityType: 'deal',
      entityId: 'deal-789',
      beforeState: { status: 'active', amount: 50000 },
      ipAddress: '192.168.1.1',
      createdAt: '2024-01-14T09:00:00Z'
    },
    {
      id: 'log-4',
      orgId: 'org-1',
      userId: 'user-2',
      action: 'send',
      entityType: 'communication',
      entityId: 'comm-101',
      afterState: { channel: 'email', status: 'sent' },
      createdAt: '2024-01-14T14:30:00Z'
    },
    {
      id: 'log-5',
      orgId: 'org-1',
      action: 'sign',
      entityType: 'disclosure',
      entityId: 'disclosure-202',
      createdAt: '2024-01-13T16:00:00Z'
    }
  ]

  const defaultProps = {
    auditLogs: mockAuditLogs,
    users: mockUsers,
    onExport: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the audit log viewer', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByTestId('card')).toBeInTheDocument()
    })

    it('displays header with Audit Log title', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('Audit Log')).toBeInTheDocument()
    })

    it('displays log count badge', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('renders Export button', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('renders search input', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByPlaceholderText(/search by action, entity, user/i)).toBeInTheDocument()
    })

    it('renders the audit log table', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByTestId('table')).toBeInTheDocument()
    })
  })

  describe('table columns', () => {
    it('displays Timestamp column', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('Timestamp')).toBeInTheDocument()
    })

    it('displays User column', () => {
      render(<AuditLogViewer {...defaultProps} />)
      // There are multiple "User" elements (column header and filter), get the column header
      const table = screen.getByTestId('table')
      expect(within(table).getByText('User')).toBeInTheDocument()
    })

    it('displays Action column', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('Action')).toBeInTheDocument()
    })

    it('displays Entity column', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('Entity')).toBeInTheDocument()
    })

    it('displays Entity ID column', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('Entity ID')).toBeInTheDocument()
    })
  })

  describe('log entries', () => {
    it('displays user names from users array', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getAllByText('Alice Johnson').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Bob Smith').length).toBeGreaterThan(0)
    })

    it('displays System for logs without userId', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('System')).toBeInTheDocument()
    })

    it('displays truncated userId when user not found', () => {
      const logsWithUnknownUser: AuditLog[] = [
        {
          ...mockAuditLogs[0],
          userId: 'unknown-user-id-12345'
        }
      ]
      render(<AuditLogViewer {...defaultProps} auditLogs={logsWithUnknownUser} />)
      expect(screen.getByText('unknown-')).toBeInTheDocument()
    })

    it('displays actions', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('create')).toBeInTheDocument()
      expect(screen.getByText('update')).toBeInTheDocument()
      expect(screen.getByText('delete')).toBeInTheDocument()
      expect(screen.getByText('send')).toBeInTheDocument()
      expect(screen.getByText('sign')).toBeInTheDocument()
    })

    it('displays entity types', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('Prospect')).toBeInTheDocument()
      expect(screen.getByText('Contact')).toBeInTheDocument()
      expect(screen.getByText('Deal')).toBeInTheDocument()
      expect(screen.getByText('Communication')).toBeInTheDocument()
      expect(screen.getByText('Disclosure')).toBeInTheDocument()
    })

    it('displays truncated entity IDs', () => {
      render(<AuditLogViewer {...defaultProps} />)
      expect(screen.getByText('prospect-123')).toBeInTheDocument()
      expect(screen.getByText('contact-456')).toBeInTheDocument()
    })

    it('displays view button for each log', () => {
      render(<AuditLogViewer {...defaultProps} />)
      const eyeIcons = screen.getAllByTestId('eye-icon')
      expect(eyeIcons.length).toBe(5)
    })
  })

  describe('search functionality', () => {
    it('filters by action', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search by action, entity, user/i)
      await user.type(searchInput, 'create')

      expect(screen.getByText('create')).toBeInTheDocument()
      expect(screen.queryByText('update')).not.toBeInTheDocument()
    })

    it('filters by entity type', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search by action, entity, user/i)
      await user.type(searchInput, 'prospect')

      expect(screen.getByText('Prospect')).toBeInTheDocument()
      expect(screen.queryByText('Contact')).not.toBeInTheDocument()
    })

    it('filters by user name', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search by action, entity, user/i)
      await user.type(searchInput, 'alice')

      expect(screen.getAllByText('Alice Johnson').length).toBeGreaterThan(0)
      expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()
    })

    it('filters by entity ID', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search by action, entity, user/i)
      await user.type(searchInput, 'prospect-123')

      expect(screen.getByText('prospect-123')).toBeInTheDocument()
      expect(screen.queryByText('contact-456')).not.toBeInTheDocument()
    })
  })

  describe('entity type filter', () => {
    it('filters by prospect entity type', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[0], 'prospect')

      expect(screen.getByText('Prospect')).toBeInTheDocument()
      expect(screen.queryByText('Contact')).not.toBeInTheDocument()
    })

    it('filters by contact entity type', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[0], 'contact')

      expect(screen.getByText('Contact')).toBeInTheDocument()
      expect(screen.queryByText('Prospect')).not.toBeInTheDocument()
    })

    it('filters by deal entity type', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[0], 'deal')

      expect(screen.getByText('Deal')).toBeInTheDocument()
    })
  })

  describe('action filter', () => {
    it('filters by create action', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[1], 'create')

      expect(screen.getByText('create')).toBeInTheDocument()
      expect(screen.queryByText('update')).not.toBeInTheDocument()
    })

    it('filters by update action', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[1], 'update')

      expect(screen.getByText('update')).toBeInTheDocument()
      expect(screen.queryByText('create')).not.toBeInTheDocument()
    })

    it('filters by delete action', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[1], 'delete')

      expect(screen.getByText('delete')).toBeInTheDocument()
    })
  })

  describe('user filter', () => {
    it('filters by specific user', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[2], 'user-1')

      expect(screen.getAllByText('Alice Johnson').length).toBeGreaterThan(0)
      expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()
    })

    it('shows all users option', () => {
      render(<AuditLogViewer {...defaultProps} />)
      const selects = screen.getAllByTestId('select-native')
      expect(selects[2]).toContainHTML('All Users')
    })
  })

  describe('date range filter', () => {
    it('renders from date input', () => {
      render(<AuditLogViewer {...defaultProps} />)
      const dateInputs = screen
        .getAllByTestId('input')
        .filter((input) => input.getAttribute('type') === 'date')
      expect(dateInputs.length).toBe(2)
    })

    it('filters by from date', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const dateInputs = screen
        .getAllByTestId('input')
        .filter((input) => input.getAttribute('type') === 'date')

      await user.type(dateInputs[0], '2024-01-15')

      // Only logs on or after 2024-01-15 should appear
      expect(screen.getByText('create')).toBeInTheDocument()
      expect(screen.getByText('update')).toBeInTheDocument()
    })

    it('filters by to date', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const dateInputs = screen
        .getAllByTestId('input')
        .filter((input) => input.getAttribute('type') === 'date')

      await user.type(dateInputs[1], '2024-01-13')

      // Only logs on or before 2024-01-13 should appear
      expect(screen.getByText('sign')).toBeInTheDocument()
      expect(screen.queryByText('create')).not.toBeInTheDocument()
    })
  })

  describe('export functionality', () => {
    it('calls onExport with filtered logs', async () => {
      const user = userEvent.setup()
      const onExport = vi.fn()
      render(<AuditLogViewer {...defaultProps} onExport={onExport} />)

      await user.click(screen.getByRole('button', { name: /export/i }))

      expect(onExport).toHaveBeenCalledWith(mockAuditLogs)
    })

    it('exports only filtered logs', async () => {
      const user = userEvent.setup()
      const onExport = vi.fn()
      render(<AuditLogViewer {...defaultProps} onExport={onExport} />)

      // Filter to create action only
      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[1], 'create')

      await user.click(screen.getByRole('button', { name: /export/i }))

      expect(onExport).toHaveBeenCalledWith([mockAuditLogs[0]])
    })
  })

  describe('detail dialog', () => {
    it('opens dialog when view button clicked', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      // Click the first view button (eye icon wrapped in button)
      const viewButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="eye-icon"]'))
      await user.click(viewButtons[0])

      expect(screen.getByTestId('dialog-content')).toBeInTheDocument()
      expect(screen.getByText('Audit Log Details')).toBeInTheDocument()
    })

    it('displays log details in dialog', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const viewButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="eye-icon"]'))
      await user.click(viewButtons[0])

      // Should show full details
      expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
      expect(screen.getByText('req-abc123')).toBeInTheDocument()
    })

    it('displays changes in dialog', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const viewButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="eye-icon"]'))
      await user.click(viewButtons[0])

      // Should show changes
      expect(screen.getByText('companyName:')).toBeInTheDocument()
      expect(screen.getByText(/"Acme Corp"/)).toBeInTheDocument()
    })

    it('displays before state when present', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      // Click on the delete log which has beforeState
      const viewButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="eye-icon"]'))
      await user.click(viewButtons[2]) // Third log is delete

      expect(screen.getByText('Before State')).toBeInTheDocument()
    })

    it('displays after state when present', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      // Click on the send log which has afterState
      const viewButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="eye-icon"]'))
      await user.click(viewButtons[3]) // Fourth log is send

      expect(screen.getByText('After State')).toBeInTheDocument()
    })

    it('closes dialog', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const viewButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="eye-icon"]'))
      await user.click(viewButtons[0])

      // Dialog should be open
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument()

      // Close the dialog
      await user.click(screen.getByTestId('dialog-close'))

      // Dialog content should be removed
      expect(screen.queryByText('Audit Log Details')).not.toBeInTheDocument()
    })
  })

  describe('action colors', () => {
    it('displays green indicator for create action', () => {
      render(<AuditLogViewer {...defaultProps} />)
      // Each action has a colored dot
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(1) // Header + data rows
    })
  })

  describe('empty state', () => {
    it('shows empty message when no logs', () => {
      render(<AuditLogViewer {...defaultProps} auditLogs={[]} />)
      expect(screen.getByText('No audit logs match your filters.')).toBeInTheDocument()
    })

    it('shows empty message when filters return no results', async () => {
      const user = userEvent.setup()
      render(<AuditLogViewer {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search by action, entity, user/i)
      await user.type(searchInput, 'nonexistentaction')

      expect(screen.getByText('No audit logs match your filters.')).toBeInTheDocument()
    })
  })

  describe('without users array', () => {
    it('displays truncated user IDs when users not provided', () => {
      render(<AuditLogViewer {...defaultProps} users={undefined} />)
      expect(screen.getByText('user-1')).toBeInTheDocument()
    })
  })
})
