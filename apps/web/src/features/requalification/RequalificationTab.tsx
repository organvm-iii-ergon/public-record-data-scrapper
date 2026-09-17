import { ArrowClockwise } from '@phosphor-icons/react'
import type { Prospect } from '@public-records/core'

export function RequalificationTab({ prospects }: { prospects: Prospect[] }) {
  const candidates = prospects.filter((prospect) => prospect.status === 'dead')
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
        {candidates.length === 0
          ? 'No tenant prospects currently require re-qualification.'
          : `${candidates.length} tenant prospect${candidates.length === 1 ? '' : 's'} require review.`}
      </p>
      {candidates.length > 0 && (
        <ul className="mx-auto max-w-md space-y-2 text-left text-sm text-white/80">
          {candidates.map((prospect) => (
            <li key={prospect.id} className="rounded border border-white/10 p-3">
              <span className="font-medium text-white">{prospect.companyName}</span>
              <span className="block text-white/60">
                {prospect.growthSignals.length} recorded growth signal
                {prospect.growthSignals.length === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
