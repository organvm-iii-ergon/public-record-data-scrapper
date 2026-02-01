import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { FeedbackButton } from '../FeedbackButton'

// Mock UI components
vi.mock('@public-records/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    ...props
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@public-records/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  )
}))

vi.mock('@public-records/ui/select', () => ({
  Select: ({
    children,
    onValueChange,
    value
  }: {
    children: ReactNode
    onValueChange?: (value: string) => void
    value?: string
  }) => (
    <div data-testid="select" data-value={value}>
      {children}
      <select
        data-testid="select-native"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="">Select...</option>
        <option value="dashboard">Dashboard Overview</option>
        <option value="bug">Bug/Issue</option>
        <option value="critical">Critical</option>
        <option value="desktop">Desktop</option>
      </select>
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>
}))

vi.mock('@public-records/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  )
}))

vi.mock('@public-records/ui/textarea', () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    ...props
  }: {
    id?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    placeholder?: string
  }) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data-testid={id || 'textarea'}
      {...props}
    />
  )
}))

vi.mock('@phosphor-icons/react', () => ({
  ChatCircleDots: () => <span data-testid="chat-icon" />
}))

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: mockToast
}))

describe('FeedbackButton', () => {
  const originalLocalStorage = window.localStorage
  let mockStorage: Record<string, string> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = {}

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key]
        }),
        clear: vi.fn(() => {
          mockStorage = {}
        }),
        key: vi.fn((index: number) => Object.keys(mockStorage)[index] ?? null),
        get length() {
          return Object.keys(mockStorage).length
        }
      },
      writable: true
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    })
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders the feedback button', () => {
      render(<FeedbackButton />)
      expect(screen.getByRole('button', { name: /give feedback/i })).toBeInTheDocument()
    })

    it('renders the chat icon', () => {
      render(<FeedbackButton />)
      expect(screen.getByTestId('chat-icon')).toBeInTheDocument()
    })

    it('does not show dialog by default', () => {
      render(<FeedbackButton />)
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })
  })

  describe('dialog interactions', () => {
    it('opens dialog when button is clicked', async () => {
      render(<FeedbackButton />)

      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Share Your Feedback')
    })

    it('shows all required form fields', async () => {
      render(<FeedbackButton />)
      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      // Use getAllByText since some labels match select placeholders
      expect(screen.getAllByText(/component/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/type of feedback/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/priority/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/device type/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/description/i).length).toBeGreaterThan(0)
    })

    it('shows optional suggestion field', async () => {
      render(<FeedbackButton />)
      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      expect(screen.getByText(/suggested improvement/i)).toBeInTheDocument()
    })
  })

  describe('form validation', () => {
    it('shows error toast when submitting without required fields', async () => {
      render(<FeedbackButton />)
      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      // Find and click submit button
      const submitButton = screen.getByRole('button', { name: /submit feedback/i })
      await userEvent.click(submitButton)

      expect(mockToast.error).toHaveBeenCalledWith('Please fill in all required fields')
    })
  })

  describe('form submission', () => {
    it('saves feedback to localStorage on successful submission', async () => {
      render(<FeedbackButton />)
      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      // Fill in required fields using native selects
      const selects = screen.getAllByTestId('select-native')

      // Component select
      fireEvent.change(selects[0], { target: { value: 'dashboard' } })
      // Feedback type select
      fireEvent.change(selects[1], { target: { value: 'bug' } })
      // Priority select
      fireEvent.change(selects[2], { target: { value: 'critical' } })
      // Device type select
      fireEvent.change(selects[3], { target: { value: 'desktop' } })

      // Fill in description
      const descriptionField = screen.getByTestId('description')
      await userEvent.type(descriptionField, 'Test feedback description')

      // Submit
      const submitButton = screen.getByRole('button', { name: /submit feedback/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        const stored = localStorage.getItem('ui-feedback')
        expect(stored).not.toBeNull()
      })
    })

    it('shows success toast on successful submission', async () => {
      render(<FeedbackButton />)
      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      // Fill in required fields
      const selects = screen.getAllByTestId('select-native')
      fireEvent.change(selects[0], { target: { value: 'dashboard' } })
      fireEvent.change(selects[1], { target: { value: 'bug' } })
      fireEvent.change(selects[2], { target: { value: 'critical' } })
      fireEvent.change(selects[3], { target: { value: 'desktop' } })

      const descriptionField = screen.getByTestId('description')
      await userEvent.type(descriptionField, 'Test feedback description')

      const submitButton = screen.getByRole('button', { name: /submit feedback/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Feedback submitted!', expect.any(Object))
      })
    })

    it('resets form after successful submission', async () => {
      render(<FeedbackButton />)
      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      // Fill and submit
      const selects = screen.getAllByTestId('select-native')
      fireEvent.change(selects[0], { target: { value: 'dashboard' } })
      fireEvent.change(selects[1], { target: { value: 'bug' } })
      fireEvent.change(selects[2], { target: { value: 'critical' } })
      fireEvent.change(selects[3], { target: { value: 'desktop' } })

      const descriptionField = screen.getByTestId('description')
      await userEvent.type(descriptionField, 'Test feedback description')

      const submitButton = screen.getByRole('button', { name: /submit feedback/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalled()
      })

      // Dialog should close after submission
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('appends to existing feedback in localStorage', async () => {
      // Pre-populate localStorage
      const existingFeedback = [{ component: 'old', timestamp: '2024-01-01' }]
      localStorage.setItem('ui-feedback', JSON.stringify(existingFeedback))

      render(<FeedbackButton />)
      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      const selects = screen.getAllByTestId('select-native')
      fireEvent.change(selects[0], { target: { value: 'dashboard' } })
      fireEvent.change(selects[1], { target: { value: 'bug' } })
      fireEvent.change(selects[2], { target: { value: 'critical' } })
      fireEvent.change(selects[3], { target: { value: 'desktop' } })

      const descriptionField = screen.getByTestId('description')
      await userEvent.type(descriptionField, 'New feedback')

      const submitButton = screen.getByRole('button', { name: /submit feedback/i })
      await userEvent.click(submitButton)

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem('ui-feedback') || '[]')
        expect(stored.length).toBe(2)
      })
    })
  })

  describe('cancel functionality', () => {
    it('has cancel button in dialog footer', async () => {
      render(<FeedbackButton />)
      await userEvent.click(screen.getByRole('button', { name: /give feedback/i }))

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })
})
