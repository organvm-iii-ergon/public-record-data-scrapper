import { CompetitorChart } from '@/components/CompetitorChart'
import { LegacySearch } from '@/components/LegacySearch'
import { CompetitorData } from '@/lib/types'

interface IntelligenceTabProps {
  competitors: CompetitorData[]
}

export function IntelligenceTab({ competitors }: IntelligenceTabProps) {
  return (
    <>
      <div className="glass-effect p-4 sm:p-6 rounded-lg">
        <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-white">
          Competitor Intelligence
        </h2>
        <p className="text-white/70 mb-4 sm:mb-6 text-sm sm:text-base">
          Market analysis of UCC filing activity by secured parties
        </p>
        <CompetitorChart data={competitors} />
      </div>
      <LegacySearch />
    </>
  )
}
