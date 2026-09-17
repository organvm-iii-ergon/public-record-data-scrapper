import { Button } from '@public-records/ui/button'
import { ArrowClockwise } from '@phosphor-icons/react'

export function RequalificationTab() {
  return (
    <div className="text-center py-8 sm:py-12 glass-effect rounded-lg p-6 sm:p-8">
      <ArrowClockwise
        size={40}
        weight="fill"
        className="mx-auto mb-4 text-white/70 sm:w-12 sm:h-12"
      />
      <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">
        Lead Re-qualification Engine
      </h3>
      <p className="text-white/70 mb-4 sm:mb-6 max-w-md mx-auto text-sm sm:text-base">
        Upload dead leads to detect new growth signals and recompute opportunity scores
      </p>
      <Button size="lg" className="h-10 sm:h-11">
        Upload Lead List
      </Button>
    </div>
  )
}
