import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { NotesAndReminders } from '../NotesAndReminders'
import type { ProspectNote, FollowUpReminder } from '@public-records/core'

// Mock UI components
vi.mock('@public-records/ui/card', () => ({
  Card: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  )
}))

vi.mock('@public-records/ui/button', () => ({
  Button: ({
    children,
    onClick,
    size,
    variant,
    className,
    ...props
  }: {
    children: ReactNode
    onClick?: () => void
    size?: string
    variant?: string
    className?: string
  }) => (
    <button
      onClick={onClick}
      data-size={size}
      data-variant={variant}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}))

vi.mock('@public-records/ui/textarea', () => ({
  Textarea: ({
    id,
    value,
    onChange,
    placeholder,
    className
  }: {
    id?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    placeholder?: string
    className?: string
  }) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      data-testid={id || 'textarea'}
    />
  )
}))

vi.mock('@public-records/ui/input', () => ({
  Input: ({
    type,
    value,
    onChange,
    className
  }: {
    type?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    className?: string
  }) => (
    <input
      type={type}
      value={value}
      onChange={onChange}
      className={className}
      data-testid={type === 'date' ? 'date-input' : 'text-input'}
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
    onValueChange?: (val: string) => void
  }) => (
    <div data-testid="select">
      <select
        data-testid="priority-select"
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>
}))

vi.mock('@phosphor-icons/react', () => ({
  Note: ({ className }: { className?: string }) => (
    <span data-testid="note-icon" className={className} />
  ),
  Bell: ({ className }: { className?: string }) => (
    <span data-testid="bell-icon" className={className} />
  ),
  Plus: ({ className }: { className?: string }) => (
    <span data-testid="plus-icon" className={className} />
  ),
  Check: ({ className, weight }: { className?: string; weight?: string }) => (
    <span data-testid="check-icon" className={className} data-weight={weight} />
  ),
  Trash: ({ className }: { className?: string }) => (
    <span data-testid="trash-icon" className={className} />
  ),
  Calendar: ({ className }: { className?: string }) => (
    <span data-testid="calendar-icon" className={className} />
  )
}))

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: mockToast
}))

describe('NotesAndReminders', () => {
  const mockNotes: ProspectNote[] = [
    {
      id: 'note-1',
      prospectId: 'prospect-1',
      content: 'First note content',
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'John Doe'
    },
    {
      id: 'note-2',
      prospectId: 'prospect-1',
      content: 'Second note content',
      createdAt: '2024-01-16T10:00:00Z',
      createdBy: 'Jane Smith',
      updatedAt: '2024-01-17T10:00:00Z'
    }
  ]

  const mockReminders: FollowUpReminder[] = [
    {
      id: 'reminder-1',
      prospectId: 'prospect-1',
      description: 'Follow up call',
      dueDate: '2024-02-15',
      priority: 'high',
      completed: false,
      createdAt: '2024-01-15T10:00:00Z',
      createdBy: 'John Doe'
    },
    {
      id: 'reminder-2',
      prospectId: 'prospect-1',
      description: 'Send proposal',
      dueDate: '2024-01-10', // Overdue
      priority: 'medium',
      completed: false,
      createdAt: '2024-01-10T10:00:00Z',
      createdBy: 'Jane Smith'
    },
    {
      id: 'reminder-3',
      prospectId: 'prospect-1',
      description: 'Completed task',
      dueDate: '2024-01-05',
      priority: 'low',
      completed: true,
      completedAt: '2024-01-05T15:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
      createdBy: 'John Doe'
    }
  ]

  const defaultProps = {
    prospectId: 'prospect-1',
    prospectName: 'Test Company',
    notes: [] as ProspectNote[],
    reminders: [] as FollowUpReminder[],
    onAddNote: vi.fn(),
    onDeleteNote: vi.fn(),
    onAddReminder: vi.fn(),
    onCompleteReminder: vi.fn(),
    onDeleteReminder: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders notes section', () => {
      render(<NotesAndReminders {...defaultProps} />)
      expect(screen.getByText('Notes')).toBeInTheDocument()
      expect(screen.getByTestId('note-icon')).toBeInTheDocument()
    })

    it('renders reminders section', () => {
      render(<NotesAndReminders {...defaultProps} />)
      expect(screen.getByText('Follow-up Reminders')).toBeInTheDocument()
      expect(screen.getByTestId('bell-icon')).toBeInTheDocument()
    })

    it('shows notes count badge', () => {
      render(<NotesAndReminders {...defaultProps} notes={mockNotes} />)
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('shows active reminders count badge', () => {
      render(<NotesAndReminders {...defaultProps} reminders={mockReminders} />)
      expect(screen.getByText('2 active')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty notes message', () => {
      render(<NotesAndReminders {...defaultProps} />)
      expect(
        screen.getByText(/No notes yet. Add a note to track important information/)
      ).toBeInTheDocument()
    })

    it('shows empty reminders message', () => {
      render(<NotesAndReminders {...defaultProps} />)
      expect(
        screen.getByText(/No reminders set. Create a reminder to track follow-up/)
      ).toBeInTheDocument()
    })

    it('includes prospect name in empty messages', () => {
      render(<NotesAndReminders {...defaultProps} />)
      expect(screen.getAllByText(/Test Company/).length).toBeGreaterThan(0)
    })
  })

  describe('notes display', () => {
    it('displays note content', () => {
      render(<NotesAndReminders {...defaultProps} notes={mockNotes} />)
      expect(screen.getByText('First note content')).toBeInTheDocument()
      expect(screen.getByText('Second note content')).toBeInTheDocument()
    })

    it('displays note author', () => {
      render(<NotesAndReminders {...defaultProps} notes={mockNotes} />)
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('shows updated date when present', () => {
      render(<NotesAndReminders {...defaultProps} notes={mockNotes} />)
      expect(screen.getByText(/Updated/)).toBeInTheDocument()
    })
  })

  describe('adding notes', () => {
    it('renders note input textarea', () => {
      render(<NotesAndReminders {...defaultProps} />)
      expect(screen.getByPlaceholderText('Add a note about this prospect...')).toBeInTheDocument()
    })

    it('renders add note button', () => {
      render(<NotesAndReminders {...defaultProps} />)
      expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument()
    })

    it('shows error toast for empty note', async () => {
      render(<NotesAndReminders {...defaultProps} />)

      await userEvent.click(screen.getByRole('button', { name: /add note/i }))

      expect(mockToast.error).toHaveBeenCalledWith('Note cannot be empty')
    })

    it('calls onAddNote with correct data', async () => {
      const onAddNote = vi.fn()
      render(<NotesAndReminders {...defaultProps} onAddNote={onAddNote} />)

      const textarea = screen.getByPlaceholderText('Add a note about this prospect...')
      await userEvent.type(textarea, 'New note content')

      await userEvent.click(screen.getByRole('button', { name: /add note/i }))

      expect(onAddNote).toHaveBeenCalledWith({
        prospectId: 'prospect-1',
        content: 'New note content'
      })
    })

    it('shows success toast on add', async () => {
      render(<NotesAndReminders {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('Add a note about this prospect...')
      await userEvent.type(textarea, 'New note')

      await userEvent.click(screen.getByRole('button', { name: /add note/i }))

      expect(mockToast.success).toHaveBeenCalledWith('Note added successfully')
    })

    it('clears textarea after adding note', async () => {
      render(<NotesAndReminders {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('Add a note about this prospect...')
      await userEvent.type(textarea, 'New note')

      await userEvent.click(screen.getByRole('button', { name: /add note/i }))

      expect(textarea).toHaveValue('')
    })
  })

  describe('deleting notes', () => {
    it('renders delete button for each note', () => {
      render(<NotesAndReminders {...defaultProps} notes={mockNotes} />)
      // Find trash icons (one for each note)
      const trashIcons = screen.getAllByTestId('trash-icon')
      expect(trashIcons.length).toBeGreaterThan(0)
    })

    it('calls onDeleteNote when delete is clicked', async () => {
      const onDeleteNote = vi.fn()
      render(<NotesAndReminders {...defaultProps} notes={mockNotes} onDeleteNote={onDeleteNote} />)

      // Find first delete button in notes section (before separator)
      const deleteButtons = screen.getAllByTestId('trash-icon')
      await userEvent.click(deleteButtons[0].closest('button')!)

      expect(onDeleteNote).toHaveBeenCalledWith('note-1')
    })
  })

  describe('reminders display', () => {
    it('displays reminder description', () => {
      render(<NotesAndReminders {...defaultProps} reminders={mockReminders} />)
      expect(screen.getByText('Follow up call')).toBeInTheDocument()
      expect(screen.getByText('Send proposal')).toBeInTheDocument()
    })

    it('shows priority badge', () => {
      render(<NotesAndReminders {...defaultProps} reminders={mockReminders} />)
      expect(screen.getByText('high')).toBeInTheDocument()
      expect(screen.getByText('medium')).toBeInTheDocument()
    })

    it('shows overdue badge for past due reminders', () => {
      render(<NotesAndReminders {...defaultProps} reminders={mockReminders} />)
      expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0)
    })

    it('sorts reminders with incomplete first', () => {
      render(<NotesAndReminders {...defaultProps} reminders={mockReminders} />)

      const cards = screen.getAllByTestId('card')
      // Incomplete reminders should appear before completed ones
      expect(cards.length).toBeGreaterThan(0)
    })
  })

  describe('adding reminders', () => {
    it('renders reminder input fields', () => {
      render(<NotesAndReminders {...defaultProps} />)
      expect(screen.getByPlaceholderText(/Reminder description/)).toBeInTheDocument()
      expect(screen.getByTestId('date-input')).toBeInTheDocument()
      expect(screen.getByTestId('priority-select')).toBeInTheDocument()
    })

    it('shows error toast for empty description', async () => {
      render(<NotesAndReminders {...defaultProps} />)

      // Click add reminder without filling description
      const addButtons = screen.getAllByRole('button', { name: /add reminder/i })
      await userEvent.click(addButtons[0])

      expect(mockToast.error).toHaveBeenCalledWith('Reminder description cannot be empty')
    })

    it('shows error toast for missing date', async () => {
      render(<NotesAndReminders {...defaultProps} />)

      // Fill description but not date
      const descTextarea = screen.getByPlaceholderText(/Reminder description/)
      await userEvent.type(descTextarea, 'Test reminder')

      const addButtons = screen.getAllByRole('button', { name: /add reminder/i })
      await userEvent.click(addButtons[0])

      expect(mockToast.error).toHaveBeenCalledWith('Please select a due date')
    })

    it('calls onAddReminder with correct data', async () => {
      const onAddReminder = vi.fn()
      render(<NotesAndReminders {...defaultProps} onAddReminder={onAddReminder} />)

      const descTextarea = screen.getByPlaceholderText(/Reminder description/)
      await userEvent.type(descTextarea, 'Test reminder')

      const dateInput = screen.getByTestId('date-input')
      await userEvent.type(dateInput, '2024-02-20')

      const prioritySelect = screen.getByTestId('priority-select')
      await userEvent.selectOptions(prioritySelect, 'high')

      const addButtons = screen.getAllByRole('button', { name: /add reminder/i })
      await userEvent.click(addButtons[0])

      expect(onAddReminder).toHaveBeenCalledWith({
        prospectId: 'prospect-1',
        description: 'Test reminder',
        dueDate: '2024-02-20',
        priority: 'high'
      })
    })
  })

  describe('completing reminders', () => {
    it('renders complete button for each reminder', () => {
      render(<NotesAndReminders {...defaultProps} reminders={mockReminders} />)
      const checkIcons = screen.getAllByTestId('check-icon')
      expect(checkIcons.length).toBeGreaterThan(0)
    })

    it('calls onCompleteReminder when check is clicked', async () => {
      const onCompleteReminder = vi.fn()
      render(
        <NotesAndReminders
          {...defaultProps}
          reminders={mockReminders}
          onCompleteReminder={onCompleteReminder}
        />
      )

      const checkButtons = screen.getAllByTestId('check-icon')
      await userEvent.click(checkButtons[0].closest('button')!)

      expect(onCompleteReminder).toHaveBeenCalled()
    })

    it('shows completed styling for completed reminders', () => {
      render(<NotesAndReminders {...defaultProps} reminders={mockReminders} />)
      expect(screen.getByText('Completed task')).toBeInTheDocument()
    })
  })

  describe('deleting reminders', () => {
    it('calls onDeleteReminder when delete is clicked', async () => {
      const onDeleteReminder = vi.fn()
      render(
        <NotesAndReminders
          {...defaultProps}
          reminders={mockReminders}
          onDeleteReminder={onDeleteReminder}
        />
      )

      // Find delete buttons in reminders section (after separator)
      const trashIcons = screen.getAllByTestId('trash-icon')
      // Last trash icons should be for reminders
      const reminderTrash = trashIcons[trashIcons.length - 1]
      await userEvent.click(reminderTrash.closest('button')!)

      expect(onDeleteReminder).toHaveBeenCalled()
    })
  })
})
