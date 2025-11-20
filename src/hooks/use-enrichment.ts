/**
 * Enrichment Service Hook
 * 
 * React hook for using the enrichment pipeline in the UI
 */

import { useState } from 'react'
import { EnrichmentOrchestratorAgent } from '../lib/agentic'
import { EnrichmentRequest, EnrichmentResult } from '../lib/agentic/types'

export interface UseEnrichmentResult {
  enrich: (request: EnrichmentRequest) => Promise<void>
  loading: boolean
  error: string | null
  result: EnrichmentResult | null
  progress: any[]
}

export function useEnrichment(): UseEnrichmentResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EnrichmentResult | null>(null)
  const [progress, setProgress] = useState<any[]>([])

  const enrich = async (request: EnrichmentRequest) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setProgress([])

    try {
      const orchestrator = new EnrichmentOrchestratorAgent()
      const taskResult = await orchestrator.executeTask({
        type: 'enrich-prospect',
        payload: request
      })

      if (taskResult.success) {
        setResult(taskResult.data as EnrichmentResult)
        setProgress(taskResult.data?.progress || [])
      } else {
        setError(taskResult.error || 'Enrichment failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return {
    enrich,
    loading,
    error,
    result,
    progress
  }
}
