/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { PartnerPortal } from '../PartnerPortal'
import type { PartnerMetrics } from '@public-records/core'

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
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardDescription: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="card-desc" className={className}>
      {children}
    </div>
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
    type,
    disabled,
    className
  }: {
    children: ReactNode
    onClick?: () => void
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    className?: string
  }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  )
}))

vi.mock('@public-records/ui/badge', () => ({
  Badge: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  )
}))

vi.mock('@public-records/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className} />
  )
}))

vi.mock('@public-records/ui/input', () => ({
  Input: (props: any) => <input data-testid="input" {...props} />
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/lib/api/partner', () => ({
  fetchPartnerPortal: vi.fn(),
  updatePartnerCode: vi.fn(),
  updatePayoutEmail: vi.fn()
}))

import { fetchPartnerPortal, updatePartnerCode, updatePayoutEmail } from '@/lib/api/partner'
import { toast } from 'sonner'

const mockFetchPartnerPortal = vi.mocked(fetchPartnerPortal)
const mockUpdatePartnerCode = vi.mocked(updatePartnerCode)
const mockUpdatePayoutEmail = vi.mocked(updatePayoutEmail)

const sampleMetrics: PartnerMetrics = {
  program: {
    id: 'prog-1',
    orgId: 'org-1',
    partnerCode: 'TEST-AFFILIATE',
    referralUrl: 'https://app.test.com/?ref=TEST-AFFILIATE',
    commissionRate: 20,
    tier: 'silver',
    payoutEmail: 'pay@affiliate.com',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  totalClicks: 150,
  totalSignups: 25,
  totalConversions: 8,
  conversionRate: 5.3,
  totalEarningsUsd: 800.0,
  pendingEarningsUsd: 300.0,
  paidEarningsUsd: 500.0,
  partnerTier: 'silver',
  commissionRate: 20,
  nextTierThreshold: 20,
  conversionsToNextTier: 12,
  recentEvents: [
    {
      id: 'evt-1',
      programId: 'prog-1',
      eventType: 'conversion',
      referredEmail: 'buyer@client.com',
      referredOrgId: null,
      revenueAmount: 500.0,
      commissionAmount: 100.0,
      createdAt: '2026-01-10T12:00:00Z'
    },
    {
      id: 'evt-2',
      programId: 'prog-1',
      eventType: 'click',
      revenueAmount: 0,
      commissionAmount: 0,
      metadata: { referrer: 'https://twitter.com' },
      createdAt: '2026-01-10T10:00:00Z'
    }
  ]
}

describe('PartnerPortal Component', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    writeTextMock.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock
      },
      writable: true,
      configurable: true
    })
  })

  it('renders initial metrics correctly', () => {
    render(<PartnerPortal initialMetrics={sampleMetrics} />)

    expect(screen.getByText('Referral & Partner Program')).toBeInTheDocument()
    expect(screen.getByText(/silver Tier/i)).toBeInTheDocument()
    expect(screen.getByText(/Earn 20% recurring commission/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://app.test.com/?ref=TEST-AFFILIATE')).toBeInTheDocument()

    // Metric cards
    expect(screen.getByText('150')).toBeInTheDocument() // Clicks
    expect(screen.getByText('25')).toBeInTheDocument() // Signups
    expect(screen.getByText('8')).toBeInTheDocument() // Conversions
    expect(screen.getByText('5.3%')).toBeInTheDocument() // Conv Rate
    expect(screen.getByText('$800.00')).toBeInTheDocument() // Total Earned
    expect(screen.getByText('$300.00')).toBeInTheDocument() // Pending

    // Table events
    expect(screen.getByText('buyer@client.com')).toBeInTheDocument()
    expect(screen.getByText('+$100.00')).toBeInTheDocument()
    expect(screen.getByText('https://twitter.com')).toBeInTheDocument()
  })

  it('copies referral link to clipboard when clicked', async () => {
    render(<PartnerPortal initialMetrics={sampleMetrics} />)

    const copyBtn = screen.getByRole('button', { name: /copy/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('https://app.test.com/?ref=TEST-AFFILIATE')
    })
    expect(toast.success).toHaveBeenCalledWith('Referral link copied to clipboard!')
  })

  it('updates custom partner code when submitted', async () => {
    const user = userEvent.setup()
    mockUpdatePartnerCode.mockResolvedValueOnce({
      success: true,
      program: {
        ...sampleMetrics.program,
        partnerCode: 'NEW-PROMO-CODE',
        referralUrl: 'https://app.test.com/?ref=NEW-PROMO-CODE'
      }
    })

    render(<PartnerPortal initialMetrics={sampleMetrics} />)

    const codeInput = screen.getByLabelText('Custom Partner Code')
    await user.clear(codeInput)
    await user.type(codeInput, 'NEW-PROMO-CODE')

    const updateBtn = screen.getByRole('button', { name: /update/i })
    await user.click(updateBtn)

    expect(mockUpdatePartnerCode).toHaveBeenCalledWith('NEW-PROMO-CODE')
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Referral code updated to NEW-PROMO-CODE')
    })
  })

  it('updates affiliate payout email when submitted', async () => {
    const user = userEvent.setup()
    mockUpdatePayoutEmail.mockResolvedValueOnce({
      success: true,
      program: {
        ...sampleMetrics.program,
        payoutEmail: 'new-pay@affiliate.com'
      }
    })

    render(<PartnerPortal initialMetrics={sampleMetrics} />)

    const emailInput = screen.getByLabelText('Affiliate Payout Email')
    await user.clear(emailInput)
    await user.type(emailInput, 'new-pay@affiliate.com')

    const saveEmailBtn = screen.getByRole('button', { name: /save email/i })
    await user.click(saveEmailBtn)

    expect(mockUpdatePayoutEmail).toHaveBeenCalledWith('new-pay@affiliate.com')
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Payout destination email updated')
    })
  })

  it('loads data on mount when initialMetrics is not passed', async () => {
    mockFetchPartnerPortal.mockResolvedValueOnce(sampleMetrics)

    render(<PartnerPortal />)

    expect(screen.getByText(/loading partner program/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByDisplayValue('TEST-AFFILIATE')).toBeInTheDocument()
    })
    expect(mockFetchPartnerPortal).toHaveBeenCalledTimes(1)
  })
})
