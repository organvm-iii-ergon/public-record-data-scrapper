import { useCallback } from 'react'
import { useSafeKV as useKV } from '@/hooks/useSparkKV'
import { ProspectNote, FollowUpReminder, OutreachEmail } from '@public-records/core'

// Simple UUID generator using crypto API
function generateId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export interface UseNotesAndRemindersResult {
  notes: ProspectNote[]
  reminders: FollowUpReminder[]
  handleAddNote: (note: Omit<ProspectNote, 'id' | 'createdAt' | 'createdBy'>) => void
  handleDeleteNote: (noteId: string) => void
  handleAddReminder: (
    reminder: Omit<FollowUpReminder, 'id' | 'createdAt' | 'createdBy' | 'completed'>
  ) => void
  handleCompleteReminder: (reminderId: string) => void
  handleDeleteReminder: (reminderId: string) => void
  handleSendEmail: (
    email: Omit<OutreachEmail, 'id' | 'createdAt' | 'createdBy'>,
    trackAction: (type: string, details?: Record<string, unknown>) => Promise<void>
  ) => void
}

export function useNotesAndReminders(): UseNotesAndRemindersResult {
  const [notes, setNotes] = useKV<ProspectNote[]>('prospect-notes', [])
  const [reminders, setReminders] = useKV<FollowUpReminder[]>('prospect-reminders', [])

  const handleAddNote = useCallback(
    (note: Omit<ProspectNote, 'id' | 'createdAt' | 'createdBy'>) => {
      const newNote: ProspectNote = {
        ...note,
        id: generateId(),
        createdBy: 'Current User',
        createdAt: new Date().toISOString()
      }

      setNotes((current) => [...(current || []), newNote])
    },
    [setNotes]
  )

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      setNotes((current) => (current || []).filter((n) => n.id !== noteId))
    },
    [setNotes]
  )

  const handleAddReminder = useCallback(
    (reminder: Omit<FollowUpReminder, 'id' | 'createdAt' | 'createdBy' | 'completed'>) => {
      const newReminder: FollowUpReminder = {
        ...reminder,
        id: generateId(),
        createdBy: 'Current User',
        createdAt: new Date().toISOString(),
        completed: false
      }

      setReminders((current) => [...(current || []), newReminder])
    },
    [setReminders]
  )

  const handleCompleteReminder = useCallback(
    (reminderId: string) => {
      setReminders((current) => {
        if (!current) return []
        return current.map((r) => {
          if (r.id === reminderId) {
            return {
              ...r,
              completed: !r.completed,
              completedAt: !r.completed ? new Date().toISOString() : undefined
            }
          }
          return r
        })
      })
    },
    [setReminders]
  )

  const handleDeleteReminder = useCallback(
    (reminderId: string) => {
      setReminders((current) => (current || []).filter((r) => r.id !== reminderId))
    },
    [setReminders]
  )

  const handleSendEmail = useCallback(
    (
      email: Omit<OutreachEmail, 'id' | 'createdAt' | 'createdBy'>,
      trackAction: (type: string, details?: Record<string, unknown>) => Promise<void>
    ) => {
      const newEmail: OutreachEmail = {
        ...email,
        id: generateId(),
        createdBy: 'Current User',
        createdAt: new Date().toISOString()
      }

      void trackAction('send-email', {
        prospectId: newEmail.prospectId,
        templateId: newEmail.templateId
      })
    },
    []
  )

  return {
    notes: notes || [],
    reminders: reminders || [],
    handleAddNote,
    handleDeleteNote,
    handleAddReminder,
    handleCompleteReminder,
    handleDeleteReminder,
    handleSendEmail
  }
}
