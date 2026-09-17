# Dashboard Mockup

## Layout Architecture

### Overall Structure

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (Mica Effect - Sticky)                              │
│ ┌─────────────────┐  ┌──────────┐  ┌──────────┐           │
│ │ Logo + Title    │  │ Search   │  │ Actions  │           │
│ └─────────────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ HERO STATS (Bento Grid - 6 Cards)                          │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │Score │ │Whale │ │Leads │ │Sig.  │ │Risk  │ │Grade │    │
│ │  92  │ │ 156  │ │ 2.4K │ │  +43 │ │  12  │ │  B+  │    │
│ │ ▲12% │ │ ▲8%  │ │ ▼2%  │ │Today │ │⚠️    │ │ ━━━  │    │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ MAIN CONTENT AREA                                           │
│ ┌─────────┐ ┌─────────────────────────────────────┐        │
│ │FILTERS  │ │ PROSPECT GRID                       │        │
│ │         │ │ ┌────────┐ ┌────────┐ ┌────────┐   │        │
│ │Industry │ │ │Prospect│ │Prospect│ │Prospect│   │        │
│ │□ Rest.  │ │ │ Card 1 │ │ Card 2 │ │ Card 3 │   │        │
│ │□ Retail │ │ └────────┘ └────────┘ └────────┘   │        │
│ │         │ │ ┌────────┐ ┌────────┐ ┌────────┐   │        │
│ │State    │ │ │Prospect│ │Prospect│ │Prospect│   │        │
│ │□ CA     │ │ │ Card 4 │ │ Card 5 │ │ Card 6 │   │        │
│ │□ TX     │ │ └────────┘ └────────┘ └────────┘   │        │
│ │         │ │                                     │        │
│ │Score    │ │ ┌─────────────────────────────┐   │        │
│ │━━━━●    │ │ │ LOAD MORE / PAGINATION      │   │        │
│ │         │ │ └─────────────────────────────┘   │        │
│ │[Apply]  │ │                                     │        │
│ └─────────┘ └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Hero Stats Section (Enhanced)

### Visual Design

- **Layout**: 6-column responsive bento grid
- **Style**: Glass cards with gradient overlays
- **Animation**: Count-up numbers on mount, pulsing borders for alerts
- **Hover**: Lift effect (translateY -4px) + increased glow

### Stat Card Anatomy

```
┌──────────────────────────────┐
│ ⚡ Icon (animated float)     │
│                              │
│ 2,456                        │ ← Large number (40px, tabular)
│ Total Prospects              │ ← Label (12px, muted)
│                              │
│ ▲ 12% from last week         │ ← Trend (10px, success color)
│                              │
│ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌    │ ← Sparkline chart
└──────────────────────────────┘
```

### Stat Cards Configuration

1. **Total Prospects**
   - Icon: Target (animated pulse)
   - Value: 2,456 (count-up animation)
   - Trend: +12% ▲ (green)
   - Sparkline: 7-day activity
   - Color accent: Primary (amber)

2. **High-Value "Whale" Leads**
   - Icon: TrendUp (animated bounce)
   - Value: 156
   - Trend: +8% ▲ (green)
   - Subtitle: "Priority Score 85+"
   - Color accent: Accent (warm amber)
   - Glow effect on hover

3. **Avg Priority Score**
   - Icon: ChartBar (animated scale)
   - Value: 73 (large, bold)
   - Trend: Stable ━ (neutral)
   - Progress ring: 73% filled
   - Color accent: Secondary (cyan)

4. **New Signals Today**
   - Icon: Sparkle (animated rotate)
   - Value: +43
   - Badge: "Live" (pulsing red dot)
   - Recent: "2m ago, 5m ago, 12m ago"
   - Color accent: Warning (yellow)

5. **Portfolio At Risk**
   - Icon: WarningCircle (animated shake)
   - Value: 12 companies
   - Severity: Medium ⚠️
   - Quick action: "Review Now" link
   - Color accent: Destructive (red)
   - Urgent border pulse

6. **Avg Health Grade**
   - Icon: ChartLineUp (animated draw)
   - Value: B+ (letter grade, extra large)
   - Numeric: 82/100
   - Mini distribution: A(3) B(45) C(12) D(2)
   - Color accent: Success (green)

### Responsive Behavior

- **Desktop (>1280px)**: 6 columns, 24px gaps
- **Tablet (768-1279px)**: 3 columns, 16px gaps
- **Mobile (<768px)**: 2 columns, 12px gaps, reduced padding

## Filter Sidebar (Improved)

### Visual Design

- **Position**: Sticky sidebar (left on desktop, drawer on mobile)
- **Style**: Glass panel with higher opacity (0.8)
- **Width**: 280px (desktop), full-width (mobile drawer)
- **Sections**: Collapsible accordion groups

### Filter Groups

#### 1. Quick Filters (Always Visible)

```
┌────────────────────────┐
│ [×] Clear All          │
│                        │
│ ● Show Unclaimed Only  │
│ ○ High-Value Only      │
│ ○ New Signals (24h)    │
│ ○ At Risk              │
└────────────────────────┘
```

#### 2. Industry (Checkbox Group)

```
┌────────────────────────┐
│ ▼ Industry (5 selected)│
│                        │
│ ☑ Restaurant (342)     │
│ ☑ Retail (289)         │
│ ☐ Construction (156)   │
│ ☑ Healthcare (234)     │
│ ☐ Manufacturing (98)   │
│ ☑ Services (445)       │
│ ☑ Technology (67)      │
│                        │
│ + Show More            │
└────────────────────────┘
```

#### 3. Geographic (Multi-select)

```
┌────────────────────────┐
│ ▼ State / Region       │
│                        │
│ [Search states...]     │
│                        │
│ ☑ California (456)     │
│ ☑ Texas (389)          │
│ ☐ New York (234)       │
│ ☐ Florida (198)        │
│                        │
│ 🗺️ View Map            │
└────────────────────────┘
```

#### 4. Score Range (Dual Slider)

```
┌────────────────────────┐
│ ▼ Priority Score       │
│                        │
│ Min: 50  ●━━━━━━●  Max: 95
│      └─────────────┘   │
│                        │
│ Distribution:          │
│ ▁▂▃▅▇▇▅▃▂▁ (histogram)│
└────────────────────────┘
```

#### 5. Health Grade (Pill Buttons)

```
┌────────────────────────┐
│ ▼ Health Grade         │
│                        │
│ [A] [B] [C] [D] [F]    │
│  45  123  67  23  4    │
│                        │
│ ● Include N/A (12)     │
└────────────────────────┘
```

#### 6. Growth Signals (Checkbox + Badge)

```
┌────────────────────────┐
│ ▼ Growth Indicators    │
│                        │
│ ☑ Hiring Surge    (89) │
│ ☑ Location Exp    (45) │
│ ☐ License Acq     (23) │
│ ☑ Social Boost    (67) │
│ ☐ Press Mention   (12) │
│                        │
│ Min signals: 2 ●━━━━━━ │
└────────────────────────┘
```

#### 7. Advanced (Collapsible)

```
┌────────────────────────┐
│ ▼ Advanced Filters     │
│                        │
│ Default Age (years):   │
│ 1 ●━━━━━━━━━● 7        │
│                        │
│ Revenue Range:         │
│ $100K ●━━━━━● $10M     │
│                        │
│ ☐ Has Violations       │
│ ☐ Sentiment: Improving │
│ ☐ Updated Last 7 Days  │
└────────────────────────┘
```

### Filter Actions

```
┌────────────────────────┐
│ [Apply Filters]  (256) │
│ [Reset All]            │
│                        │
│ 💾 Save as Preset      │
└────────────────────────┘
```

## Prospect Grid (Enhanced)

### Layout Options (Toggle)

```
┌─────────────────────────────────┐
│ View: [Grid ●] [List ○] [Table]│
│ Sort: [Priority ▼] [Recent]    │
│ Density: [●] Comfortable [○]   │
└─────────────────────────────────┘
```

### Grid Mode

- 3 columns on desktop (1280px+)
- 2 columns on tablet (768-1279px)
- 1 column on mobile (<768px)
- 16px gaps between cards
- Masonry layout (varying heights)

### List Mode (Alternative)

- Single column with horizontal layout
- Company info on left, metrics on right
- Expandable detail panel
- Quick actions always visible
- Better for scanning many records

### Table Mode (Alternative)

- Dense spreadsheet view
- Sortable columns
- Inline editing
- Row selection for batch actions
- Export to CSV/Excel

## Quick Actions Bar

### Position

- Floating above prospect grid
- Sticky when scrolling
- Appears when any prospect selected

### Actions

```
┌──────────────────────────────────────────┐
│ 3 prospects selected                     │
│                                          │
│ [Claim All] [Export] [Add to List] [×]  │
└──────────────────────────────────────────┘
```

## Real-Time Activity Feed (New Feature)

### Position

- Right sidebar (desktop)
- Bottom sheet drawer (mobile)
- Collapsible / expandable

### Content

```
┌────────────────────────┐
│ 🔴 Live Activity       │
│                        │
│ 🟢 2m ago              │
│ New signal detected    │
│ Acme Corp - Hiring     │
│                        │
│ 🟡 5m ago              │
│ Health score updated   │
│ Beta Industries B→A    │
│                        │
│ ⚪ 12m ago             │
│ Lead claimed           │
│ TechStart by John D    │
│                        │
│ [View All Activity]    │
└────────────────────────┘
```

## Navigation Tabs (Improved)

### Visual Design

```
┌─────────────────────────────────────────┐
│ [🎯 Prospects] [❤️ Portfolio]          │
│ [📊 Intelligence] [🔄 Re-qual]         │
│                                         │
│ ▔▔▔▔▔▔▔▔▔▔▔▔ (active indicator)       │
└─────────────────────────────────────────┘
```

### States

- **Active**: Bold text, bottom border (2px amber), icon highlighted
- **Hover**: Slight lift, background glow
- **Inactive**: Muted text, no border
- **Notification**: Red badge with count

## Key Improvements Over Current Design

### Visual Hierarchy

1. ✅ Larger, bolder hero stats with trends
2. ✅ Sparklines in stat cards for context
3. ✅ Improved filter organization with counts
4. ✅ Clear visual separation between sections
5. ✅ Consistent card styling throughout

### Information Density

1. ✅ More data visible above the fold
2. ✅ Collapsible sections to reduce clutter
3. ✅ Inline metrics on cards
4. ✅ Compact mode option
5. ✅ Progressive disclosure of details

### Interactivity

1. ✅ Live activity feed for awareness
2. ✅ Bulk selection and actions
3. ✅ Inline quick actions
4. ✅ Hover previews
5. ✅ Drag-to-reorder capabilities

### Modern Design Trends

1. ✅ Bento grid layouts (asymmetric)
2. ✅ Kinetic typography (animated counters)
3. ✅ Micro-interactions everywhere
4. ✅ Spatial depth (z-axis layering)
5. ✅ OLED-optimized dark theme
6. ✅ Variable fonts for optical sizing
7. ✅ Gradient meshes for depth

### Accessibility

1. ✅ High contrast mode compatible
2. ✅ Keyboard navigation throughout
3. ✅ Screen reader labels
4. ✅ Focus indicators
5. ✅ Touch targets (44px minimum)

## Implementation Priority

### Phase 1: Core Dashboard

- [ ] Hero stats with animations
- [ ] Improved stat cards
- [ ] Filter sidebar enhancement
- [ ] Grid layout optimization

### Phase 2: Advanced Features

- [ ] Real-time activity feed
- [ ] Live data updates
- [ ] Bulk operations
- [ ] View mode toggles

### Phase 3: Polish

- [ ] Micro-interactions
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling
- [ ] Onboarding tooltips

## Design Specifications

### Spacing

- Base: 4px
- Card padding: 24px
- Grid gaps: 16px
- Section margins: 32px

### Typography

- Hero numbers: 40px / 700 / Tabular
- Card titles: 20px / 600
- Body: 14px / 400
- Labels: 12px / 500

### Colors (Enhanced)

- Glass: oklch(1 0 0 / 0.75) [increased opacity]
- Border: oklch(1 0 0 / 0.20) [increased contrast]
- Glow: Drop shadow with blur 20px, spread 0px
- Accent: Gradient overlays on hover

### Animations

- Duration: 200ms (micro), 300ms (standard), 500ms (emphasis)
- Easing: ease-out (enter), ease-in (exit), ease-in-out (attention)
- Count-up: 1000ms with exponential easing
- Pulse: 2000ms infinite

### Accessibility

- Contrast: AAA level (7:1 minimum)
- Focus: 2px solid ring with 2px offset
- Touch: 44px minimum target size
- Motion: Respect prefers-reduced-motion
