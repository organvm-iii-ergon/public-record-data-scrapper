import { useState } from 'react'
import { TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import {
  Target,
  Heart,
  ChartBar,
  ChartLineUp,
  DotsThree,
  ArrowClockwise,
  Robot
} from '@phosphor-icons/react'

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass-effect border-t border-white/20 safe-area-pb">
        <div className="grid grid-cols-5 h-16">
          <TabsTrigger
            value="prospects"
            className="flex flex-col items-center justify-center gap-1 touch-target rounded-none border-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
          >
            <Target size={20} weight="fill" />
            <span className="text-[10px] font-medium">Prospects</span>
          </TabsTrigger>

          <TabsTrigger
            value="portfolio"
            className="flex flex-col items-center justify-center gap-1 touch-target rounded-none border-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
          >
            <Heart size={20} weight="fill" />
            <span className="text-[10px] font-medium">Portfolio</span>
          </TabsTrigger>

          <TabsTrigger
            value="intelligence"
            className="flex flex-col items-center justify-center gap-1 touch-target rounded-none border-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
          >
            <ChartBar size={20} weight="fill" />
            <span className="text-[10px] font-medium">Intel</span>
          </TabsTrigger>

          <TabsTrigger
            value="analytics"
            className="flex flex-col items-center justify-center gap-1 touch-target rounded-none border-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
          >
            <ChartLineUp size={20} weight="fill" />
            <span className="text-[10px] font-medium">Analytics</span>
          </TabsTrigger>

          <Button
            variant="ghost"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 h-full touch-target rounded-none"
          >
            <DotsThree size={20} weight="bold" />
            <span className="text-[10px] font-medium">More</span>
          </Button>
        </div>
      </nav>

      {/* More Menu Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="glass-effect rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>More Options</SheetTitle>
            <SheetDescription>Access additional features</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 pb-4">
            <TabsTrigger
              value="requalification"
              onClick={() => setMoreOpen(false)}
              className="w-full flex items-center gap-3 h-14 touch-target justify-start px-4 rounded-lg glass-effect border-white/20"
            >
              <ArrowClockwise size={24} weight="fill" className="text-primary" />
              <div className="text-left">
                <div className="font-medium">Requalification</div>
                <div className="text-xs text-muted-foreground">Review expired leads</div>
              </div>
            </TabsTrigger>

            <TabsTrigger
              value="agentic"
              onClick={() => setMoreOpen(false)}
              className="w-full flex items-center gap-3 h-14 touch-target justify-start px-4 rounded-lg glass-effect border-white/20"
            >
              <Robot size={24} weight="fill" className="text-primary" />
              <div className="text-left">
                <div className="font-medium">Agentic AI</div>
                <div className="text-xs text-muted-foreground">AI-powered insights</div>
              </div>
            </TabsTrigger>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
