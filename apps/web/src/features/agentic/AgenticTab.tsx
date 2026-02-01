import { AgenticDashboard } from '@/components/AgenticDashboard'
import { CompetitorData } from '@/lib/types'
import { UseAgenticEngineReturn } from '@/hooks/use-agentic-engine'

interface AgenticTabProps {
  agentic: UseAgenticEngineReturn
  competitors: CompetitorData[]
}

export function AgenticTab({ agentic, competitors }: AgenticTabProps) {
  return <AgenticDashboard agentic={agentic} competitors={competitors} />
}
