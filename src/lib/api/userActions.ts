import { UserAction } from '@/lib/agentic/types'
import { apiRequest } from './client'

export async function fetchUserActions(signal?: AbortSignal): Promise<UserAction[]> {
  return apiRequest<UserAction[]>('/user-actions', { signal })
}

export async function logUserAction(action: UserAction, signal?: AbortSignal): Promise<UserAction> {
  return apiRequest<UserAction>('/user-actions', {
    method: 'POST',
    body: action,
    signal
  })
}
