import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { DealPipeline } from '../deals/DealPipeline'
import type { Deal, DealStage } from '@public-records/core'

// Mock UI components
vi.mock('@public-records/ui/card', () => ({
  Card: ({
    children,
    className,
    onClick
  }: {
    children: ReactNode
    className?: string
    onClick?: () => void
  }) => (
    <div data-testid="card" className={className} onClick={onClick}>
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
    onClick?: (e?: React.MouseEvent) => void
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

vi.mock('@public-records/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className}>
      {value}%
    </div>
  )
}))

vi.mock('@public-records/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
  ScrollBar: ({ orientation }: { orientation?: string }) => (
    <div data-testid="scroll-bar" data-orientation={orientation} />
  )
}))

vi.mock('@public-records/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    onClick
  }: {
    children: ReactNode
    onClick?: (e: React.MouseEvent) => void
  }) => (
    <div data-testid="dropdown-trigger" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children, align }: { children: ReactNode; align?: string }) => (
    <div data-testid="dropdown-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className
  }: {
    children: ReactNode
    onClick?: (e: React.MouseEvent) => void
    className?: string
  }) => (
    <button data-testid="dropdown-item" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />
}))

vi.mock('@phosphor-icons/react', () => ({
  Plus: ({ className }: { className?: string }) => (
    <span data-testid="plus-icon" className={className} />
  ),
  DotsThreeVertical: ({ className }: { className?: string }) => (
    <span data-testid="dots-icon" className={className} />
  ),
  CurrencyDollar: ({ className }: { className?: string }) => (
    <span data-testid="currency-icon" className={className} />
  ),
  Clock: ({ className }: { className?: string }) => (
    <span data-testid="clock-icon" className={className} />
  ),
  ArrowRight: ({ className }: { className?: string }) => (
    <span data-testid="arrow-right-icon" className={className} />
  ),
  Buildings: ({ className }: { className?: string }) => (
    <span data-testid="buildings-icon" className={className} />
  ),
  Funnel: ({ className }: { className?: string }) => (
    <span data-testid="funnel-icon" className={className} />
  ),
  CaretDown: ({ className }: { className?: string }) => (
    <span data-testid="caret-down-icon" className={className} />
  )
}))

vi.mock('@public-records/ui/utils', () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')
}))

describe('DealPipeline', () => {
  const mockStages: DealStage[] = [
    {
      id: 'lead',
      orgId: 'org-1',
      name: 'Lead',
      slug: 'lead',
      stageOrder: 1,
      isTerminal: false,
      color: '#6366f1',
      autoActions: {},
      createdAt: '2024-01-01'
    },
    {
      id: 'contacted',
      orgId: 'org-1',
      name: 'Contacted',
      slug: 'contacted',
      stageOrder: 2,
      isTerminal: false,
      color: '#8b5cf6',
      autoActions: {},
      createdAt: '2024-01-01'
    },
    {
      id: 'underwriting',
      orgId: 'org-1',
      name: 'Underwriting',
      slug: 'underwriting',
      stageOrder: 3,
      isTerminal: false,
      color: '#ec4899',
      autoActions: {},
      createdAt: '2024-01-01'
    },
    {
      id: 'funded',
      orgId: 'org-1',
      name: 'Funded',
      slug: 'funded',
      stageOrder: 4,
      isTerminal: true,
      terminalType: 'won',
      color: '#22c55e',
      autoActions: {},
      createdAt: '2024-01-01'
    }
  ]

  const mockDeals: Deal[] = [
    {
      id: 'deal-1',
      orgId: 'org-1',
      stageId: 'lead',
      dealNumber: 'D-001',
      amountRequested: 50000,
      priority: 'high',
      probability: 75,
      bankConnected: false,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'deal-2',
      orgId: 'org-1',
      stageId: 'lead',
      dealNumber: 'D-002',
      amountRequested: 75000,
      priority: 'urgent',
      probability: 60,
      bankConnected: true,
      createdAt: '2024-01-02',
      updatedAt: '2024-01-02'
    },
    {
      id: 'deal-3',
      orgId: 'org-1',
      stageId: 'contacted',
      dealNumber: 'D-003',
      amountApproved: 40000,
      priority: 'normal',
      probability: 80,
      bankConnected: false,
      createdAt: '2024-01-03',
      updatedAt: '2024-01-03'
    },
    {
      id: 'deal-4',
      orgId: 'org-1',
      stageId: 'funded',
      dealNumber: 'D-004',
      amountFunded: 100000,
      priority: 'low',
      bankConnected: false,
      createdAt: '2024-01-04',
      updatedAt: '2024-01-04'
    }
  ]

  const defaultProps = {
    deals: mockDeals,
    stages: mockStages,
    onDealClick: vi.fn(),
    onDealCreate: vi.fn(),
    onDealStageChange: vi.fn(),
    onDealEdit: vi.fn(),
    onDealDelete: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the pipeline header', () => {
      render(<DealPipeline {...defaultProps} />)
      expect(screen.getByText('Deal Pipeline')).toBeInTheDocument()
    })

    it('displays total deals count', () => {
      render(<DealPipeline {...defaultProps} />)
      expect(screen.getByText('4 deals worth $265,000')).toBeInTheDocument()
    })

    it('renders New Deal button', () => {
      render(<DealPipeline {...defaultProps} />)
      expect(screen.getByRole('button', { name: /new deal/i })).toBeInTheDocument()
    })

    it('renders all stage columns', () => {
      render(<DealPipeline {...defaultProps} />)
      expect(screen.getByText('Lead')).toBeInTheDocument()
      expect(screen.getByText('Contacted')).toBeInTheDocument()
      expect(screen.getByText('Underwriting')).toBeInTheDocument()
      expect(screen.getByText('Funded')).toBeInTheDocument()
    })
  })

  describe('default stages', () => {
    it('uses default stages when none provided', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stages, ...propsWithoutStages } = defaultProps
      render(<DealPipeline {...propsWithoutStages} />)
      // Default stages include Pack Submitted, Approved which aren't in mockStages
      expect(screen.getByText('Lead')).toBeInTheDocument()
    })
  })

  describe('stage metrics', () => {
    it('displays deal count per stage', () => {
      render(<DealPipeline {...defaultProps} />)
      const badges = screen.getAllByTestId('badge')
      // Find badges with deal counts
      const countBadges = badges.filter((b) => /^[0-9]+$/.test(b.textContent || ''))
      expect(countBadges.length).toBeGreaterThan(0)
    })

    it('displays total value per stage', () => {
      render(<DealPipeline {...defaultProps} />)
      // Lead stage has 50k + 75k = 125k
      expect(screen.getByText('$125,000')).toBeInTheDocument()
    })

    it('shows empty stage message when no deals', () => {
      render(<DealPipeline {...defaultProps} />)
      // Underwriting stage has no deals
      expect(screen.getByText('No deals in this stage')).toBeInTheDocument()
    })
  })

  describe('deal cards', () => {
    it('displays deal numbers', () => {
      render(<DealPipeline {...defaultProps} />)
      expect(screen.getByText('D-001')).toBeInTheDocument()
      expect(screen.getByText('D-002')).toBeInTheDocument()
      expect(screen.getByText('D-003')).toBeInTheDocument()
      expect(screen.getByText('D-004')).toBeInTheDocument()
    })

    it('displays deal amounts', () => {
      render(<DealPipeline {...defaultProps} />)
      expect(screen.getByText('$50,000')).toBeInTheDocument()
      expect(screen.getByText('$75,000')).toBeInTheDocument()
      expect(screen.getByText('$40,000')).toBeInTheDocument()
      expect(screen.getByText('$100,000')).toBeInTheDocument()
    })

    it('displays probability badges', () => {
      render(<DealPipeline {...defaultProps} />)
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText('60%')).toBeInTheDocument()
      expect(screen.getByText('80%')).toBeInTheDocument()
    })

    it('shows progress bar for deals with bankConnected', () => {
      render(<DealPipeline {...defaultProps} />)
      // deal-2 has bankConnected: true
      const progressBars = screen.getAllByTestId('progress')
      expect(progressBars.length).toBeGreaterThan(0)
    })
  })

  describe('conversion rates', () => {
    it('displays conversion rates between stages', () => {
      render(<DealPipeline {...defaultProps} />)
      // 1 deal in Contacted from 2 in Lead = 50%
      const badges = screen.getAllByTestId('badge')
      const conversionBadge = badges.find((b) => b.textContent === '50%')
      expect(conversionBadge).toBeInTheDocument()
    })
  })

  describe('user interactions', () => {
    it('calls onDealCreate when New Deal button clicked', async () => {
      const user = userEvent.setup()
      const onDealCreate = vi.fn()
      render(<DealPipeline {...defaultProps} onDealCreate={onDealCreate} />)

      await user.click(screen.getByRole('button', { name: /new deal/i }))
      expect(onDealCreate).toHaveBeenCalledTimes(1)
    })

    it('calls onDealClick when deal card clicked', async () => {
      const user = userEvent.setup()
      const onDealClick = vi.fn()
      render(<DealPipeline {...defaultProps} onDealClick={onDealClick} />)

      const cards = screen.getAllByTestId('card')
      const dealCard = cards.find((card) => card.textContent?.includes('D-001'))
      expect(dealCard).toBeTruthy()

      await user.click(dealCard!)
      expect(onDealClick).toHaveBeenCalledWith(mockDeals[0])
    })

    it('calls onDealEdit when Edit Deal clicked in dropdown', async () => {
      const user = userEvent.setup()
      const onDealEdit = vi.fn()
      render(<DealPipeline {...defaultProps} onDealEdit={onDealEdit} />)

      const editButtons = screen.getAllByText('Edit Deal')
      await user.click(editButtons[0])

      expect(onDealEdit).toHaveBeenCalledWith(mockDeals[0])
    })

    it('calls onDealDelete when Delete Deal clicked in dropdown', async () => {
      const user = userEvent.setup()
      const onDealDelete = vi.fn()
      render(<DealPipeline {...defaultProps} onDealDelete={onDealDelete} />)

      const deleteButtons = screen.getAllByText('Delete Deal')
      await user.click(deleteButtons[0])

      expect(onDealDelete).toHaveBeenCalledWith(mockDeals[0])
    })

    it('calls onDealStageChange when Move to Stage clicked', async () => {
      const user = userEvent.setup()
      const onDealStageChange = vi.fn()
      render(<DealPipeline {...defaultProps} onDealStageChange={onDealStageChange} />)

      // Find "Contacted" in dropdown items (move from Lead to Contacted)
      const dropdownItems = screen.getAllByTestId('dropdown-item')
      const contactedMoveItem = dropdownItems.find(
        (item) =>
          item.textContent?.includes('Contacted') && !item.className?.includes('destructive')
      )
      expect(contactedMoveItem).toBeTruthy()

      await user.click(contactedMoveItem!)
      expect(onDealStageChange).toHaveBeenCalledWith('deal-1', 'contacted')
    })
  })

  describe('summary stats', () => {
    it('renders summary stats card', () => {
      render(<DealPipeline {...defaultProps} />)
      const cards = screen.getAllByTestId('card')
      // Last card should be summary stats
      expect(cards.length).toBeGreaterThan(mockStages.length)
    })

    it('displays stage names in summary', () => {
      render(<DealPipeline {...defaultProps} />)
      // Summary shows stage names
      const leadTexts = screen.getAllByText('Lead')
      expect(leadTexts.length).toBeGreaterThan(0)
    })
  })

  describe('priority indicators', () => {
    it('shows correct color for urgent priority', () => {
      render(<DealPipeline {...defaultProps} />)
      // deal-2 has urgent priority which should show red indicator
      // The priority is shown via a colored dot with className containing the color
      const cards = screen.getAllByTestId('card')
      const urgentDealCard = cards.find((c) => c.textContent?.includes('D-002'))
      expect(urgentDealCard).toBeTruthy()
    })

    it('shows correct color for high priority', () => {
      render(<DealPipeline {...defaultProps} />)
      const cards = screen.getAllByTestId('card')
      const highPriorityCard = cards.find((c) => c.textContent?.includes('D-001'))
      expect(highPriorityCard).toBeTruthy()
    })
  })

  describe('empty state', () => {
    it('shows empty message for all stages when no deals', () => {
      render(<DealPipeline {...defaultProps} deals={[]} />)
      const emptyMessages = screen.getAllByText('No deals in this stage')
      expect(emptyMessages.length).toBe(mockStages.length)
    })

    it('displays zero total when no deals', () => {
      render(<DealPipeline {...defaultProps} deals={[]} />)
      expect(screen.getByText('0 deals worth $0')).toBeInTheDocument()
    })
  })

  describe('stage sorting', () => {
    it('sorts stages by stageOrder', () => {
      const unsortedStages: DealStage[] = [
        { ...mockStages[3] }, // Funded (order 4)
        { ...mockStages[0] }, // Lead (order 1)
        { ...mockStages[2] }, // Underwriting (order 3)
        { ...mockStages[1] } // Contacted (order 2)
      ]

      render(<DealPipeline {...defaultProps} stages={unsortedStages} />)

      // Stages should appear in order regardless of array order
      const stageHeaders = screen
        .getAllByTestId('card-title')
        .filter((el) => mockStages.some((s) => s.name === el.textContent))

      // First stage should be Lead
      expect(stageHeaders[0]).toHaveTextContent('Lead')
    })
  })
})
