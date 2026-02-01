import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  Contact,
  ContactWithActivities,
  ContactListParams,
  ContactListResponse,
  CreateContactParams,
  UpdateContactParams,
  LinkContactParams,
  LogActivityParams,
  ContactActivity,
  fetchContacts,
  fetchContact,
  createContact,
  updateContact,
  linkContactToProspect,
  unlinkContactFromProspect,
  logContactActivity,
  fetchContactActivities,
  fetchContactsForProspect
} from '@/lib/api/contacts'

export interface UseContactActionsOptions {
  orgId: string
  onContactCreated?: (contact: Contact) => void
  onContactUpdated?: (contact: Contact) => void
  onContactLinked?: (contactId: string, prospectId: string) => void
  onContactUnlinked?: (contactId: string, prospectId: string) => void
  onActivityLogged?: (activity: ContactActivity) => void
}

export interface UseContactActionsResult {
  isLoading: boolean
  error: Error | null
  handleFetchContacts: (params?: Partial<ContactListParams>) => Promise<ContactListResponse | null>
  handleFetchContact: (id: string) => Promise<ContactWithActivities | null>
  handleCreateContact: (params: Omit<CreateContactParams, 'org_id'>) => Promise<Contact | null>
  handleUpdateContact: (id: string, params: UpdateContactParams) => Promise<Contact | null>
  handleLinkToProspect: (
    contactId: string,
    prospectId: string,
    params?: LinkContactParams
  ) => Promise<boolean>
  handleUnlinkFromProspect: (contactId: string, prospectId: string) => Promise<boolean>
  handleLogActivity: (
    contactId: string,
    params: LogActivityParams
  ) => Promise<ContactActivity | null>
  handleFetchActivities: (
    contactId: string,
    options?: { limit?: number; before?: string }
  ) => Promise<ContactActivity[]>
  handleFetchContactsForProspect: (prospectId: string) => Promise<Contact[]>
}

export function useContactActions({
  orgId,
  onContactCreated,
  onContactUpdated,
  onContactLinked,
  onContactUnlinked,
  onActivityLogged
}: UseContactActionsOptions): UseContactActionsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const handleFetchContacts = useCallback(
    async (params: Partial<ContactListParams> = {}): Promise<ContactListResponse | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchContacts({ org_id: orgId, ...params })
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch contacts')
        setError(error)
        toast.error('Failed to fetch contacts', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId]
  )

  const handleFetchContact = useCallback(
    async (id: string): Promise<ContactWithActivities | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const contact = await fetchContact(id, orgId)
        return contact
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch contact')
        setError(error)
        toast.error('Failed to fetch contact', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId]
  )

  const handleCreateContact = useCallback(
    async (params: Omit<CreateContactParams, 'org_id'>): Promise<Contact | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const contact = await createContact({ org_id: orgId, ...params })
        toast.success('Contact created', {
          description: `${contact.first_name} ${contact.last_name} has been added.`
        })
        onContactCreated?.(contact)
        return contact
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create contact')
        setError(error)
        toast.error('Failed to create contact', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId, onContactCreated]
  )

  const handleUpdateContact = useCallback(
    async (id: string, params: UpdateContactParams): Promise<Contact | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const contact = await updateContact(id, orgId, params)
        toast.success('Contact updated', {
          description: `${contact.first_name} ${contact.last_name} has been updated.`
        })
        onContactUpdated?.(contact)
        return contact
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update contact')
        setError(error)
        toast.error('Failed to update contact', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [orgId, onContactUpdated]
  )

  const handleLinkToProspect = useCallback(
    async (
      contactId: string,
      prospectId: string,
      params: LinkContactParams = {}
    ): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        await linkContactToProspect(contactId, prospectId, params)
        toast.success('Contact linked', {
          description: 'Contact has been linked to the prospect.'
        })
        onContactLinked?.(contactId, prospectId)
        return true
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to link contact')
        setError(error)
        toast.error('Failed to link contact', {
          description: error.message
        })
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [onContactLinked]
  )

  const handleUnlinkFromProspect = useCallback(
    async (contactId: string, prospectId: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        await unlinkContactFromProspect(contactId, prospectId)
        toast.info('Contact unlinked', {
          description: 'Contact has been unlinked from the prospect.'
        })
        onContactUnlinked?.(contactId, prospectId)
        return true
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to unlink contact')
        setError(error)
        toast.error('Failed to unlink contact', {
          description: error.message
        })
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [onContactUnlinked]
  )

  const handleLogActivity = useCallback(
    async (contactId: string, params: LogActivityParams): Promise<ContactActivity | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const activity = await logContactActivity(contactId, params)
        toast.success('Activity logged', {
          description: 'Activity has been recorded.'
        })
        onActivityLogged?.(activity)
        return activity
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to log activity')
        setError(error)
        toast.error('Failed to log activity', {
          description: error.message
        })
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [onActivityLogged]
  )

  const handleFetchActivities = useCallback(
    async (
      contactId: string,
      options: { limit?: number; before?: string } = {}
    ): Promise<ContactActivity[]> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchContactActivities(contactId, options)
        return result.activities
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch activities')
        setError(error)
        toast.error('Failed to fetch activities', {
          description: error.message
        })
        return []
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const handleFetchContactsForProspect = useCallback(
    async (prospectId: string): Promise<Contact[]> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchContactsForProspect(prospectId)
        return result.contacts
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to fetch contacts for prospect')
        setError(error)
        toast.error('Failed to fetch contacts', {
          description: error.message
        })
        return []
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return {
    isLoading,
    error,
    handleFetchContacts,
    handleFetchContact,
    handleCreateContact,
    handleUpdateContact,
    handleLinkToProspect,
    handleUnlinkFromProspect,
    handleLogActivity,
    handleFetchActivities,
    handleFetchContactsForProspect
  }
}
