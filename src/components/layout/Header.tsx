import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { ArrowClockwise, Info, List } from '@phosphor-icons/react'

interface HeaderProps {
  onRefresh: () => void
  onStartTour?: () => void
}

export function Header({ onRefresh, onStartTour }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isDemoMode =
    import.meta.env.DEV ||
    ['1', 'true', 'yes'].includes(String(import.meta.env.VITE_USE_MOCK_DATA ?? '').toLowerCase())

  return (
    <header className="mica-effect border-b-2 border-primary/20 sticky top-0 z-50 shadow-xl shadow-primary/10">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white truncate bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                UCC-MCA Intelligence Platform
              </h1>
              {isDemoMode && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Info size={10} weight="fill" />
                  DEMO
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-white/80 hidden sm:block font-medium">
              {isDemoMode
                ? 'Demo Mode - Simulated Data'
                : 'Automated merchant cash advance opportunity discovery'}
            </p>
          </div>
          {/* Desktop Actions */}
          <div className="hidden md:flex gap-2 flex-shrink-0">
            {onStartTour && (
              <Button
                variant="outline"
                onClick={onStartTour}
                size="sm"
                className="glass-effect border-white/30 text-white hover:bg-white/10 hover:border-white/50"
              >
                <Info size={16} weight="bold" className="mr-2" />
                <span>Tour</span>
              </Button>
            )}
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={onRefresh}
              size="sm"
              className="glass-effect border-white/30 text-white hover:bg-white/10 hover:border-white/50"
            >
              <ArrowClockwise size={16} weight="bold" className="mr-2" />
              <span>Refresh Data</span>
            </Button>
          </div>

          {/* Mobile Hamburger Menu */}
          <div className="md:hidden flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setMenuOpen(true)}
              size="sm"
              className="glass-effect border-white/30 text-white hover:bg-white/10 hover:border-white/50 touch-target"
            >
              <List size={20} weight="bold" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="glass-effect w-[280px]">
          <SheetHeader className="pb-6">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Quick actions</SheetDescription>
          </SheetHeader>
          <div className="space-y-3">
            {onStartTour && (
              <Button
                variant="outline"
                onClick={() => {
                  onStartTour()
                  setMenuOpen(false)
                }}
                className="w-full justify-start h-12 touch-target glass-effect border-white/30 text-white hover:bg-white/10"
              >
                <Info size={20} weight="bold" className="mr-3" />
                Take a Tour
              </Button>
            )}
            <div className="flex items-center justify-between h-12 touch-target px-4 rounded-md glass-effect border border-white/30">
              <span className="text-sm font-medium">Theme</span>
              <ThemeToggle />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                onRefresh()
                setMenuOpen(false)
              }}
              className="w-full justify-start h-12 touch-target glass-effect border-white/30 text-white hover:bg-white/10"
            >
              <ArrowClockwise size={20} weight="bold" className="mr-3" />
              Refresh Data
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
