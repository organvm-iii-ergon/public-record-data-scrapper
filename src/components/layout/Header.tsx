import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ArrowClockwise } from '@phosphor-icons/react'

interface HeaderProps {
  onRefresh: () => void
}

export function Header({ onRefresh }: HeaderProps) {
  return (
    <header className="mica-effect border-b-2 border-primary/20 sticky top-0 z-50 shadow-xl shadow-primary/10">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white truncate bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              UCC-MCA Intelligence Platform
            </h1>
            <p className="text-xs sm:text-sm text-white/80 hidden sm:block font-medium">
              Automated merchant cash advance opportunity discovery
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={onRefresh}
              size="sm"
              className="glass-effect border-white/30 text-white hover:bg-white/10 hover:border-white/50"
            >
              <ArrowClockwise size={16} weight="bold" className="sm:mr-2" />
              <span className="hidden sm:inline">Refresh Data</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
