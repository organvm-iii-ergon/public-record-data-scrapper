import { HealthGrade } from '@public-records/core'
import { Badge } from '@public-records/ui/badge'
import { cn } from '@public-records/ui/utils'

interface HealthGradeBadgeProps {
  grade: HealthGrade
  className?: string
}

const gradeConfig: Record<HealthGrade, { color: string; label: string }> = {
  A: { color: 'bg-success text-success-foreground', label: 'A - Excellent' },
  B: { color: 'bg-secondary text-secondary-foreground', label: 'B - Good' },
  C: { color: 'bg-warning text-warning-foreground', label: 'C - Fair' },
  D: { color: 'bg-accent text-accent-foreground', label: 'D - Poor' },
  F: { color: 'bg-destructive text-destructive-foreground', label: 'F - Critical' }
}

export function HealthGradeBadge({ grade, className }: HealthGradeBadgeProps) {
  const config = gradeConfig[grade]

  return (
    <Badge className={cn(config.color, 'font-semibold font-mono', className)}>{config.label}</Badge>
  )
}
