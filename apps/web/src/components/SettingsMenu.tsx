import { useState } from 'react'
import { GearSix, PlugsConnected } from '@phosphor-icons/react'
import { Button } from '@public-records/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator
} from '@public-records/ui/dropdown-menu'
import { useDataTier } from '@/hooks/useDataTier'
import { IntegrationsDialog } from '@/components/IntegrationsDialog'
import type { DataTier } from '@public-records/core'

const DATA_TIER_LABELS: Record<DataTier, { title: string; description: string }> = {
  oss: {
    title: 'OSS (base)',
    description: 'Open/public sources and community APIs.'
  },
  paid: {
    title: 'Paid (secondary)',
    description: 'Premium data providers and contracted APIs.'
  }
}

export function SettingsMenu() {
  const { dataTier, setDataTier } = useDataTier()
  const [integrationsOpen, setIntegrationsOpen] = useState(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="glass-effect border-white/30 text-white hover:bg-white/10 hover:border-white/50"
          aria-label="Open settings menu"
        >
          <GearSix size={16} weight="bold" className="sm:mr-2" />
          <span className="sr-only sm:not-sr-only">Settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 glass-effect border border-white/10 bg-slate-950/80 text-white"
      >
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-white/60">
          Data Source Tier
        </DropdownMenuLabel>
        <div className="px-3 pb-2 text-xs text-white/70">
          Select the default API tier. OSS is the base layer; Paid is secondary.
        </div>
        <DropdownMenuRadioGroup
          value={dataTier}
          onValueChange={(value) => setDataTier(value as DataTier)}
        >
          {(['oss', 'paid'] as DataTier[]).map((tier) => (
            <DropdownMenuRadioItem key={tier} value={tier} className="gap-2">
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">{DATA_TIER_LABELS[tier].title}</span>
                <span className="text-xs text-white/60">{DATA_TIER_LABELS[tier].description}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="px-3 py-2 text-xs text-white/60">
          Tier selection is forwarded to API requests for routing.
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIntegrationsOpen(true)}
            className="w-full justify-start text-xs text-white hover:bg-white/10"
          >
            <PlugsConnected size={14} className="mr-2 text-primary" />
            Webhooks & CRM Integrations
          </Button>
        </div>
      </DropdownMenuContent>
      <IntegrationsDialog open={integrationsOpen} onOpenChange={setIntegrationsOpen} />
    </DropdownMenu>
  )
}
