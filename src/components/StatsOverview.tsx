import { useState, type ElementType } from 'react'
import { DashboardStats } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { motion } from 'framer-motion'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  TrendUp,
  Target,
  ChartBar,
  Sparkle,
  WarningCircle,
  ChartLineUp,
  CaretDown
} from '@phosphor-icons/react'

interface StatsOverviewProps {
  stats: DashboardStats
}

function StatCard({
  item,
  index
}: {
  item: { label: string; value: string; icon: ElementType; color: string; subtitle?: string }
  index: number
}) {
  const Icon = item.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
    >
      <Card className="glass-effect p-4 md:p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 group overflow-hidden relative border-2 hover:border-primary/30 hover:scale-105">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          animate={{
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <motion.div
              className={item.color}
              animate={{
                y: [0, -3, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: index * 0.2
              }}
            >
              <Icon size={20} weight="fill" className="md:w-6 md:h-6" />
            </motion.div>
          </div>

          <div className="space-y-1">
            <motion.div
              className="text-2xl md:text-3xl font-semibold font-mono tracking-tight"
              key={item.value}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: 'backOut' }}
            >
              {item.value}
            </motion.div>
            <div className="text-xs md:text-sm text-muted-foreground font-medium">{item.label}</div>
            {item.subtitle && (
              <div className="text-xs text-muted-foreground pt-1">{item.subtitle}</div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isMobile = useIsMobile()

  const totalProspects = stats.totalProspects
  const highValuePercentage =
    totalProspects > 0 ? Math.round((stats.highValueProspects / totalProspects) * 100) : 0

  const statItems = [
    {
      label: 'Total Prospects',
      value: stats.totalProspects.toLocaleString(),
      icon: Target,
      color: 'text-primary'
    },
    {
      label: 'High-Value Leads',
      value: stats.highValueProspects.toLocaleString(),
      icon: TrendUp,
      color: 'text-accent',
      subtitle: `${highValuePercentage}% of total`
    },
    {
      label: 'Avg Priority Score',
      value: stats.avgPriorityScore.toString(),
      icon: ChartBar,
      color: 'text-secondary'
    },
    {
      label: 'New Signals Today',
      value: stats.newSignalsToday.toLocaleString(),
      icon: Sparkle,
      color: 'text-warning'
    },
    {
      label: 'Portfolio At Risk',
      value: stats.portfolioAtRisk.toLocaleString(),
      icon: WarningCircle,
      color: 'text-destructive'
    },
    {
      label: 'Avg Health Grade',
      value: stats.avgHealthGrade,
      icon: ChartLineUp,
      color: 'text-success'
    }
  ]

  const primaryStats = statItems.slice(0, 2)
  const secondaryStats = statItems.slice(2)

  // Desktop: Show all stats in grid
  if (!isMobile) {
    return (
      <div
        data-tour="stats"
        className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4"
      >
        {statItems.map((item, index) => (
          <StatCard key={index} item={item} index={index} />
        ))}
      </div>
    )
  }

  // Mobile: Collapsible stats
  return (
    <div data-tour="stats" className="space-y-3">
      {/* Primary stats - always visible */}
      <div className="grid grid-cols-2 gap-3">
        {primaryStats.map((item, index) => (
          <StatCard key={index} item={item} index={index} />
        ))}
      </div>

      {/* Secondary stats - collapsible */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full h-10 touch-target glass-effect border border-white/20 justify-between"
          >
            <span className="text-sm font-medium">
              {isOpen ? 'Hide metrics' : `More metrics (${secondaryStats.length})`}
            </span>
            <CaretDown
              size={16}
              weight="bold"
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-2 gap-3">
            {secondaryStats.map((item, index) => (
              <StatCard key={index + 2} item={item} index={index + 2} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
