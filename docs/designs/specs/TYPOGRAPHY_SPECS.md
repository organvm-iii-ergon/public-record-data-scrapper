# Typography Specifications

## Font Family Strategy

### Primary Typeface: IBM Plex Sans
- **Purpose**: UI text, labels, body content
- **Rationale**: Professional, technical credibility, excellent legibility
- **Weights**: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **Features**: Tabular figures, case-sensitive forms

### Monospace Typeface: IBM Plex Mono
- **Purpose**: Numerical data, scores, codes, technical info
- **Rationale**: Alignment, precision, data clarity
- **Weights**: 400 (Regular), 600 (SemiBold)
- **Features**: Tabular figures (default)

### Fallback Stack
```css
--font-sans: 'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, 
             BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 
             Arial, sans-serif;

--font-mono: 'IBM Plex Mono', 'SF Mono', Monaco, 'Cascadia Code', 
             'Courier New', monospace;
```

## Typographic Scale

### Modern Modular Scale (1.250 - Major Third)
Base: 14px

| Level | Size | Line Height | Usage |
|-------|------|-------------|-------|
| 6xl | 64px | 1.1 | Hero numbers (large stats) |
| 5xl | 52px | 1.15 | Page headers |
| 4xl | 42px | 1.2 | Section headers |
| 3xl | 34px | 1.2 | Card headers (large) |
| 2xl | 28px | 1.25 | Subheadings |
| xl | 22px | 1.3 | Card titles |
| lg | 18px | 1.4 | Emphasized text |
| base | 14px | 1.5 | Body text (default) |
| sm | 13px | 1.4 | Secondary text |
| xs | 12px | 1.4 | Labels, captions |
| xxs | 10px | 1.3 | Micro text, badges |

## Type Hierarchy

### Level 1: Page Title
```css
.page-title {
  font-family: var(--font-sans);
  font-size: 42px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: oklch(0.98 0.01 0);
}
```
**Usage**: Main page headers, dashboard title

### Level 2: Section Header
```css
.section-header {
  font-family: var(--font-sans);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: oklch(0.98 0.01 0);
}
```
**Usage**: Major sections (Prospects, Intelligence)

### Level 3: Card Title
```css
.card-title {
  font-family: var(--font-sans);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: oklch(0.20 0.05 250);
}
```
**Usage**: Company names, card headers

### Level 4: Body Text
```css
.body-text {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0;
  color: oklch(0.30 0.03 250);
}
```
**Usage**: Narratives, descriptions, content

### Level 5: Label Text
```css
.label-text {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: oklch(0.50 0.02 270);
}
```
**Usage**: Form labels, metadata labels

### Level 6: Numerical Display
```css
.number-display {
  font-family: var(--font-mono);
  font-size: 64px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: oklch(0.65 0.30 45);
}
```
**Usage**: Hero stats, large numbers

### Level 7: Data Value
```css
.data-value {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  color: oklch(0.20 0.05 250);
}
```
**Usage**: Scores, metrics, counts

## Special Typography Treatments

### 1. Priority Scores
```css
.priority-score {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: oklch(0.65 0.30 45);
  text-shadow: 0 0 20px oklch(0.65 0.30 45 / 0.3);
}
```

### 2. Health Grades
```css
.health-grade {
  font-family: var(--font-sans);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
```

### 3. Trend Indicators
```css
.trend-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.trend-positive { color: oklch(0.60 0.15 145); }
.trend-negative { color: oklch(0.55 0.35 15); }
.trend-neutral { color: oklch(0.50 0.02 270); }
```

### 4. Currency Values
```css
.currency {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.currency::before {
  content: '$';
  font-weight: 400;
  opacity: 0.7;
}
```

### 5. Percentage Values
```css
.percentage {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.percentage::after {
  content: '%';
  font-weight: 400;
  opacity: 0.7;
}
```

## Letter Spacing Guide

### Tight (Negative Tracking)
```css
letter-spacing: -0.02em; /* Large headers */
letter-spacing: -0.015em; /* Medium headers */
letter-spacing: -0.01em; /* Small headers */
```

### Normal (Default)
```css
letter-spacing: 0; /* Body text */
```

### Open (Positive Tracking)
```css
letter-spacing: 0.01em; /* Labels */
letter-spacing: 0.02em; /* Buttons */
letter-spacing: 0.05em; /* All caps */
```

## Line Height Guide

### Tight
- **1.1**: Hero numbers
- **1.15**: Large headers
- **1.2**: Section headers
- **1.3**: Card titles

### Comfortable
- **1.4**: Data values, labels
- **1.5**: Body text (reading)
- **1.6**: Long-form content

### Loose
- **1.75**: Dense data tables
- **2.0**: Vertical spacing emphasis

## Text Treatments

### Truncation
```css
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### Multi-line Clamp
```css
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### Gradient Text
```css
.gradient-text {
  background: linear-gradient(
    135deg,
    oklch(0.65 0.30 45),
    oklch(0.70 0.15 60)
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

## Responsive Typography

### Desktop (>1280px)
```css
:root {
  --text-base: 14px;
  --text-scale: 1.0;
}
```

### Tablet (768-1279px)
```css
@media (max-width: 1279px) {
  :root {
    --text-base: 14px;
    --text-scale: 0.95;
  }
}
```

### Mobile (<768px)
```css
@media (max-width: 767px) {
  :root {
    --text-base: 14px;
    --text-scale: 0.9;
  }
  
  .page-title { font-size: 28px; }
  .section-header { font-size: 22px; }
  .card-title { font-size: 16px; }
}
```

## Accessibility Considerations

### Minimum Sizes
- Body text: 14px minimum (WCAG AAA)
- Touch target labels: 16px minimum
- Small print: 12px minimum (with high contrast)

### Font Weight Contrast
- Light backgrounds: 400-700 weights work
- Dark backgrounds: 500-700 weights recommended
- Always test with actual background colors

### OpenType Features
```css
.data-display {
  font-feature-settings: 
    "tnum" 1,    /* Tabular numerals */
    "case" 1,    /* Case-sensitive forms */
    "zero" 1;    /* Slashed zero */
}
```

## Implementation

### CSS Custom Properties
```css
:root {
  /* Font families */
  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  
  /* Font sizes */
  --text-6xl: 4rem;    /* 64px */
  --text-5xl: 3.25rem; /* 52px */
  --text-4xl: 2.625rem; /* 42px */
  --text-3xl: 2.125rem; /* 34px */
  --text-2xl: 1.75rem; /* 28px */
  --text-xl: 1.375rem; /* 22px */
  --text-lg: 1.125rem; /* 18px */
  --text-base: 0.875rem; /* 14px */
  --text-sm: 0.8125rem; /* 13px */
  --text-xs: 0.75rem; /* 12px */
  --text-xxs: 0.625rem; /* 10px */
  
  /* Line heights */
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
  
  /* Letter spacing */
  --tracking-tighter: -0.02em;
  --tracking-tight: -0.01em;
  --tracking-normal: 0;
  --tracking-wide: 0.01em;
  --tracking-wider: 0.02em;
  --tracking-widest: 0.05em;
  
  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### Utility Classes
```css
.font-sans { font-family: var(--font-sans); }
.font-mono { font-family: var(--font-mono); }

.text-6xl { font-size: var(--text-6xl); }
.text-5xl { font-size: var(--text-5xl); }
/* ... etc */

.font-normal { font-weight: var(--font-normal); }
.font-medium { font-weight: var(--font-medium); }
.font-semibold { font-weight: var(--font-semibold); }
.font-bold { font-weight: var(--font-bold); }

.leading-none { line-height: var(--leading-none); }
.leading-tight { line-height: var(--leading-tight); }
/* ... etc */

.tracking-tighter { letter-spacing: var(--tracking-tighter); }
.tracking-tight { letter-spacing: var(--tracking-tight); }
/* ... etc */
```

## Typography Testing Checklist

- [ ] All text readable at 100% zoom
- [ ] All text readable at 200% zoom (WCAG)
- [ ] Sufficient contrast ratios (4.5:1 minimum)
- [ ] No text smaller than 12px
- [ ] Monospace used for all numerical data
- [ ] Tabular numerals enabled where needed
- [ ] Responsive scaling works correctly
- [ ] Line lengths don't exceed 80 characters
- [ ] Headings have clear hierarchy
- [ ] Touch targets have adequate labels
