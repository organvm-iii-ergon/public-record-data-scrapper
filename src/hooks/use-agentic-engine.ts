/**
 * React Hook for Agentic Engine
 * 
 * Provides React integration for the agentic system
 */

import { useState, useEffect, useCallback } from 'react'
import { AgenticEngine } from '@/lib/agentic/AgenticEngine'
import { SystemContext, Improvement, ImprovementStatus, AgenticConfig } from '@/lib/agentic/types'
import { usePersistentState } from './usePersistentState'

export interface UseAgenticEngineResult {
  engine: AgenticEngine | null
  isRunning: boolean
  improvements: Improvement[]
  runCycle: () => Promise<void>
  approveImprovement: (id: string) => Promise<void>
  getImprovementsByStatus: (status: ImprovementStatus) => Improvement[]
  systemHealth: ReturnType<AgenticEngine['getSystemHealth']>
}

export function useAgenticEngine(context: SystemContext, config?: Partial<AgenticConfig>): UseAgenticEngineResult {
  const [engine] = useState(() => new AgenticEngine(config))
  const [isRunning, setIsRunning] = useState(false)
  const [improvements, setImprovements] = usePersistentState<Improvement[]>('agentic-improvements', [])
  const [lastRunTime, setLastRunTime] = usePersistentState<string>('agentic-last-run', '')
  const [systemHealth, setSystemHealth] = useState(engine.getSystemHealth())

  // Run autonomous cycle
  const runCycle = useCallback(async () => {
    if (isRunning) return
    
    setIsRunning(true)
    try {
      const result = await engine.runAutonomousCycle(context)
      setImprovements(engine.getImprovements())
      setLastRunTime(new Date().toISOString())
      setSystemHealth(engine.getSystemHealth())
      
      console.log('✅ Autonomous cycle completed', result)
    } catch (error) {
      console.error('❌ Autonomous cycle failed:', error)
    } finally {
      setIsRunning(false)
    }
  }, [context, engine, isRunning, setImprovements, setLastRunTime])

  // Approve and execute an improvement
  const approveImprovement = useCallback(async (id: string) => {
    try {
      await engine.approveAndExecute(id, context)
      setImprovements(engine.getImprovements())
      setSystemHealth(engine.getSystemHealth())
    } catch (error) {
      console.error('❌ Failed to approve improvement:', error)
      throw error
    }
  }, [context, engine, setImprovements])

  // Get improvements by status
  const getImprovementsByStatus = useCallback((status: ImprovementStatus) => {
    return engine.getImprovementsByStatus(status)
  }, [engine])

  // Auto-run on mount if enabled (only once per session)
  useEffect(() => {
    const shouldAutoRun = !lastRunTime && engine.getConfig().enabled
    if (shouldAutoRun && context.prospects.length > 0) {
      console.log('🤖 Auto-running initial agentic cycle...')
      runCycle()
    }
  }, []) // Empty deps - only run once on mount

  return {
    engine,
    isRunning,
    improvements,
    runCycle,
    approveImprovement,
    getImprovementsByStatus,
    systemHealth
  }
}
