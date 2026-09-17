# Prospect Card Mockup

## Card Anatomy

### Compact View (Default)

```
┌────────────────────────────────────────────┐
│ ☐ [🍽️]  Acme Restaurant Co.    ⭐ 89      │ ← Header row
│        CA • Restaurant                     │ ← Meta row
│                                            │
│ Health: [A-] 85/100  ●━━━━━━━━━○ ↗️       │ ← Health row
│ Default: 2y ago  |  Signals: 🟢🟢🟢 (4)   │ ← Metrics row
│                                            │
│ "Recently expanded to 3 locations..."     │ ← Narrative
│                                            │
│ [▶ View Details]  [+ Claim Lead]          │ ← Actions
└────────────────────────────────────────────┘
```

### Expanded View (On Click/Hover)

```
┌────────────────────────────────────────────┐
│ ☐ [🍽️]  Acme Restaurant Co.    ⭐ 89      │
│        CA • Restaurant • $2.5M Revenue    │
│                                            │
│ ┌────────────────────────────────────────┐│
│ │ Health Score: A- (85/100)              ││
│ │ ╔═══════════════════════════════════╗  ││
│ │ ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░ ║  ││
│ │ ╚═══════════════════════════════════╝  ││
│ │ Trend: ↗️ Improving (+12 this quarter) ││
│ │ Violations: 0  |  Sentiment: Positive  ││
│ └────────────────────────────────────────┘│
│                                            │
│ 📈 Growth Signals (4 active)               │
│ ┌────────────────────────────────────────┐│
│ │ ✓ Hiring Surge         2 weeks ago     ││
│ │ ✓ Location Expansion   1 month ago     ││
│ │ ✓ License Acquired     2 months ago    ││
│ │ ✓ Social Media Boost   3 weeks ago     ││
│ └────────────────────────────────────────┘│
│                                            │
│ 💼 Opportunity Narrative                   │
│ Recently expanded to 3 locations with     │
│ strong hiring activity and positive       │
│ sentiment. Health score improved from B   │
│ to A- in last quarter. Ready for MCA.     │
│                                            │
│ 📊 Quick Stats                             │
│ • Default Age: 2 years 3 months           │
│ • Original Amount: $185K                  │
│ • Estimated Revenue: $2.5M annually       │
│ • Employee Count: 45 (+15 recent)         │
│                                            │
│ [▶ Full Analysis] [+ Claim] [↗ Export]    │
└────────────────────────────────────────────┘
```

## Layout Variations

### 1. Grid Card (Current Enhancement)

#### Desktop (Large)

- Width: 380px (flexible in grid)
- Height: Auto (minimum 320px)
- Padding: 24px
- Border radius: 12px
- Glass effect opacity: 0.75

#### Tablet (Medium)

- Width: 100% (in 2-column grid)
- Height: Auto
- Padding: 20px
- Border radius: 10px

#### Mobile (Small)

- Width: 100% (single column)
- Height: Auto
- Padding: 16px
- Border radius: 8px
- Stacked layout

### 2. List Card (Alternative View)

```
┌──────────────────────────────────────────────────────────────┐
│ ☐ [🍽️] Acme Restaurant Co.  |  ⭐ 89  |  [A-] 85  |  🟢🟢🟢(4)│
│     CA • Restaurant                                          │
│     "Recently expanded to 3 locations..." [View] [Claim]     │
└──────────────────────────────────────────────────────────────┘
```

- Horizontal layout
- More compact (80px height)
- Better for scanning
- Quick action buttons always visible

### 3. Dense Card (High-Density Mode)

```
┌──────────────────────────┐
│ ☐ Acme Rest...    89 [A-]│
│    CA • Rest. • 2y • 4sig│
│    [Details] [Claim]     │
└──────────────────────────┘
```

- Minimal padding (12px)
- Smaller text (12px base)
- Truncated text
- Essential info only
- Faster scanning

## Component Breakdown

### 1. Card Header

#### Company Identity Section

```
┌─────────────────────────────┐
│ [🍽️]  Acme Restaurant Co.  │
│ ▲      ▲                    │
│ Icon   Name (18px/600)      │
└─────────────────────────────┘
```

**Elements:**

- **Selection Checkbox**: Top-left, glass-effect, 20px
- **Industry Icon**: Emoji/Icon, 32px, animated float
- **Company Name**: 18px, font-weight 600, truncate
- **Priority Score Badge**: Top-right, 24px, animated pulse

**Styling:**

```css
.card-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.company-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: oklch(0.65 0.3 45 / 0.1);
  animation: float-subtle 4s ease-in-out infinite;
}

.company-name {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: oklch(0.2 0.05 250);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-badge {
  font-size: 24px;
  font-weight: 700;
  font-family: 'IBM Plex Mono', monospace;
  color: oklch(0.65 0.3 45);
  animation: pulse-scale 2s ease-in-out infinite;
}
```

### 2. Metadata Row

```
CA • Restaurant • $2.5M Revenue
```

**Elements:**

- **Location**: State abbreviation, icon prefix
- **Industry**: Capitalized, industry icon
- **Revenue**: Formatted currency (optional)
- **Separator**: • (bullet) between items

**Styling:**

```css
.metadata-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: oklch(0.5 0.02 270);
  margin-bottom: 16px;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.metadata-separator {
  opacity: 0.5;
}
```

### 3. Health Score Display

#### Progress Bar Variant

```
Health: [A-] 85/100  ●━━━━━━━━━○ ↗️
        ▲    ▲       ▲           ▲
       Grade Score  Bar       Trend
```

**Elements:**

- **Grade Badge**: Letter grade, color-coded
- **Numeric Score**: /100, tabular figures
- **Progress Bar**: Animated fill, gradient
- **Trend Arrow**: Direction indicator with animation

**Styling:**

```css
.health-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: oklch(1 0 0 / 0.5);
  border-radius: 8px;
  margin-bottom: 12px;
}

.health-grade {
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 14px;
}

.grade-a {
  background: oklch(0.6 0.15 145 / 0.2);
  color: oklch(0.4 0.15 145);
}
.grade-b {
  background: oklch(0.7 0.15 60 / 0.2);
  color: oklch(0.5 0.15 60);
}
.grade-c {
  background: oklch(0.75 0.15 75 / 0.2);
  color: oklch(0.55 0.15 75);
}
.grade-d {
  background: oklch(0.55 0.35 15 / 0.2);
  color: oklch(0.45 0.35 15);
}

.health-score {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 16px;
  font-weight: 600;
}

.health-bar {
  flex: 1;
  height: 6px;
  background: oklch(0.92 0.01 90);
  border-radius: 3px;
  overflow: hidden;
}

.health-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    oklch(0.55 0.35 15) 0%,
    oklch(0.75 0.15 75) 50%,
    oklch(0.6 0.15 145) 100%
  );
  transition: width 1s ease-out;
  animation: shimmer 2s infinite;
}

.health-trend {
  font-size: 18px;
  animation: bounce-subtle 1s ease-in-out infinite;
}
```

#### Circular Progress Variant (Alternative)

```
   [A-]
  ◯━━━◯
 ◯     ◯
 ◯  85 ◯
  ◯━━━◯
```

### 4. Signal Indicators

#### Icon Pills Variant

```
Signals: 🟢🟢🟢🟢 (4 active)
         ▲        ▲
        Icons   Count
```

**Elements:**

- **Signal Icons**: Visual indicators
- **Count Badge**: Number of signals
- **Tooltip**: Signal types on hover

**Styling:**

```css
.signal-indicators {
  display: flex;
  align-items: center;
  gap: 8px;
}

.signal-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse-grow 2s ease-in-out infinite;
}

.signal-hiring {
  background: oklch(0.65 0.3 45);
}
.signal-expansion {
  background: oklch(0.6 0.15 145);
}
.signal-license {
  background: oklch(0.65 0.14 210);
}
.signal-social {
  background: oklch(0.7 0.15 60);
}

.signal-count {
  font-size: 12px;
  font-weight: 600;
  color: oklch(0.5 0.02 270);
}
```

#### Timeline Variant (Expanded View)

```
📈 Growth Signals Timeline
┌────────────────────────┐
│ ✓ 2w ago | Hiring     │
│ ✓ 1m ago | Expansion  │
│ ✓ 2m ago | License    │
│ ✓ 3w ago | Social     │
└────────────────────────┘
```

### 5. Metrics Row

```
Default: 2y ago  |  Signals: 4  |  Rev: $2.5M
```

**Elements:**

- **Default Age**: Time since UCC default
- **Signal Count**: Number of growth indicators
- **Revenue**: Estimated annual revenue
- **Separator**: Vertical bar or bullet

**Styling:**

```css
.metrics-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid oklch(1 0 0 / 0.1);
  border-bottom: 1px solid oklch(1 0 0 / 0.1);
  margin: 12px 0;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.metric-label {
  color: oklch(0.5 0.02 270);
  font-weight: 500;
}

.metric-value {
  color: oklch(0.2 0.05 250);
  font-weight: 600;
  font-family: 'IBM Plex Mono', monospace;
}
```

### 6. Narrative Section

```
💼 "Recently expanded to 3 locations with
    strong hiring activity and positive
    sentiment. Ready for MCA opportunity."
```

**Elements:**

- **Icon**: Context indicator
- **Text**: AI-generated narrative
- **Line clamp**: 2-3 lines with ellipsis

**Styling:**

```css
.narrative-section {
  padding: 12px;
  background: oklch(1 0 0 / 0.3);
  border-left: 3px solid oklch(0.65 0.3 45);
  border-radius: 6px;
  margin: 12px 0;
}

.narrative-text {
  font-size: 14px;
  line-height: 1.5;
  color: oklch(0.3 0.03 250);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.narrative-icon {
  float: left;
  margin-right: 8px;
  font-size: 18px;
}
```

### 7. Action Buttons

```
[▶ View Details]  [+ Claim Lead]  [↗ Export]
 ▲                ▲                ▲
Primary          Secondary        Ghost
```

**Elements:**

- **Primary Action**: View details/full analysis
- **Secondary Action**: Claim lead (if unclaimed)
- **Tertiary Actions**: Export, share, etc.

**Styling:**

```css
.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btn-primary {
  flex: 1;
  padding: 10px 16px;
  background: oklch(0.65 0.3 45);
  color: oklch(0.05 0.005 0);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: oklch(0.7 0.3 45);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px oklch(0.65 0.3 45 / 0.3);
}

.btn-secondary {
  flex: 1;
  padding: 10px 16px;
  background: oklch(1 0 0 / 0.5);
  color: oklch(0.2 0.05 250);
  border: 1px solid oklch(1 0 0 / 0.3);
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-ghost {
  padding: 10px;
  background: transparent;
  color: oklch(0.5 0.02 270);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-ghost:hover {
  background: oklch(1 0 0 / 0.3);
  color: oklch(0.2 0.05 250);
}
```

## Interactive States

### 1. Default State

- No special styling
- Standard opacity (0.75)
- Subtle shadow

```css
.prospect-card {
  background: oklch(1 0 0 / 0.75);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid oklch(1 0 0 / 0.15);
  box-shadow: 0 2px 8px oklch(0.05 0.005 0 / 0.1);
  transition: all 0.3s ease;
}
```

### 2. Hover State

- Lift effect (translateY -4px)
- Increased shadow
- Brighter border
- Scale up (1.02)

```css
.prospect-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 24px oklch(0.05 0.005 0 / 0.2);
  border-color: oklch(1 0 0 / 0.3);
}
```

### 3. Selected State

- Primary border color
- Glow effect
- Checkbox checked

```css
.prospect-card.selected {
  border: 2px solid oklch(0.65 0.3 45);
  box-shadow: 0 0 0 3px oklch(0.65 0.3 45 / 0.2);
}
```

### 4. Claimed State

- Muted colors
- "Claimed" badge
- Disabled buttons
- Lower opacity

```css
.prospect-card.claimed {
  opacity: 0.8;
  border-color: oklch(0.5 0.02 270 / 0.3);
}

.claimed-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 4px 12px;
  background: oklch(0.92 0.01 90);
  color: oklch(0.5 0.02 270);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}
```

### 5. Loading State

- Skeleton screens
- Pulsing placeholders
- No interactions

```css
.prospect-card.loading {
  pointer-events: none;
}

.skeleton {
  background: linear-gradient(
    90deg,
    oklch(0.92 0.01 90) 0%,
    oklch(0.95 0.005 90) 50%,
    oklch(0.92 0.01 90) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
```

### 6. Error State

- Red border
- Error icon
- Retry action

```css
.prospect-card.error {
  border-color: oklch(0.55 0.35 15);
  background: oklch(0.55 0.35 15 / 0.05);
}
```

## Responsive Behavior

### Desktop (>1280px)

```css
.prospect-card {
  width: 380px;
  min-height: 320px;
  padding: 24px;
}
```

### Tablet (768-1279px)

```css
.prospect-card {
  width: 100%;
  min-height: 280px;
  padding: 20px;
}

.card-header {
  flex-wrap: wrap;
}
```

### Mobile (<768px)

```css
.prospect-card {
  width: 100%;
  min-height: auto;
  padding: 16px;
}

.metrics-row {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.action-buttons {
  flex-direction: column;
}

.btn-primary,
.btn-secondary {
  width: 100%;
}
```

## Animations

### 1. Card Entry

```css
@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.prospect-card {
  animation: card-enter 0.4s ease-out;
}
```

### 2. Score Pulse

```css
@keyframes pulse-scale {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
```

### 3. Signal Detection

```css
@keyframes signal-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.signal-icon.new {
  animation: signal-pop 0.5s ease-out;
}
```

### 4. Health Bar Fill

```css
@keyframes health-bar-fill {
  from {
    width: 0%;
  }
  to {
    width: var(--health-percentage);
  }
}

.health-bar-fill {
  animation: health-bar-fill 1s ease-out;
}
```

## Key Improvements

### Visual

- ✅ Clearer information hierarchy
- ✅ Better use of whitespace
- ✅ Improved color coding
- ✅ Enhanced glass morphism
- ✅ Consistent iconography

### Functional

- ✅ Quick selection checkbox
- ✅ Inline metrics display
- ✅ Progressive disclosure
- ✅ Bulk actions support
- ✅ Multiple view modes

### Interactive

- ✅ Smooth animations
- ✅ Hover previews
- ✅ Touch-friendly
- ✅ Loading states
- ✅ Error handling

### Accessibility

- ✅ High contrast colors
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Focus indicators
- ✅ Touch targets (44px)

## Design Variations for Team Review

### Option A: Bold & Colorful

- Large priority scores
- Bright accent colors
- More visual signals
- Higher contrast

### Option B: Minimal & Clean

- Subtle colors
- More whitespace
- Fewer elements
- Typography-focused

### Option C: Data-Dense

- Smaller cards
- More info visible
- Compact spacing
- Table-like layout

**Recommendation**: Start with Option A (current design) and allow users to switch to Option B or C based on preference.
