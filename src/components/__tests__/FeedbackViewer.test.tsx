import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { FeedbackViewer } from '../FeedbackViewer'

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    ...props
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
    variant?: string
    size?: string
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogTrigger: ({ children }: { children: ReactNode }) => (
    <span data-testid="dialog-trigger">{children}</span>
  )
}))

vi.mock('@/components/ui/badge', () => ({
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

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  )
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  )
}))

vi.mock('@phosphor-icons/react', () => ({
  ClipboardText: () => <span data-testid="clipboard-icon" />,
  Export: () => <span data-testid="export-icon" />,
  Trash: () => <span data-testid="trash-icon" />
}))

const mockToast = {
  success: vi.fn(),
  info: vi.fn()
}

vi.mock('sonner', () => ({
  toast: mockToast
}))

// Mock URL and document methods
const mockCreateObjectURL = vi.fn(() => 'mock-url')
const mockRevokeObjectURL = vi.fn()

describe('FeedbackViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Setup URL mocks
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    // Reset confirm mock
    vi.spyOn(window, 'confirm').mockImplementation(() => true)
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  const mockFeedback = [
    {
      component: 'dashboard',
      feedbackType: 'bug',
      priority: 'high',
      description: 'Test bug description',
      suggestion: 'Fix it please',
      deviceType: 'desktop',
      timestamp: '2024-01-15T10:30:00.000Z',
      userAgent: 'Mozilla/5.0'
    },
    {
      component: 'filters',
      feedbackType: 'feature',
      priority: 'medium',
      description: 'Feature request description',
      suggestion: '',
      deviceType: 'mobile',
      timestamp: '2024-01-16T14:00:00.000Z',
      userAgent: 'Mobile Safari'
    }
  ]

  describe('rendering', () => {
    it('renders the view feedback button', () => {
      render(<FeedbackViewer />)
      expect(screen.getByText(/view feedback/i)).toBeInTheDocument()
    })

    it('renders the clipboard icon', () => {
      render(<FeedbackViewer />)
      expect(screen.getByTestId('clipboard-icon')).toBeInTheDocument()
    })

    it('does not show dialog by default', () => {
      render(<FeedbackViewer />)
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty message when no feedback exists', async () => {
      render(<FeedbackViewer />)

      // Click to open dialog
      await userEvent.click(screen.getByText(/view feedback/i))

      expect(screen.getByText(/no feedback collected yet/i)).toBeInTheDocument()
    })

    it('disables export button when no feedback exists', async () => {
      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const exportButton = screen.getByRole('button', { name: /export/i })
      expect(exportButton).toBeDisabled()
    })

    it('disables clear button when no feedback exists', async () => {
      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      expect(clearButton).toBeDisabled()
    })
  })

  describe('loading feedback', () => {
    it('loads feedback from localStorage when dialog opens', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      expect(screen.getByText('Test bug description')).toBeInTheDocument()
      expect(screen.getByText('Feature request description')).toBeInTheDocument()
    })

    it('displays feedback count in summary cards', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      // Check for summary sections
      expect(screen.getByText('By Component')).toBeInTheDocument()
      expect(screen.getByText('By Type')).toBeInTheDocument()
      expect(screen.getByText('By Priority')).toBeInTheDocument()
    })
  })

  describe('summary statistics', () => {
    it('shows component labels correctly', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      expect(screen.getByText('Dashboard Overview')).toBeInTheDocument()
      expect(screen.getByText('Filters & Search')).toBeInTheDocument()
    })

    it('shows priority badges with correct colors', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const badges = screen.getAllByTestId('badge')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  describe('feedback entries', () => {
    it('displays feedback entry details', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      expect(screen.getByText('Description:')).toBeInTheDocument()
      expect(screen.getByText('Test bug description')).toBeInTheDocument()
    })

    it('displays suggestion when present', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      expect(screen.getByText('Suggestion:')).toBeInTheDocument()
      expect(screen.getByText('Fix it please')).toBeInTheDocument()
    })

    it('displays device type for each entry', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      expect(screen.getByText(/device: desktop/i)).toBeInTheDocument()
      expect(screen.getByText(/device: mobile/i)).toBeInTheDocument()
    })
  })

  describe('export functionality', () => {
    it('enables export button when feedback exists', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const exportButton = screen.getByRole('button', { name: /export/i })
      expect(exportButton).not.toBeDisabled()
    })

    it('creates downloadable JSON file on export', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      // Mock document.createElement and click
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn()
      }
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement)

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const exportButton = screen.getByRole('button', { name: /export/i })
      await userEvent.click(exportButton)

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Feedback exported', expect.any(Object))
    })
  })

  describe('clear functionality', () => {
    it('enables clear button when feedback exists', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      expect(clearButton).not.toBeDisabled()
    })

    it('shows confirmation dialog before clearing', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      await userEvent.click(clearButton)

      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to clear all feedback? This cannot be undone.'
      )
    })

    it('clears feedback from localStorage when confirmed', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      await userEvent.click(clearButton)

      expect(localStorage.getItem('ui-feedback')).toBeNull()
      expect(mockToast.info).toHaveBeenCalledWith('All feedback cleared')
    })

    it('does not clear feedback when confirmation is cancelled', async () => {
      localStorage.setItem('ui-feedback', JSON.stringify(mockFeedback))
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      const clearButton = screen.getByRole('button', { name: /clear all/i })
      await userEvent.click(clearButton)

      expect(localStorage.getItem('ui-feedback')).not.toBeNull()
    })
  })

  describe('dialog title and description', () => {
    it('shows correct dialog title', async () => {
      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Collected Feedback')
    })

    it('shows correct dialog description', async () => {
      render(<FeedbackViewer />)
      await userEvent.click(screen.getByText(/view feedback/i))

      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        'Review all user feedback collected from the application.'
      )
    })
  })
})
