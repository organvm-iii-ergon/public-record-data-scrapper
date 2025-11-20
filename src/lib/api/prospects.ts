import { Prospect } from '@/lib/types'
import { apiRequest } from './client'

export async function fetchProspects(signal?: AbortSignal): Promise<Prospect[]> {
  return apiRequest<Prospect[]>('/prospects', { signal })
}

export async function claimProspect(prospectId: string, user: string, signal?: AbortSignal): Promise<Prospect> {
  return apiRequest<Prospect>(`/prospects/${encodeURIComponent(prospectId)}/claim`, {
    method: 'POST',
    body: { user },
    signal
  })
}

export async function unclaimProspect(prospectId: string, signal?: AbortSignal): Promise<Prospect> {
  return apiRequest<Prospect>(`/prospects/${encodeURIComponent(prospectId)}/unclaim`, {
    method: 'POST',
    signal
  })
}

export async function batchClaimProspects(ids: string[], user: string, signal?: AbortSignal): Promise<Prospect[]> {
  return apiRequest<Prospect[]>('/prospects/batch/claim', {
    method: 'POST',
    body: { ids, user },
    signal
  })
}

export async function deleteProspects(ids: string[], signal?: AbortSignal): Promise<void> {
  await apiRequest<unknown>('/prospects/batch', {
    method: 'DELETE',
    body: { ids },
    signal
  })
}
