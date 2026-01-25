import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Target, ChartBar, Heart, ArrowClockwise, Robot, ChartLineUp } from '@phosphor-icons/react'

export function TabNavigation() {
  return (
    <TabsList className="glass-effect grid w-full grid-cols-3 sm:grid-cols-6 mb-4 sm:mb-6 gap-1 sm:gap-0 h-auto sm:h-10 p-1">
      <TabsTrigger
        value="prospects"
        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0"
      >
        <Target size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
        <span className="hidden xs:inline">Prospects</span>
      </TabsTrigger>
      <TabsTrigger
        value="portfolio"
        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0"
      >
        <Heart size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
        <span className="hidden xs:inline">Portfolio</span>
      </TabsTrigger>
      <TabsTrigger
        value="intelligence"
        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0"
      >
        <ChartBar size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
        <span className="hidden xs:inline">Intelligence</span>
      </TabsTrigger>
      <TabsTrigger
        value="analytics"
        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0"
      >
        <ChartLineUp size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
        <span className="hidden xs:inline">Analytics</span>
      </TabsTrigger>
      <TabsTrigger
        value="requalification"
        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0"
      >
        <ArrowClockwise size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
        <span className="hidden xs:inline">Re-qual</span>
      </TabsTrigger>
      <TabsTrigger
        value="agentic"
        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2 sm:py-0"
      >
        <Robot size={16} weight="fill" className="sm:w-[18px] sm:h-[18px]" />
        <span className="hidden xs:inline">Agentic</span>
      </TabsTrigger>
    </TabsList>
  )
}
