import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { X, ArrowRight, ArrowLeft, Sparkle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface TourStep {
  target: string
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const tourSteps: TourStep[] = [
  {
    target: '[data-tour="stats"]',
    title: 'Real-Time UCC Intelligence',
    content:
      'Monitor live metrics from public UCC filings. Track new signals, high-value prospects, and portfolio health at a glance.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="prospects-tab"]',
    title: 'ML-Scored Prospects',
    content:
      'Every prospect is analyzed by our machine learning models. We score likelihood to convert, identify growth signals, and assess business health.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="prospect-card"]',
    title: 'Actionable Lead Cards',
    content:
      'Each card shows priority score, growth signals, and health grade. Click to view detailed analytics, UCC history, and send personalized outreach.',
    placement: 'right'
  },
  {
    target: '[data-tour="intelligence-tab"]',
    title: 'Competitive Intelligence',
    content:
      'See what your competitors are doing. Track their filing activity, market share, and identify white space opportunities.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="analytics-tab"]',
    title: 'Data-Driven Decisions',
    content:
      'Visualize trends, conversion funnels, and pipeline health. Export reports for stakeholder presentations.',
    placement: 'bottom'
  },
  {
    target: '[data-tour="agentic-tab"]',
    title: 'AI-Powered Optimization',
    content:
      'Our agentic AI continuously analyzes your workflow and suggests improvements. Review and apply recommendations with one click.',
    placement: 'bottom'
  }
]

function calculatePosition(step: TourStep): { top: number; left: number } {
  const element = document.querySelector(step.target)

  if (!element) {
    return { top: 100, left: 100 }
  }

  const rect = element.getBoundingClientRect()
  const scrollTop = window.scrollY
  const scrollLeft = window.scrollX

  let top = 0
  let left = 0

  switch (step.placement) {
    case 'top':
      top = rect.top + scrollTop - 220
      left = rect.left + scrollLeft + rect.width / 2 - 175
      break
    case 'bottom':
      top = rect.bottom + scrollTop + 16
      left = rect.left + scrollLeft + rect.width / 2 - 175
      break
    case 'left':
      top = rect.top + scrollTop + rect.height / 2 - 100
      left = rect.left + scrollLeft - 370
      break
    case 'right':
      top = rect.top + scrollTop + rect.height / 2 - 100
      left = rect.right + scrollLeft + 16
      break
    default:
      top = rect.bottom + scrollTop + 16
      left = rect.left + scrollLeft + rect.width / 2 - 175
  }

  // Keep within viewport
  left = Math.max(16, Math.min(left, window.innerWidth - 370))
  top = Math.max(16, top)

  return { top, left }
}

interface DemoTourProps {
  isOpen: boolean
  onClose: () => void
}

export function DemoTour({ isOpen, onClose }: DemoTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [positionKey, setPositionKey] = useState(0)
  const mountedRef = useRef(false)

  // Handle close with step reset
  const handleClose = useCallback(() => {
    setCurrentStep(0)
    onClose()
  }, [onClose])

  const step = useMemo(() => tourSteps[currentStep], [currentStep])

  // Calculate position based on current step and position key (for recalc on resize)
  const position = useMemo(() => {
    if (!isOpen) return { top: 0, left: 0 }
    // positionKey forces recalculation on resize
    void positionKey
    return calculatePosition(step)
  }, [isOpen, step, positionKey])

  // Handle resize events
  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      setPositionKey((k) => k + 1)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  // Scroll element into view when step changes
  useEffect(() => {
    if (!isOpen) return

    // Small delay to ensure element is ready
    const timer = setTimeout(() => {
      const element = document.querySelector(step.target)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isOpen, step.target])

  // Trigger position recalc after initial mount
  useEffect(() => {
    if (isOpen && !mountedRef.current) {
      mountedRef.current = true
      const timer = setTimeout(() => setPositionKey((k) => k + 1), 150)
      return () => clearTimeout(timer)
    }
    if (!isOpen) {
      mountedRef.current = false
    }
  }, [isOpen])

  const handleNext = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleClose()
    }
  }, [currentStep, handleClose])

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') handleClose()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrevious()
    },
    [isOpen, handleClose, handleNext, handlePrevious]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  const isLastStep = currentStep === tourSteps.length - 1

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[9998] transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Tour Card */}
      <Card
        className={cn(
          'fixed z-[9999] w-[350px] shadow-2xl border-primary/30 glass-effect',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
        style={{ top: position.top, left: position.left }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkle size={20} weight="fill" className="text-primary" />
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
            >
              <X size={16} />
            </Button>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {tourSteps.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/90 leading-relaxed">{step.content}</p>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ArrowLeft size={14} />
              Back
            </Button>

            <div className="flex gap-1">
              {tourSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    index === currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              ))}
            </div>

            <Button size="sm" onClick={handleNext} className="gap-1">
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ArrowRight size={14} />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
