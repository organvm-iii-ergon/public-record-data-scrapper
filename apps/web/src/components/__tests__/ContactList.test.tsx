import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ContactList } from '../contacts/ContactList'
import { Contact } from '@public-records/core'

vi.mock('@phosphor-icons/react', () => ({
  MagnifyingGlass: () => <span data-testid="magnifying-glass-icon">MagnifyingGlass</span>,
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  DotsThreeVertical: () => <span data-testid="dots-icon">DotsThreeVertical</span>,
  Phone: () => <span data-testid="phone-icon">Phone</span>,
  Envelope: () => <span data-testid="envelope-icon">Envelope</span>,
  User: () => <span data-testid="user-icon">User</span>,
  Buildings: () => <span data-testid="buildings-icon">Buildings</span>,
  CaretUp: () => <span data-testid="caret-up-icon">CaretUp</span>,
  CaretDown: () => <span data-testid="caret-down-icon">CaretDown</span>,
  Funnel: () => <span data-testid="funnel-icon">Funnel</span>,
  Export: () => <span data-testid="export-icon">Export</span>
}))

const mockContacts: Contact[] = [
  {
    id: 'contact-1',
    orgId: 'org-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-123-4567',
    title: 'CEO',
    role: 'ceo',
    preferredContactMethod: 'email',
    timezone: 'America/New_York',
    tags: ['vip', 'priority'],
    isActive: true,
    lastContactedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'contact-2',
    orgId: 'org-1',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '555-987-6543',
    title: 'CFO',
    role: 'cfo',
    preferredContactMethod: 'phone',
    timezone: 'America/Los_Angeles',
    tags: ['finance'],
    isActive: true,
    lastContactedAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'contact-3',
    orgId: 'org-1',
    firstName: 'Bob',
    lastName: 'Wilson',
    email: 'bob.wilson@example.com',
    phone: undefined,
    title: 'Manager',
    role: 'manager',
    preferredContactMethod: 'email',
    timezone: 'America/Chicago',
    tags: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

describe('ContactList', () => {
  const defaultProps = {
    contacts: mockContacts,
    onContactSelect: vi.fn(),
    onContactCreate: vi.fn(),
    onContactEdit: vi.fn(),
    onContactDelete: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the contacts title', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByText('Contacts')).toBeInTheDocument()
    })

    it('renders the contact count badge', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders the Add Contact button', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument()
    })

    it('renders search input', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByPlaceholderText('Search contacts...')).toBeInTheDocument()
    })

    it('renders all contacts', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
    })

    it('renders contact emails', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
      expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
    })

    it('renders contact phone numbers', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByText('555-123-4567')).toBeInTheDocument()
      expect(screen.getByText('555-987-6543')).toBeInTheDocument()
    })

    it('renders contact roles as badges', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByText('ceo')).toBeInTheDocument()
      expect(screen.getByText('cfo')).toBeInTheDocument()
      expect(screen.getByText('manager')).toBeInTheDocument()
    })

    it('renders empty state when no contacts', () => {
      render(<ContactList {...defaultProps} contacts={[]} />)

      expect(
        screen.getByText('No contacts yet. Add your first contact to get started.')
      ).toBeInTheDocument()
    })

    it('renders last contacted time', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByText('Today')).toBeInTheDocument()
      expect(screen.getByText('Yesterday')).toBeInTheDocument()
      expect(screen.getByText('Never')).toBeInTheDocument()
    })
  })

  describe('search functionality', () => {
    it('filters contacts by first name', () => {
      render(<ContactList {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search contacts...')
      fireEvent.change(searchInput, { target: { value: 'John' } })

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
      expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument()
    })

    it('filters contacts by last name', () => {
      render(<ContactList {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search contacts...')
      fireEvent.change(searchInput, { target: { value: 'Smith' } })

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.queryByText('Bob Wilson')).not.toBeInTheDocument()
    })

    it('filters contacts by email', () => {
      render(<ContactList {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search contacts...')
      fireEvent.change(searchInput, { target: { value: 'bob.wilson' } })

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
    })

    it('filters contacts by phone number', () => {
      render(<ContactList {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search contacts...')
      fireEvent.change(searchInput, { target: { value: '555-123' } })

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
    })

    it('shows no results message when search matches nothing', () => {
      render(<ContactList {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search contacts...')
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

      expect(screen.getByText('No contacts match your search criteria.')).toBeInTheDocument()
    })

    it('is case insensitive', () => {
      render(<ContactList {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search contacts...')
      fireEvent.change(searchInput, { target: { value: 'JOHN' } })

      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
  })

  describe('callback handlers', () => {
    it('calls onContactCreate when Add Contact button is clicked', () => {
      render(<ContactList {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /add contact/i }))

      expect(defaultProps.onContactCreate).toHaveBeenCalledTimes(1)
    })

    it('calls onContactSelect when a contact row is clicked', () => {
      render(<ContactList {...defaultProps} />)

      fireEvent.click(screen.getByText('John Doe'))

      expect(defaultProps.onContactSelect).toHaveBeenCalledWith(mockContacts[0])
    })
  })

  describe('selection functionality', () => {
    it('renders checkboxes for each contact', () => {
      render(<ContactList {...defaultProps} />)

      const checkboxes = screen.getAllByRole('checkbox')
      // Header checkbox + 3 contact checkboxes
      expect(checkboxes).toHaveLength(4)
    })

    it('renders export button when contacts are selected', () => {
      render(<ContactList {...defaultProps} onBatchExport={vi.fn()} />)

      // Click checkbox for first contact
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1]) // First contact checkbox (index 0 is header)

      expect(screen.getByRole('button', { name: /export \(1\)/i })).toBeInTheDocument()
    })

    it('calls onBatchExport with selected contact IDs', () => {
      const onBatchExport = vi.fn()
      render(<ContactList {...defaultProps} onBatchExport={onBatchExport} />)

      // Select first two contacts
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])
      fireEvent.click(checkboxes[2])

      fireEvent.click(screen.getByRole('button', { name: /export \(2\)/i }))

      expect(onBatchExport).toHaveBeenCalledWith(['contact-1', 'contact-2'])
    })

    it('selects all contacts when header checkbox is clicked', () => {
      const onBatchExport = vi.fn()
      render(<ContactList {...defaultProps} onBatchExport={onBatchExport} />)

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0]) // Header checkbox

      expect(screen.getByRole('button', { name: /export \(3\)/i })).toBeInTheDocument()
    })
  })

  describe('sorting', () => {
    it('renders sortable column headers', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Title/Company')).toBeInTheDocument()
      expect(screen.getByText('Last Contacted')).toBeInTheDocument()
    })

    it('changes sort direction when clicking the same column', () => {
      render(<ContactList {...defaultProps} />)

      const nameHeader = screen.getByText('Name')

      // First click - ascending
      fireEvent.click(nameHeader)
      expect(screen.getByTestId('caret-up-icon')).toBeInTheDocument()

      // Second click - descending
      fireEvent.click(nameHeader)
      expect(screen.getByTestId('caret-down-icon')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible table structure', () => {
      render(<ContactList {...defaultProps} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('columnheader')).toHaveLength(7)
      expect(screen.getAllByRole('row')).toHaveLength(4) // Header + 3 contacts
    })

    it('has accessible search input', () => {
      render(<ContactList {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search contacts...')
      expect(searchInput).toHaveAttribute('type', 'text')
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      const { container } = render(<ContactList {...defaultProps} className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })
})
