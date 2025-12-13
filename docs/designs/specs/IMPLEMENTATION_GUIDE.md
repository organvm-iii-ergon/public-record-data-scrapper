# Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the UI mockup designs for the dashboard and prospect cards in the UCC-MCA Intelligence Platform.

## Prerequisites

- Node.js 18+ and npm
- React 19
- TypeScript 5.7+
- Tailwind CSS 4.1+
- Radix UI components (already installed)
- Framer Motion (already installed)

## Phase 1: Dashboard Enhancements

### 1.1 Enhanced Hero Stats Cards

**Files to modify:**
- `src/components/StatsOverview.tsx`

**Implementation steps:**

1. **Add Sparkline Charts**
```typescript
// Install recharts if not present (already installed)
import { Line, LineChart } from 'recharts'

// Add sparkline data to stat items
const generateSparklineData = () => {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    value: Math.floor(Math.random() * 100) + 50
  }))
}
```

2. **Enhanced Count-Up Animation**
```typescript
import { motion, useSpring, useTransform } from 'framer-motion'

// Animated counter component
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { duration: 1000 })
  const display = useTransform(spring, (current) =>
    Math.floor(current).toLocaleString()
  )
  
  useEffect(() => {
    spring.set(value)
  }, [spring, value])
  
  return <motion.span>{display}</motion.span>
}
```

3. **Add Trend Indicators**
```typescript
interface TrendData {
  value: number
  direction: 'up' | 'down' | 'neutral'
  percentage: number
}

// Trend component
function TrendIndicator({ trend }: { trend: TrendData }) {
  return (
    <div className={cn(
      "text-xs font-medium flex items-center gap-1",
      trend.direction === 'up' && "text-success",
      trend.direction === 'down' && "text-destructive",
      trend.direction === 'neutral' && "text-muted-foreground"
    )}>
      {trend.direction === 'up' && <TrendUp size={12} weight="bold" />}
      {trend.direction === 'down' && <TrendDown size={12} weight="bold" />}
      {trend.percentage}%
    </div>
  )
}
```

### 1.2 Improved Filter Sidebar

**Files to modify:**
- `src/components/AdvancedFilters.tsx`

**Implementation steps:**

1. **Add Collapsible Sections**
```typescript
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// Replace current filter layout with collapsible sections
<Collapsible defaultOpen>
  <CollapsibleTrigger className="flex items-center justify-between w-full">
    <span className="font-medium">Industry</span>
    <ChevronDown className="h-4 w-4" />
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Filter content */}
  </CollapsibleContent>
</Collapsible>
```

2. **Add Filter Counts**
```typescript
// Show number of items matching each filter option
<Checkbox id="restaurant">
  <span>Restaurant</span>
  <Badge variant="secondary" className="ml-auto">342</Badge>
</Checkbox>
```

3. **Add Quick Filter Pills**
```typescript
const quickFilters = [
  { id: 'unclaimed', label: 'Unclaimed Only', icon: Target },
  { id: 'high-value', label: 'High-Value', icon: TrendUp },
  { id: 'new-signals', label: 'New Signals (24h)', icon: Sparkle },
  { id: 'at-risk', label: 'At Risk', icon: WarningCircle },
]

// Render as toggle buttons
<div className="flex flex-wrap gap-2">
  {quickFilters.map(filter => (
    <Button
      key={filter.id}
      variant={activeFilters.includes(filter.id) ? 'default' : 'outline'}
      size="sm"
      onClick={() => toggleQuickFilter(filter.id)}
    >
      <filter.icon size={14} className="mr-1" />
      {filter.label}
    </Button>
  ))}
</div>
```

### 1.3 Real-Time Activity Feed (New Component)

**File to create:**
- `src/components/ActivityFeed.tsx`

**Implementation:**

```typescript
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface Activity {
  id: string
  type: 'signal' | 'health_update' | 'claim' | 'export'
  title: string
  description: string
  timestamp: Date
  metadata?: any
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  const getActivityIcon = (type: Activity['type']) => {
    const icons = {
      signal: <Sparkle size={16} className="text-warning" weight="fill" />,
      health_update: <ChartLineUp size={16} className="text-success" weight="fill" />,
      claim: <Target size={16} className="text-primary" weight="fill" />,
      export: <Export size={16} className="text-secondary" weight="fill" />
    }
    return icons[type]
  }

  return (
    <div className="glass-effect rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
          </span>
          Live Activity
        </h3>
        <Button variant="ghost" size="sm">View All</Button>
      </div>
      
      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {activities.map((activity) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors"
            >
              <div className="mt-1">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{activity.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
```

**Add to App.tsx:**
```typescript
// In the main layout, add a right sidebar for desktop
<div className="hidden xl:block xl:w-80">
  <ActivityFeed activities={recentActivities} />
</div>
```

### 1.4 View Mode Toggle

**File to modify:**
- `src/App.tsx`

**Implementation:**

```typescript
type ViewMode = 'grid' | 'list' | 'table'
const [viewMode, setViewMode] = useState<ViewMode>('grid')

// Add toggle buttons
<div className="flex items-center gap-2">
  <Button
    variant={viewMode === 'grid' ? 'default' : 'outline'}
    size="sm"
    onClick={() => setViewMode('grid')}
  >
    <Squares size={16} />
  </Button>
  <Button
    variant={viewMode === 'list' ? 'default' : 'outline'}
    size="sm"
    onClick={() => setViewMode('list')}
  >
    <List size={16} />
  </Button>
  <Button
    variant={viewMode === 'table' ? 'default' : 'outline'}
    size="sm"
    onClick={() => setViewMode('table')}
  >
    <Table size={16} />
  </Button>
</div>

// Render different layouts based on viewMode
{viewMode === 'grid' && (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {/* Grid cards */}
  </div>
)}
{viewMode === 'list' && (
  <div className="space-y-2">
    {/* List items */}
  </div>
)}
{viewMode === 'table' && (
  <Table>
    {/* Table rows */}
  </Table>
)}
```

## Phase 2: Prospect Card Enhancements

### 2.1 Enhanced Health Score Display

**File to modify:**
- `src/components/ProspectCard.tsx`

**Implementation:**

```typescript
// Enhanced health score with progress bar
function HealthScoreDisplay({ healthScore }: { healthScore: HealthScore }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Health Score</span>
        <div className="flex items-center gap-2">
          <HealthGradeBadge grade={healthScore.grade} />
          <span className="font-mono font-semibold">{healthScore.score}/100</span>
        </div>
      </div>
      
      <div className="relative">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              healthScore.grade === 'A' && "bg-success",
              healthScore.grade === 'B' && "bg-accent",
              healthScore.grade === 'C' && "bg-warning",
              healthScore.grade === 'D' && "bg-destructive"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${healthScore.score}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Trend:</span>
        {healthScore.sentimentTrend === 'improving' && (
          <span className="text-success flex items-center gap-1">
            <TrendUp size={12} weight="bold" />
            Improving
          </span>
        )}
        {healthScore.sentimentTrend === 'declining' && (
          <span className="text-destructive flex items-center gap-1">
            <TrendDown size={12} weight="bold" />
            Declining
          </span>
        )}
      </div>
    </div>
  )
}
```

### 2.2 Expandable Signal Timeline

**Implementation:**

```typescript
function SignalTimeline({ signals }: { signals: GrowthSignal[] }) {
  const [expanded, setExpanded] = useState(false)
  
  const visibleSignals = expanded ? signals : signals.slice(0, 3)
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          <Sparkle size={14} weight="fill" className="text-accent" />
          Growth Signals ({signals.length})
        </span>
        {signals.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : 'Show All'}
          </Button>
        )}
      </div>
      
      <div className="space-y-2">
        {visibleSignals.map((signal, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-start gap-2 text-xs"
          >
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
              "bg-primary/20"
            )}>
              {getSignalIcon(signal.type)}
            </div>
            <div className="flex-1">
              <p className="font-medium capitalize">{signal.type.replace('_', ' ')}</p>
              <p className="text-muted-foreground">{signal.description}</p>
              <p className="text-muted-foreground">
                {formatDistanceToNow(new Date(signal.detectedDate), { addSuffix: true })}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
```

### 2.3 Card Density Toggle

**Implementation:**

```typescript
type CardDensity = 'comfortable' | 'compact'
const [density, setDensity] = useState<CardDensity>('comfortable')

// In card component
<Card className={cn(
  'glass-effect cursor-pointer transition-all',
  density === 'comfortable' && 'p-6',
  density === 'compact' && 'p-3'
)}>
  {/* Card content with conditional sizing */}
</Card>

// Toggle in toolbar
<Select value={density} onValueChange={setDensity}>
  <SelectTrigger className="w-[140px]">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="comfortable">Comfortable</SelectItem>
    <SelectItem value="compact">Compact</SelectItem>
  </SelectContent>
</Select>
```

## Phase 3: Advanced Features

### 3.1 Keyboard Navigation

**Implementation:**

```typescript
// Add keyboard shortcuts
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    
    // Ctrl/Cmd + F for filters
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      setFiltersOpen(true)
    }
    
    // Esc to close dialogs
    if (e.key === 'Escape') {
      setDialogOpen(false)
      setFiltersOpen(false)
    }
  }
  
  window.addEventListener('keydown', handleKeyPress)
  return () => window.removeEventListener('keydown', handleKeyPress)
}, [])
```

### 3.2 Empty States

**File to create:**
- `src/components/EmptyState.tsx`

**Implementation:**

```typescript
export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: {
  icon: any
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="glass-effect rounded-lg p-12 text-center">
      <Icon size={48} className="mx-auto mb-4 text-muted-foreground" weight="duotone" />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

### 3.3 Loading Skeletons

**Implementation:**

```typescript
function ProspectCardSkeleton() {
  return (
    <Card className="glass-effect p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-3 flex-1">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
        
        <Skeleton className="h-20 w-full" />
        
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </div>
    </Card>
  )
}
```

## Phase 4: Performance Optimization

### 4.1 Virtualization for Large Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedProspectGrid({ prospects }: { prospects: Prospect[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: prospects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 350, // Estimated card height
    overscan: 5
  })
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <ProspectCard prospect={prospects[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 4.2 Debounced Search

```typescript
import { useDebouncedCallback } from 'use-debounce'

const debouncedSearch = useDebouncedCallback(
  (value: string) => {
    setSearchQuery(value)
  },
  300 // Wait 300ms after user stops typing
)

<Input
  placeholder="Search companies..."
  onChange={(e) => debouncedSearch(e.target.value)}
/>
```

### 4.3 Memoization

```typescript
// Memoize expensive filtering
const filteredProspects = useMemo(() => {
  return prospects.filter(/* complex filtering logic */)
}, [prospects, filters])

// Memoize card rendering
const ProspectCard = memo(({ prospect }: { prospect: Prospect }) => {
  // Card implementation
}, (prevProps, nextProps) => {
  return prevProps.prospect.id === nextProps.prospect.id &&
         prevProps.prospect.status === nextProps.prospect.status
})
```

## Testing Checklist

### Visual Testing
- [ ] All breakpoints (mobile, tablet, desktop)
- [ ] Dark/light themes if applicable
- [ ] High contrast mode
- [ ] Reduced motion preference
- [ ] Touch targets (44px minimum)
- [ ] Focus indicators visible
- [ ] Loading states
- [ ] Empty states
- [ ] Error states

### Functional Testing
- [ ] Filters work correctly
- [ ] Sorting works correctly
- [ ] Search works correctly
- [ ] Pagination works correctly
- [ ] Actions (claim, export) work
- [ ] Keyboard navigation works
- [ ] Links and buttons work
- [ ] Forms validate correctly

### Performance Testing
- [ ] Initial page load < 3s
- [ ] Smooth animations (60fps)
- [ ] No layout shifts (CLS < 0.1)
- [ ] Efficient re-renders
- [ ] Memory usage stable
- [ ] Network requests optimized

### Accessibility Testing
- [ ] Screen reader compatible
- [ ] Keyboard navigable
- [ ] Sufficient color contrast
- [ ] Focus management
- [ ] ARIA labels present
- [ ] No keyboard traps

## Deployment

### Build Process
```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables
Ensure all necessary environment variables are set in production.

### Performance Monitoring
- Set up Core Web Vitals monitoring
- Track user interactions
- Monitor error rates
- Set up alerts for issues

## Maintenance

### Regular Updates
- Review and update dependencies monthly
- Test new browser versions
- Monitor user feedback
- Track analytics for usage patterns

### Documentation
- Keep component documentation updated
- Document new patterns and conventions
- Update this guide as implementation evolves

## Support

For questions or issues with implementation:
1. Check existing components in `src/components/ui/`
2. Refer to Radix UI documentation
3. Review Tailwind CSS documentation
4. Check Framer Motion documentation for animations

## Next Steps

After completing core implementation:
1. Gather user feedback
2. A/B test design variations
3. Iterate based on usage data
4. Plan additional features
5. Optimize based on performance metrics
