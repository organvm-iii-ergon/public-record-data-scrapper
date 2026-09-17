import { useState, type ComponentProps } from 'react'
import { ProspectNote, FollowUpReminder } from '@public-records/core'
import { Card } from '@public-records/ui/card'
import { Button } from '@public-records/ui/button'
import { Textarea } from '@public-records/ui/textarea'
import { Input } from '@public-records/ui/input'
import { Badge } from '@public-records/ui/badge'
import { Separator } from '@public-records/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@public-records/ui/select'
import { Note, Bell, Plus, Check, Trash, Calendar as CalendarIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'

type ReminderPriority = FollowUpReminder['priority']
type BadgeVariant = ComponentProps<typeof Badge>['variant']

interface NotesAndRemindersProps {
  prospectId: string
  prospectName: string
  notes: ProspectNote[]
  reminders: FollowUpReminder[]
  onAddNote: (note: Omit<ProspectNote, 'id' | 'createdAt' | 'createdBy'>) => void
  onDeleteNote: (noteId: string) => void
  onAddReminder: (
    reminder: Omit<FollowUpReminder, 'id' | 'createdAt' | 'createdBy' | 'completed'>
  ) => void
  onCompleteReminder: (reminderId: string) => void
  onDeleteReminder: (reminderId: string) => void
}

export function NotesAndReminders({
  prospectId,
  prospectName,
  notes,
  reminders,
  onAddNote,
  onDeleteNote,
  onAddReminder,
  onCompleteReminder,
  onDeleteReminder
}: NotesAndRemindersProps) {
  const [newNote, setNewNote] = useState('')
  const [newReminderDescription, setNewReminderDescription] = useState('')
  const [newReminderDate, setNewReminderDate] = useState('')
  const [newReminderPriority, setNewReminderPriority] = useState<ReminderPriority>('medium')

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.error('Note cannot be empty')
      return
    }

    onAddNote({
      prospectId,
      content: newNote.trim()
    })

    setNewNote('')
    toast.success('Note added successfully')
  }

  const handleAddReminder = () => {
    if (!newReminderDescription.trim()) {
      toast.error('Reminder description cannot be empty')
      return
    }

    if (!newReminderDate) {
      toast.error('Please select a due date')
      return
    }

    onAddReminder({
      prospectId,
      description: newReminderDescription.trim(),
      dueDate: newReminderDate,
      priority: newReminderPriority
    })

    setNewReminderDescription('')
    setNewReminderDate('')
    setNewReminderPriority('medium')
    toast.success('Reminder created successfully')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isOverdue = (dueDate: string, completed: boolean) => {
    if (completed) return false
    return new Date(dueDate) < new Date()
  }

  const getPriorityColor = (priority: ReminderPriority): BadgeVariant => {
    switch (priority) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
        return 'secondary'
      default:
        return 'default'
    }
  }

  // Sort reminders: incomplete first, then by due date
  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  return (
    <div className="space-y-6">
      {/* Notes Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Note size={20} weight="fill" className="text-primary" />
          <h3 className="font-semibold text-lg">Notes</h3>
          <Badge variant="outline" className="ml-auto">
            {notes.length}
          </Badge>
        </div>

        <Card className="p-4 mb-4">
          <Textarea
            placeholder="Add a note about this prospect..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="mb-3 min-h-[80px]"
          />
          <Button onClick={handleAddNote} size="sm">
            <Plus size={16} weight="bold" className="mr-2" />
            Add Note
          </Button>
        </Card>

        <div className="space-y-3">
          {notes.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No notes yet. Add a note to track important information about {prospectName}.
            </Card>
          ) : (
            notes.map((note) => (
              <Card key={note.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed mb-2">{note.content}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(note.createdAt)}</span>
                      <span>•</span>
                      <span>{note.createdBy}</span>
                      {note.updatedAt && (
                        <>
                          <span>•</span>
                          <span>Updated {formatDate(note.updatedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onDeleteNote(note.id)
                      toast.info('Note deleted')
                    }}
                  >
                    <Trash size={16} weight="bold" className="text-destructive" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Separator />

      {/* Reminders Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={20} weight="fill" className="text-accent" />
          <h3 className="font-semibold text-lg">Follow-up Reminders</h3>
          <Badge variant="outline" className="ml-auto">
            {reminders.filter((r) => !r.completed).length} active
          </Badge>
        </div>

        <Card className="p-4 mb-4">
          <div className="space-y-3">
            <Textarea
              placeholder="Reminder description (e.g., Follow up on proposal)"
              value={newReminderDescription}
              onChange={(e) => setNewReminderDescription(e.target.value)}
              className="min-h-[60px]"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="date"
                  value={newReminderDate}
                  onChange={(e) => setNewReminderDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select
                value={newReminderPriority}
                onValueChange={(val) => setNewReminderPriority(val as ReminderPriority)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddReminder} size="sm">
              <Plus size={16} weight="bold" className="mr-2" />
              Add Reminder
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {reminders.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No reminders set. Create a reminder to track follow-up actions for {prospectName}.
            </Card>
          ) : (
            sortedReminders.map((reminder) => (
              <Card
                key={reminder.id}
                className={`p-4 ${reminder.completed ? 'opacity-60' : ''} ${
                  isOverdue(reminder.dueDate, reminder.completed) ? 'border-destructive' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onCompleteReminder(reminder.id)
                        toast.success(
                          reminder.completed ? 'Reminder reopened' : 'Reminder completed'
                        )
                      }}
                      className="p-1 h-auto"
                    >
                      <Check
                        size={20}
                        weight={reminder.completed ? 'fill' : 'bold'}
                        className={reminder.completed ? 'text-success' : 'text-muted-foreground'}
                      />
                    </Button>
                    <div className="flex-1">
                      <p
                        className={`text-sm leading-relaxed mb-2 ${reminder.completed ? 'line-through' : ''}`}
                      >
                        {reminder.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={getPriorityColor(reminder.priority)}
                          className="text-xs capitalize"
                        >
                          {reminder.priority}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarIcon size={12} weight="fill" />
                          <span>{formatDate(reminder.dueDate)}</span>
                        </div>
                        {isOverdue(reminder.dueDate, reminder.completed) && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                        {reminder.completed && reminder.completedAt && (
                          <span className="text-xs text-muted-foreground">
                            • Completed {formatDate(reminder.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onDeleteReminder(reminder.id)
                      toast.info('Reminder deleted')
                    }}
                  >
                    <Trash size={16} weight="bold" className="text-destructive" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
