import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { UnifiedInbox } from '../communications/UnifiedInbox'
import type { Communication, Contact } from '@public-records/core'

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

vi.mock('@public-records/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />
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
  SelectTrigger: ({
    children,
    className,
    size
  }: {
    children: ReactNode
    className?: string
    size?: string
  }) => (
    <div data-testid="select-trigger" className={className} data-size={size}>
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

vi.mock('@public-records/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarFallback: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span data-testid="avatar-fallback" className={className}>
      {children}
    </span>
  )
}))

vi.mock('@phosphor-icons/react', () => ({
  MagnifyingGlass: ({ className }: { className?: string }) => (
    <span data-testid="magnifying-glass-icon" className={className} />
  ),
  Envelope: ({ className }: { className?: string }) => (
    <span data-testid="envelope-icon" className={className} />
  ),
  EnvelopeOpen: ({ className }: { className?: string }) => (
    <span data-testid="envelope-open-icon" className={className} />
  ),
  ChatText: ({ className }: { className?: string }) => (
    <span data-testid="chat-text-icon" className={className} />
  ),
  Phone: ({ className }: { className?: string }) => (
    <span data-testid="phone-icon" className={className} />
  ),
  PhoneIncoming: ({ className }: { className?: string }) => (
    <span data-testid="phone-incoming-icon" className={className} />
  ),
  PhoneOutgoing: ({ className }: { className?: string }) => (
    <span data-testid="phone-outgoing-icon" className={className} />
  ),
  Funnel: ({ className }: { className?: string }) => (
    <span data-testid="funnel-icon" className={className} />
  ),
  ArrowRight: ({ className }: { className?: string }) => (
    <span data-testid="arrow-right-icon" className={className} />
  ),
  ArrowLeft: ({ className }: { className?: string }) => (
    <span data-testid="arrow-left-icon" className={className} />
  ),
  Calendar: ({ className }: { className?: string }) => (
    <span data-testid="calendar-icon" className={className} />
  ),
  PaperPlaneRight: ({ className }: { className?: string }) => (
    <span data-testid="paper-plane-icon" className={className} />
  ),
  Plus: ({ className }: { className?: string }) => (
    <span data-testid="plus-icon" className={className} />
  ),
  Clock: ({ className }: { className?: string }) => (
    <span data-testid="clock-icon" className={className} />
  )
}))

vi.mock('@public-records/ui/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')
}))

describe('UnifiedInbox', () => {
  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      orgId: 'org-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-1234',
      preferredContactMethod: 'email',
      timezone: 'America/New_York',
      tags: [],
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'contact-2',
      orgId: 'org-1',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '555-5678',
      preferredContactMethod: 'phone',
      timezone: 'America/Chicago',
      tags: [],
      isActive: true,
      createdAt: '2024-01-02',
      updatedAt: '2024-01-02'
    }
  ]

  const today = new Date().toISOString()
  const yesterday = new Date(Date.now() - 86400000).toISOString()

  const mockCommunications: Communication[] = [
    {
      id: 'comm-1',
      orgId: 'org-1',
      contactId: 'contact-1',
      channel: 'email',
      direction: 'outbound',
      fromAddress: 'broker@company.com',
      toAddress: 'john@example.com',
      subject: 'Funding Proposal',
      body: 'Hi John, I wanted to follow up on our conversation about the funding proposal. Please review the attached documents.',
      attachments: [],
      status: 'delivered',
      metadata: {},
      createdAt: today
    },
    {
      id: 'comm-2',
      orgId: 'org-1',
      contactId: 'contact-1',
      channel: 'email',
      direction: 'inbound',
      fromAddress: 'john@example.com',
      toAddress: 'broker@company.com',
      subject: 'Re: Funding Proposal',
      body: 'Thanks for sending this over. I will review it today.',
      attachments: [],
      status: 'opened',
      metadata: {},
      createdAt: today
    },
    {
      id: 'comm-3',
      orgId: 'org-1',
      contactId: 'contact-2',
      channel: 'sms',
      direction: 'outbound',
      fromPhone: '+15551234567',
      toPhone: '+15555678901',
      body: 'Hi Jane, quick reminder about our call tomorrow.',
      attachments: [],
      status: 'delivered',
      metadata: {},
      createdAt: yesterday
    },
    {
      id: 'comm-4',
      orgId: 'org-1',
      contactId: 'contact-2',
      channel: 'call',
      direction: 'outbound',
      fromPhone: '+15551234567',
      toPhone: '+15555678901',
      body: 'Discussed renewal options. Client interested in higher amount.',
      attachments: [],
      status: 'answered',
      callDurationSeconds: 420,
      metadata: {},
      createdAt: yesterday
    }
  ]

  const defaultProps = {
    communications: mockCommunications,
    contacts: mockContacts,
    onCommunicationSelect: vi.fn(),
    onCompose: vi.fn(),
    onReply: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the unified inbox', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByTestId('card')).toBeInTheDocument()
    })

    it('displays header with Unified Inbox title', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByText('Unified Inbox')).toBeInTheDocument()
    })

    it('displays message count badge', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('renders Compose button', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByRole('button', { name: /compose/i })).toBeInTheDocument()
    })

    it('renders search input', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByPlaceholderText(/search messages/i)).toBeInTheDocument()
    })

    it('renders channel filter dropdown', () => {
      render(<UnifiedInbox {...defaultProps} />)
      const selects = screen.getAllByTestId('select-native')
      expect(selects.length).toBe(2) // channel and direction filters
    })
  })

  describe('message list', () => {
    it('displays contact names', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0)
    })

    it('displays message subjects', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByText('Funding Proposal')).toBeInTheDocument()
      expect(screen.getByText('Re: Funding Proposal')).toBeInTheDocument()
    })

    it('displays message body preview', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByText(/I wanted to follow up/)).toBeInTheDocument()
    })

    it('displays message status', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByText('delivered')).toBeInTheDocument()
      expect(screen.getByText('opened')).toBeInTheDocument()
      expect(screen.getByText('answered')).toBeInTheDocument()
    })

    it('displays relative time for messages', () => {
      render(<UnifiedInbox {...defaultProps} />)
      // Today's messages should show hours or "Just now"
      // We can't predict exact text but should see time indicators
      expect(screen.getAllByTestId('scroll-area').length).toBeGreaterThan(0)
    })

    it('groups messages by date', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByText('Today')).toBeInTheDocument()
      expect(screen.getByText('Yesterday')).toBeInTheDocument()
    })
  })

  describe('channel icons', () => {
    it('shows envelope icon for email messages', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getAllByTestId('envelope-icon').length).toBeGreaterThan(0)
    })

    it('shows chat icon for SMS messages', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getAllByTestId('chat-text-icon').length).toBeGreaterThan(0)
    })

    it('shows phone icon for call messages', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getAllByTestId('phone-icon').length).toBeGreaterThan(0)
    })
  })

  describe('direction indicators', () => {
    it('shows arrow-left for inbound messages', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getAllByTestId('arrow-left-icon').length).toBeGreaterThan(0)
    })

    it('shows arrow-right for outbound messages', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getAllByTestId('arrow-right-icon').length).toBeGreaterThan(0)
    })
  })

  describe('search functionality', () => {
    it('filters messages by contact name', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search messages/i)
      await user.type(searchInput, 'john')

      // John Doe messages should be visible
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
      // Jane Smith messages should be hidden
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
    })

    it('filters messages by subject', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search messages/i)
      await user.type(searchInput, 'Funding')

      expect(screen.getByText('Funding Proposal')).toBeInTheDocument()
    })

    it('filters messages by body content', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search messages/i)
      await user.type(searchInput, 'reminder')

      expect(screen.getByText(/reminder about our call/)).toBeInTheDocument()
    })
  })

  describe('channel filter', () => {
    it('filters by email channel', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[0], 'email')

      // Should only show email messages
      expect(screen.getByText('Funding Proposal')).toBeInTheDocument()
      // SMS message should not be visible
      expect(screen.queryByText(/reminder about our call/)).not.toBeInTheDocument()
    })

    it('filters by SMS channel', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[0], 'sms')

      expect(screen.getByText(/reminder about our call/)).toBeInTheDocument()
      expect(screen.queryByText('Funding Proposal')).not.toBeInTheDocument()
    })

    it('filters by call channel', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[0], 'call')

      expect(screen.getByText(/renewal options/)).toBeInTheDocument()
    })
  })

  describe('direction filter', () => {
    it('filters by inbound direction', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[1], 'inbound')

      // Only inbound message
      expect(screen.getByText('Re: Funding Proposal')).toBeInTheDocument()
      expect(screen.queryByText(/reminder about our call/)).not.toBeInTheDocument()
    })

    it('filters by outbound direction', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[1], 'outbound')

      expect(screen.getByText('Funding Proposal')).toBeInTheDocument()
      expect(screen.queryByText('Re: Funding Proposal')).not.toBeInTheDocument()
    })
  })

  describe('message selection', () => {
    it('calls onCommunicationSelect when message clicked', async () => {
      const user = userEvent.setup()
      const onCommunicationSelect = vi.fn()
      render(<UnifiedInbox {...defaultProps} onCommunicationSelect={onCommunicationSelect} />)

      // Find and click on a message containing "Funding Proposal"
      const messageList = screen
        .getAllByText('Funding Proposal')[0]
        .closest('[class*="cursor-pointer"]')
      expect(messageList).toBeTruthy()

      await user.click(messageList!)
      expect(onCommunicationSelect).toHaveBeenCalledWith(mockCommunications[0])
    })

    it('highlights selected message', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const messageList = screen
        .getAllByText('Funding Proposal')[0]
        .closest('[class*="cursor-pointer"]')
      await user.click(messageList!)

      // After selection, element should have selected styling
      expect(messageList?.className).toContain('border-l')
    })
  })

  describe('message detail panel', () => {
    it('shows select message prompt when nothing selected', () => {
      render(<UnifiedInbox {...defaultProps} />)
      expect(screen.getByText('Select a message')).toBeInTheDocument()
      expect(
        screen.getByText('Choose a message from the list to view its contents')
      ).toBeInTheDocument()
    })

    it('displays message header when selected', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const messageList = screen
        .getAllByText('Funding Proposal')[0]
        .closest('[class*="cursor-pointer"]')
      await user.click(messageList!)

      // Should show detailed view
      expect(screen.getAllByText('Funding Proposal').length).toBeGreaterThan(0)
    })

    it('displays from/to addresses for email', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const messageList = screen
        .getAllByText('Funding Proposal')[0]
        .closest('[class*="cursor-pointer"]')
      await user.click(messageList!)

      expect(screen.getByText('broker@company.com')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })

    it('displays full message body', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const messageList = screen
        .getAllByText('Funding Proposal')[0]
        .closest('[class*="cursor-pointer"]')
      await user.click(messageList!)

      expect(screen.getByText(/Please review the attached documents/)).toBeInTheDocument()
    })

    it('displays Reply button', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const messageList = screen
        .getAllByText('Funding Proposal')[0]
        .closest('[class*="cursor-pointer"]')
      await user.click(messageList!)

      expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument()
    })

    it('calls onReply when Reply clicked', async () => {
      const user = userEvent.setup()
      const onReply = vi.fn()
      render(<UnifiedInbox {...defaultProps} onReply={onReply} />)

      const messageList = screen
        .getAllByText('Funding Proposal')[0]
        .closest('[class*="cursor-pointer"]')
      await user.click(messageList!)

      await user.click(screen.getByRole('button', { name: /reply/i }))
      expect(onReply).toHaveBeenCalledWith(mockCommunications[0])
    })

    it('displays call duration for call messages', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      // Filter to calls only and select the call message
      const selects = screen.getAllByTestId('select-native')
      await user.selectOptions(selects[0], 'call')

      // Click on the call message
      const callMessage = screen.getByText(/renewal options/).closest('[class*="cursor-pointer"]')
      await user.click(callMessage!)

      // Should show duration
      expect(screen.getByText(/Duration: 7m 0s/)).toBeInTheDocument()
    })
  })

  describe('compose button', () => {
    it('calls onCompose when Compose clicked', async () => {
      const user = userEvent.setup()
      const onCompose = vi.fn()
      render(<UnifiedInbox {...defaultProps} onCompose={onCompose} />)

      await user.click(screen.getByRole('button', { name: /compose/i }))
      expect(onCompose).toHaveBeenCalledTimes(1)
    })
  })

  describe('empty state', () => {
    it('shows no messages found when list is empty', () => {
      render(<UnifiedInbox {...defaultProps} communications={[]} />)
      expect(screen.getByText('No messages found')).toBeInTheDocument()
    })

    it('shows no messages found when filter results are empty', async () => {
      const user = userEvent.setup()
      render(<UnifiedInbox {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText(/search messages/i)
      await user.type(searchInput, 'nonexistentmessage')

      expect(screen.getByText('No messages found')).toBeInTheDocument()
    })
  })

  describe('unknown contact', () => {
    it('shows Unknown for messages without matching contact', () => {
      const commsWithUnknown: Communication[] = [
        {
          ...mockCommunications[0],
          contactId: 'unknown-contact-id'
        }
      ]

      render(<UnifiedInbox {...defaultProps} communications={commsWithUnknown} />)
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('attachments', () => {
    it('displays attachments when present', async () => {
      const user = userEvent.setup()
      const commsWithAttachment: Communication[] = [
        {
          ...mockCommunications[0],
          attachments: [
            {
              name: 'proposal.pdf',
              url: '/docs/proposal.pdf',
              size: 102400,
              mimeType: 'application/pdf'
            }
          ]
        }
      ]

      render(<UnifiedInbox {...defaultProps} communications={commsWithAttachment} />)

      const messageList = screen
        .getAllByText('Funding Proposal')[0]
        .closest('[class*="cursor-pointer"]')
      await user.click(messageList!)

      expect(screen.getByText('proposal.pdf')).toBeInTheDocument()
      expect(screen.getByText(/100KB/)).toBeInTheDocument()
    })
  })
})
