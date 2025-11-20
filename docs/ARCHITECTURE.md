# UCC-MCA Intelligence Platform - Architecture Alignment Document

## Document Overview

**Version**: 1.0  
**Last Updated**: 2025-11-09  
**Status**: Draft  
**Purpose**: Define the comprehensive system architecture for the UCC-MCA Intelligence Platform, ensuring alignment between business requirements, technical implementation, and future scalability.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture Principles](#architecture-principles)
4. [Technology Stack](#technology-stack)
5. [Component Architecture](#component-architecture)
6. [Data Architecture](#data-architecture)
7. [State Management](#state-management)
8. [Security Architecture](#security-architecture)
9. [Performance & Scalability](#performance--scalability)
10. [Integration Architecture](#integration-architecture)
11. [Deployment Architecture](#deployment-architecture)
12. [Development Workflow](#development-workflow)
13. [Quality Assurance](#quality-assurance)
14. [Future Roadmap](#future-roadmap)
15. [Alignment Matrix](#alignment-matrix)

---

## Executive Summary

The UCC-MCA Intelligence Platform is a sophisticated B2B SaaS application that transforms UCC filing data into actionable business intelligence for merchant cash advance opportunities. The architecture is designed for:

- **Data-Intensive Operations**: Managing multiple data pipelines (UCC scraping, growth signals, health scores, competitor intelligence)
- **Real-Time Intelligence**: Delivering ML-powered lead qualification and portfolio monitoring
- **Enterprise Scale**: Supporting high-volume data processing with responsive user experiences
- **Security First**: Protecting sensitive financial data with industry-standard security practices

This document establishes architectural alignment between the Product Requirements Document (PRD), Logic Analysis, and the current technical implementation.

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Presentation Layer                           │
│  React 19 + TypeScript + Vite + Tailwind CSS + Radix UI         │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                    Application Layer                             │
│  • State Management (@github/spark hooks, React state)           │
│  • Business Logic (Filtering, Sorting, ML scoring)               │
│  • Data Transformation & Validation                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                      Data Layer                                  │
│  • Client-side KV Storage (GitHub Spark)                         │
│  • Mock Data Generators (Development)                            │
│  • Future: API Integration Layer                                 │
└─────────────────────────────────────────────────────────────────┘
```

### System Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Type** | Single-Page Application (SPA) |
| **Architecture Pattern** | Component-Based Architecture |
| **Data Flow** | Unidirectional (React pattern) |
| **State Strategy** | Hybrid (Local + KV Persistence) |
| **Deployment Model** | Static Site (Vite build) |
| **Target Platforms** | Web (Desktop + Mobile responsive) |

---

## Architecture Principles

### 1. **Component-First Design**
- **Principle**: Build reusable, composable components following atomic design methodology
- **Implementation**: Shadcn UI components extended with domain-specific logic
- **Benefit**: Maintainability, testability, and consistency

### 2. **Type Safety**
- **Principle**: Leverage TypeScript for compile-time safety and enhanced developer experience
- **Implementation**: Strict TypeScript configuration with comprehensive type definitions
- **Benefit**: Reduced runtime errors, better IDE support, self-documenting code

### 3. **Performance by Default**
- **Principle**: Optimize for perceived and actual performance
- **Implementation**: 
  - React.useMemo for expensive computations
  - Lazy loading for large datasets
  - Virtual scrolling considerations for lists
  - Code splitting via Vite
- **Benefit**: Fast, responsive user experience

### 4. **Progressive Enhancement**
- **Principle**: Core functionality works, enhanced features improve experience
- **Implementation**: Mobile-first responsive design with graceful degradation
- **Benefit**: Accessibility across device capabilities and network conditions

### 5. **Security in Depth**
- **Principle**: Multiple layers of security controls
- **Implementation**: Input validation, output encoding, secure storage, no secrets in client
- **Benefit**: Protection against common vulnerabilities (XSS, injection attacks)

### 6. **Data Integrity**
- **Principle**: Ensure data consistency and prevent stale closures
- **Implementation**: Functional state updates, defensive null checks, validation layers
- **Benefit**: Reliable data operations without race conditions

---

## Technology Stack

### Frontend Framework

#### Core Technologies
| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **React** | 19.0.0 | UI Framework | Industry standard, excellent ecosystem, concurrent features |
| **TypeScript** | 5.7.2 | Type System | Type safety, better tooling, maintainability |
| **Vite** | 6.3.5 | Build Tool | Fast HMR, optimized builds, modern development experience |

#### UI & Styling
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Tailwind CSS** | Utility-first CSS | Rapid development, consistent design system, excellent DX |
| **Radix UI** | Headless Components | Accessibility, flexibility, composability |
| **Shadcn UI** | Component Library | Pre-built patterns, customizable, Radix-based |
| **Phosphor Icons** | Icon System | Consistent iconography, extensive library |
| **Framer Motion** | Animations | Smooth, performant animations for micro-interactions |

#### State & Data Management
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **@github/spark** | KV Storage & Hooks | Persistent client-side storage with React integration |
| **React Query** | Data Fetching (Future) | Server state management, caching, synchronization |
| **React Hook Form** | Form Management | Performance, validation, developer experience |
| **Zod** | Schema Validation | Type-safe validation, runtime checking |

#### Visualization & Analytics
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Recharts** | Charts/Graphs | React-native charts, customizable, responsive |
| **D3.js** | Advanced Visualizations | Powerful data manipulation and custom visualizations |

#### Developer Experience
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **ESLint** | Code Quality | Enforce coding standards, catch errors early |
| **TypeScript ESLint** | TS Linting | TypeScript-aware linting rules |

---

## Component Architecture

### Architecture Layers

```
src/
├── components/              # Presentation Components
│   ├── ui/                 # Base UI components (Shadcn)
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   ├── ProspectCard.tsx    # Domain-specific card component
│   ├── ProspectDetailDialog.tsx
│   ├── AdvancedFilters.tsx
│   ├── SortControls.tsx
│   ├── StaleDataWarning.tsx
│   ├── BatchOperations.tsx
│   ├── StatsOverview.tsx
│   ├── CompetitorChart.tsx
│   └── PortfolioMonitor.tsx
├── hooks/                   # Custom React Hooks
│   └── useKV (from @github/spark)
├── lib/                     # Utilities & Business Logic
│   ├── mockData.ts         # Mock data generators
│   ├── types.ts            # TypeScript type definitions
│   └── utils.ts            # Helper functions
├── styles/                  # Global styles
│   └── (theme configurations)
├── App.tsx                  # Root application component
├── main.tsx                # Application entry point
└── ErrorFallback.tsx       # Error boundary component
```

### Component Hierarchy

```
App (Root)
├── StaleDataWarning
├── Tabs
│   ├── Dashboard Tab
│   │   ├── StatsOverview
│   │   ├── AdvancedFilters
│   │   ├── SortControls
│   │   ├── BatchOperations
│   │   └── ProspectCard (multiple)
│   │       └── ProspectDetailDialog
│   ├── Intelligence Tab
│   │   └── CompetitorChart
│   └── Portfolio Tab
│       └── PortfolioMonitor
└── ErrorBoundary (wraps entire app)
```

### Component Design Patterns

#### 1. **Compound Components**
Used for complex UI patterns like filters and dialogs:
```typescript
<Dialog>
  <DialogTrigger />
  <DialogContent>
    <DialogHeader />
    <DialogBody />
    <DialogFooter />
  </DialogContent>
</Dialog>
```

#### 2. **Render Props Pattern**
For flexible component composition:
```typescript
<DataTable
  data={prospects}
  render={(item) => <ProspectCard prospect={item} />}
/>
```

#### 3. **Custom Hooks Pattern**
Encapsulate reusable logic:
```typescript
// State management
const [prospects, setProspects, deleteProspects] = useKV<Prospect[]>('key', [])

// Future: Data fetching
const { data, isLoading, error } = useQuery(['prospects'], fetchProspects)
```

#### 4. **Container/Presenter Pattern**
Separate logic from presentation:
- **Container**: `App.tsx` (manages state and logic)
- **Presenter**: `ProspectCard.tsx` (pure presentation)

---

## Data Architecture

### Data Models

#### Core Entities

##### Prospect
```typescript
interface Prospect {
  id: string;
  companyName: string;
  industry: IndustryType;
  state: string;
  score: number;              // ML opportunity score (0-100)
  healthGrade: HealthGrade;   // A-F rating
  defaultAmount: number;       // UCC default amount
  daysInDefault: number;
  lender: string;
  signals: GrowthSignal[];    // Array of positive indicators
  sentiment: Sentiment;       // improving | stable | declining
  status: ProspectStatus;     // new | claimed | contacted | qualified
  claimedBy?: string;
  lastUpdated: Date;
  violations?: string[];
}
```

##### GrowthSignal
```typescript
interface GrowthSignal {
  type: SignalType;  // hiring | permit | contract | expansion | equipment
  date: Date;
  description: string;
  impact: 'high' | 'medium' | 'low';
}
```

##### CompetitorData
```typescript
interface CompetitorData {
  lender: string;
  marketShare: number;
  avgDealSize: number;
  industryFocus: IndustryType[];
  dealVolume: number;
  trendDirection: 'up' | 'down' | 'stable';
}
```

##### PortfolioCompany
```typescript
interface PortfolioCompany {
  id: string;
  companyName: string;
  healthGrade: HealthGrade;
  dealAmount: number;
  originationDate: Date;
  riskLevel: RiskLevel;
  alerts: Alert[];
}
```

### Data Flow

#### 1. **Initialization Flow**
```
Application Start
    ↓
Load from KV Storage (useKV hook)
    ↓
If empty → Generate Mock Data
    ↓
Populate State (setProspects, setCompetitors, setPortfolio)
    ↓
Render UI
```

#### 2. **User Interaction Flow**
```
User Action (filter, sort, claim)
    ↓
Event Handler (onClick, onChange)
    ↓
State Update (functional update pattern)
    ↓
KV Storage Sync (automatic via useKV)
    ↓
React Re-render (affected components only)
    ↓
UI Update
```

#### 3. **Data Transformation Pipeline**
```
Raw Prospects Array
    ↓
Apply Search Filter (company name)
    ↓
Apply Basic Filters (industry, state, score)
    ↓
Apply Advanced Filters (health, signals, sentiment)
    ↓
Apply Sorting (by field + direction)
    ↓
useMemo Optimization
    ↓
Render Filtered/Sorted Results
```

### Data Persistence Strategy

#### Current Implementation (Client-Side)
- **Storage**: GitHub Spark KV (Key-Value) store
- **Scope**: Browser-local, per-user
- **Persistence**: Survives page reloads, not cross-device
- **Keys**:
  - `ucc-prospects`: Prospect array
  - `competitor-data`: Competitor array
  - `portfolio-companies`: Portfolio array
  - `lastDataRefresh`: Timestamp for staleness tracking

#### Future Implementation (Server-Side)
- **Database**: PostgreSQL or MongoDB for relational/document storage
- **API Layer**: RESTful or GraphQL API
- **Caching**: Redis for hot data
- **Real-time**: WebSocket for live updates

---

## State Management

### State Architecture

#### 1. **Persistent State (KV Storage)**
Used for data that must survive page reloads:
```typescript
const [prospects, setProspects, deleteProspects] = useKV<Prospect[]>('ucc-prospects', [])
const [competitors, setCompetitors] = useKV<CompetitorData[]>('competitor-data', [])
const [portfolio, setPortfolio] = useKV<PortfolioCompany[]>('portfolio-companies', [])
```

**Characteristics**:
- Automatic persistence to browser storage
- Synchronous read/write
- Survives page reloads
- User-specific (not shared)

#### 2. **Transient State (React useState)**
Used for UI state that doesn't need persistence:
```typescript
const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
const [dialogOpen, setDialogOpen] = useState(false)
const [searchQuery, setSearchQuery] = useState('')
const [sortField, setSortField] = useState<SortField>('priority')
const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
```

**Characteristics**:
- Ephemeral (resets on reload)
- Fast updates
- Component-scoped or lifted to parent

#### 3. **Derived State (useMemo)**
Computed values that depend on other state:
```typescript
const filteredAndSortedProspects = useMemo(() => {
  let filtered = prospects
    .filter(/* search */)
    .filter(/* industry */)
    .filter(/* advanced filters */);
  
  return filtered.sort(/* by sortField */);
}, [prospects, searchQuery, filters, sortField, sortDirection]);
```

**Characteristics**:
- Memoized for performance
- Automatically recomputes when dependencies change
- No explicit state setter

### State Update Patterns

#### Functional Updates (Prevents Stale Closures)
```typescript
// ✅ CORRECT: Functional update
setProspects((current) => 
  current.map(p => p.id === id ? { ...p, status: 'claimed' } : p)
)

// ❌ INCORRECT: Direct reference (stale closure risk)
setProspects(
  prospects.map(p => p.id === id ? { ...p, status: 'claimed' } : p)
)
```

#### Batch Updates
```typescript
// Claim multiple prospects atomically
setProspects((current) => 
  current.map(p => 
    selectedIds.has(p.id) && p.status !== 'claimed'
      ? { ...p, status: 'claimed', claimedBy: currentUser }
      : p
  )
)
```

### State Management Best Practices

1. **Single Source of Truth**: One authoritative location per piece of state
2. **Immutability**: Never mutate state directly, always create new objects
3. **Functional Updates**: Use callback form to avoid stale closures
4. **Minimal State**: Derive values instead of storing duplicates
5. **Proper Dependencies**: Include all dependencies in useMemo/useEffect

---

## Security Architecture

### Security Principles

1. **Defense in Depth**: Multiple layers of protection
2. **Least Privilege**: Minimal access rights by default
3. **Secure by Default**: Safe configurations out of the box
4. **Input Validation**: Never trust user input
5. **Output Encoding**: Prevent injection attacks

### Security Controls

#### 1. **Client-Side Security**

##### Input Validation
```typescript
// Zod schema for form validation
const prospectFilterSchema = z.object({
  minScore: z.number().min(0).max(100),
  industry: z.enum(['Restaurant', 'Retail', 'Healthcare', /* ... */]),
  state: z.string().length(2),
});
```

##### XSS Prevention
- React automatically escapes JSX content
- No `dangerouslySetInnerHTML` usage
- Sanitize any user-generated content

##### Secure Storage
- No sensitive credentials in client-side code
- KV storage for non-sensitive user preferences only
- API keys and secrets in environment variables (future)

#### 2. **Data Security**

##### Sensitive Data Handling
- Financial data (deal amounts, defaults) handled with care
- No PII exposed in logs or error messages
- Export functionality includes only necessary data fields

##### Data Integrity
```typescript
// Defensive programming
const safeProspects = (prospects || []).filter(Boolean);

// Type guards
function isProspect(obj: unknown): obj is Prospect {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}
```

#### 3. **Future Security Considerations**

When integrating with backend APIs:
- **Authentication**: OAuth 2.0 / JWT tokens
- **Authorization**: Role-Based Access Control (RBAC)
- **HTTPS**: Enforce encrypted connections
- **CORS**: Properly configured origin policies
- **Rate Limiting**: Prevent abuse and DoS
- **Audit Logging**: Track sensitive operations

### Compliance Considerations

- **GDPR**: Data privacy for EU users (future)
- **SOC 2**: Security controls for financial data (future)
- **PCI DSS**: If handling payment card data (N/A currently)

---

## Performance & Scalability

### Performance Optimization Strategies

#### 1. **React Performance**

##### Memoization
```typescript
// Expensive computation cached
const filteredProspects = useMemo(() => {
  return prospects.filter(/* complex logic */);
}, [prospects, filters]);

// Component memoization (when needed)
const MemoizedProspectCard = React.memo(ProspectCard);
```

##### Lazy Loading
```typescript
// Code splitting for large components
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

##### Virtual Scrolling
For large lists (1000+ items), consider:
- `react-window` or `react-virtualized`
- Only render visible items
- Significant memory reduction

#### 2. **Bundle Optimization**

##### Current Strategy (Vite)
- Tree shaking (removes unused code)
- Code splitting (dynamic imports)
- Asset optimization (image compression)
- Minification (production builds)

##### Optimization Results
| Metric | Development | Production |
|--------|-------------|------------|
| Initial Load | ~2MB (unminified) | ~300KB (minified + gzipped) |
| HMR Update | <100ms | N/A |
| Build Time | N/A | <30s |

#### 3. **Runtime Performance**

##### Rendering Performance
- Target: 60fps (16.67ms per frame)
- Avoid layout thrashing
- Debounce expensive operations (search, filters)
- Throttle scroll handlers

##### Memory Management
- Clean up event listeners in useEffect cleanup
- Avoid memory leaks from unclosed dialogs
- Proper Set/Map usage for O(1) lookups

### Scalability Considerations

#### Current Limits (Client-Only Architecture)
| Aspect | Limit | Mitigation |
|--------|-------|------------|
| Prospects Displayed | ~1000 | Pagination, virtual scrolling |
| Concurrent Users | N/A (client-only) | Future: Load balancing |
| Data Freshness | Manual refresh | Future: Real-time updates |
| Search Performance | O(n) | useMemo caching |

#### Future Scalability (Server Architecture)
- **Database Indexing**: Fast queries on large datasets
- **API Pagination**: Limit response sizes
- **CDN**: Static asset distribution
- **Caching Layer**: Redis for hot data
- **Microservices**: Separate scraping, scoring, API services
- **Message Queue**: Asynchronous task processing

---

## Integration Architecture

### Current Integrations

#### 1. **GitHub Spark**
- **Purpose**: Client-side storage and hooks
- **Integration Point**: `@github/spark/hooks`
- **Usage**: `useKV` for persistent state

#### 2. **Shadcn/Radix UI**
- **Purpose**: Component library
- **Integration Point**: Component imports
- **Customization**: Tailwind theming

### Future Integration Points

#### 1. **Backend API Integration**

##### REST API Pattern
```typescript
// API client setup
const apiClient = axios.create({
  baseURL: process.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// React Query integration
const { data: prospects, isLoading } = useQuery(
  ['prospects', filters],
  () => apiClient.get('/api/prospects', { params: filters })
);
```

##### API Endpoints (Planned)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prospects` | GET | Fetch filtered prospects |
| `/api/prospects/:id` | GET | Fetch single prospect details |
| `/api/prospects/:id/claim` | POST | Claim a prospect |
| `/api/competitors` | GET | Fetch competitor intelligence |
| `/api/portfolio` | GET | Fetch portfolio companies |
| `/api/export` | POST | Export data to CRM |

#### 2. **CRM Integration**

##### Salesforce
- REST API for lead export
- OAuth authentication
- Mapping: Prospect → Lead object

##### HubSpot
- REST API v3
- API key authentication
- Mapping: Prospect → Contact + Company

#### 3. **Data Pipeline Integration**

##### Web Scraping Service
- Separate microservice for UCC scraping
- Rate limiting and CAPTCHA handling
- Queue-based architecture

##### ML Scoring Service
- Python-based ML API
- Feature engineering pipeline
- Model versioning and A/B testing

#### 4. **Monitoring & Analytics**

##### Application Performance Monitoring (APM)
- Options: Datadog, New Relic, Sentry
- Error tracking and performance metrics
- Real user monitoring (RUM)

##### Business Analytics
- Options: Mixpanel, Amplitude
- User behavior tracking
- Conversion funnel analysis

---

## Deployment Architecture

### Current Deployment (Static Site)

#### Build Process
```bash
# Development
npm run dev         # Vite dev server on localhost:5173

# Production Build
npm run build       # TypeScript compile + Vite build
# Output: dist/ folder with static assets
```

#### Deployment Target
- **Platform**: Any static hosting (GitHub Pages, Netlify, Vercel, S3)
- **Requirements**: HTTPS, CDN, SPA routing support
- **Configuration**: Environment variables via `.env` files

#### Environment Management
```
.env.development     # Local development
.env.staging         # Staging environment
.env.production      # Production environment
```

### Future Deployment (Full Stack)

#### Architecture Diagram
```
                    ┌─────────────┐
                    │   CDN       │
                    │  (CloudFront)│
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │ Load Balancer│
                    └──────┬──────┘
                           │
        ┏━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━┓
        ┃                                     ┃
  ┌─────┴─────┐                      ┌───────┴───────┐
  │  Web App  │                      │   API Tier    │
  │  (Vite)   │                      │  (Node/Go)    │
  └───────────┘                      └───────┬───────┘
                                             │
                                      ┌──────┴──────┐
                                      │  Database   │
                                      │ (Postgres)  │
                                      └─────────────┘
```

#### Container Strategy
```yaml
# docker-compose.yml
services:
  web:
    build: ./frontend
    ports: ["3000:80"]
  
  api:
    build: ./backend
    ports: ["8080:8080"]
    environment:
      DATABASE_URL: postgres://...
  
  db:
    image: postgres:15
    volumes:
      - db-data:/var/lib/postgresql/data
```

#### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test
      - uses: aws-actions/configure-aws-credentials@v4
      - run: aws s3 sync dist/ s3://bucket-name
```

---

## Development Workflow

### Local Development Setup

#### Prerequisites
```bash
Node.js >= 18.0.0
npm >= 9.0.0
Git
```

#### Installation
```bash
git clone https://github.com/ivi374forivi/public-record-data-scrapper.git
cd public-record-data-scrapper
npm install
npm run dev
```

#### Development Scripts
```bash
npm run dev        # Start dev server (Vite HMR)
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Run ESLint
npm run optimize   # Optimize dependencies
```

### Code Organization Standards

#### File Naming Conventions
- **Components**: PascalCase (e.g., `ProspectCard.tsx`)
- **Utilities**: camelCase (e.g., `mockData.ts`)
- **Types**: PascalCase (e.g., `Prospect`, `HealthGrade`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_SCORE`)

#### Import Order
1. External libraries (React, third-party)
2. Internal components (`@/components`)
3. Internal utilities (`@/lib`)
4. Styles and assets
5. Types (if separate imports)

#### Component Structure
```typescript
// 1. Imports
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Prospect } from '@/lib/types'

// 2. Types/Interfaces
interface ProspectCardProps {
  prospect: Prospect;
  onClaim: (id: string) => void;
}

// 3. Component
export function ProspectCard({ prospect, onClaim }: ProspectCardProps) {
  // 3a. Hooks
  const [isExpanded, setIsExpanded] = useState(false)
  
  // 3b. Event handlers
  const handleClaim = () => onClaim(prospect.id)
  
  // 3c. Render logic
  return (
    <div>
      {/* JSX */}
    </div>
  )
}
```

### Git Workflow

#### Branch Strategy
```
main                 # Production-ready code
├── develop          # Integration branch (future)
└── feature/*        # Feature branches
    ├── feature/advanced-filters
    └── feature/export-functionality
```

#### Commit Message Convention
Following Conventional Commits:
```
feat: add batch operations for prospects
fix: resolve stale closure bug in useKV
docs: update architecture alignment document
style: improve mobile responsiveness
refactor: extract filter logic to custom hook
test: add unit tests for sorting
chore: update dependencies
```

### Code Review Process

#### Review Checklist
- [ ] Code follows TypeScript and ESLint standards
- [ ] No console.log or debugging code
- [ ] Proper error handling
- [ ] TypeScript types are accurate
- [ ] Performance considerations addressed
- [ ] Accessibility requirements met (ARIA labels, keyboard navigation)
- [ ] Mobile responsive
- [ ] Tests added/updated (when applicable)

---

## Quality Assurance

### Testing Strategy (Future Implementation)

#### Test Pyramid
```
        ┌─────────────┐
        │     E2E     │  10% (Playwright/Cypress)
        │   (Flows)   │
        └─────────────┘
      ┌───────────────┐
      │  Integration  │  20% (React Testing Library)
      │ (Components)  │
      └───────────────┘
    ┌─────────────────┐
    │   Unit Tests    │  70% (Vitest)
    │  (Functions)    │
    └─────────────────┘
```

#### Test Categories

##### 1. Unit Tests
Test individual functions and utilities:
```typescript
// lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { calculateScore, filterByHealthGrade } from './utils'

describe('calculateScore', () => {
  it('calculates opportunity score correctly', () => {
    const result = calculateScore({ /* ... */ })
    expect(result).toBe(85)
  })
})
```

##### 2. Component Tests
Test component behavior:
```typescript
// components/ProspectCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ProspectCard } from './ProspectCard'

describe('ProspectCard', () => {
  it('calls onClaim when button is clicked', () => {
    const onClaim = vi.fn()
    render(<ProspectCard prospect={mockProspect} onClaim={onClaim} />)
    
    fireEvent.click(screen.getByText('Claim'))
    expect(onClaim).toHaveBeenCalledWith(mockProspect.id)
  })
})
```

##### 3. Integration Tests
Test user workflows:
```typescript
// App.integration.test.tsx
it('allows filtering and claiming prospects', async () => {
  render(<App />)
  
  // Apply filter
  fireEvent.change(screen.getByLabelText('Industry'), { target: { value: 'Restaurant' } })
  
  // Verify filtered results
  expect(screen.getAllByTestId('prospect-card')).toHaveLength(5)
  
  // Claim prospect
  fireEvent.click(screen.getAllByText('Claim')[0])
  expect(await screen.findByText('Claimed')).toBeInTheDocument()
})
```

##### 4. E2E Tests
Test complete user journeys:
```typescript
// e2e/prospect-workflow.spec.ts
test('user can filter, sort, and claim prospects', async ({ page }) => {
  await page.goto('/')
  
  // Apply filters
  await page.selectOption('[name="industry"]', 'Restaurant')
  await page.fill('[name="search"]', 'ABC Company')
  
  // Sort by score
  await page.click('[data-testid="sort-score"]')
  
  // Claim top prospect
  await page.click('[data-testid="claim-btn"]:first-child')
  
  // Verify claim
  await expect(page.locator('.claimed-badge')).toBeVisible()
})
```

### Code Quality Tools

#### Linting (ESLint)
```javascript
// eslint.config.js
export default [
  {
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    }
  }
]
```

#### Type Checking (TypeScript)
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### Formatting (Prettier - Future)
Consistent code formatting across the project.

### Performance Monitoring

#### Metrics to Track
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.8s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms

#### Tools
- Lighthouse (automated audits)
- Chrome DevTools Performance tab
- React DevTools Profiler
- Web Vitals library

---

## Future Roadmap

### Phase 1: Foundation (Current - Complete)
✅ Component architecture established  
✅ Type-safe development environment  
✅ Mock data and client-side state management  
✅ Core UI/UX patterns implemented  
✅ Responsive design with mobile support  
✅ Advanced filtering and sorting  
✅ Batch operations  

### Phase 2: Backend Integration (Q1 2026)
🔲 REST API development  
🔲 PostgreSQL database schema  
🔲 Authentication & authorization  
🔲 Real data pipeline from UCC sources  
🔲 ML model integration  
🔲 WebSocket for real-time updates  

### Phase 3: Enhanced Intelligence (Q2 2026)
🔲 Advanced competitor analysis  
🔲 Predictive lead scoring (ML improvements)  
🔲 Automated re-qualification engine  
🔲 Custom signal detection  
🔲 Portfolio risk monitoring  

### Phase 4: Integrations & Scale (Q3 2026)
🔲 CRM integrations (Salesforce, HubSpot)  
🔲 Export automation  
🔲 API rate limiting and optimization  
🔲 Pagination and virtual scrolling  
🔲 Advanced caching strategies  

### Phase 5: Enterprise Features (Q4 2026)
🔲 Multi-tenant architecture  
🔲 Role-based access control (RBAC)  
🔲 Audit logging and compliance  
🔲 Custom dashboards and reporting  
🔲 White-label capabilities  
🔲 SLA monitoring and alerting  

### Technical Debt & Improvements

#### High Priority
- Add comprehensive test coverage (unit, integration, E2E)
- Implement proper error boundaries for all major sections
- Add loading states and skeleton screens
- Optimize bundle size (lazy loading, code splitting)
- Set up CI/CD pipeline

#### Medium Priority
- Migrate to React Query for data fetching patterns
- Add Storybook for component documentation
- Implement feature flags for gradual rollouts
- Add performance monitoring (Sentry, Datadog)
- Create design system documentation

#### Low Priority
- Add keyboard shortcuts for power users
- Implement undo/redo functionality
- Add export to CSV/Excel formats
- Create mobile native apps (React Native)
- Offline-first PWA capabilities

---

## Alignment Matrix

### PRD → Architecture Mapping

| PRD Feature | Architecture Component | Status |
|-------------|------------------------|--------|
| Prospect Dashboard | `App.tsx` + `ProspectCard` | ✅ Implemented |
| Filtering (Industry, State, Score) | `AdvancedFilters` | ✅ Implemented |
| Health Scoring | `Prospect.healthGrade` | ✅ Implemented |
| Growth Signals | `Prospect.signals[]` | ✅ Implemented |
| Competitor Intelligence | `CompetitorChart` | ✅ Implemented |
| Portfolio Monitoring | `PortfolioMonitor` | ✅ Implemented |
| Lead Re-qualification | Business logic | ⏳ Planned (Phase 3) |
| CRM Export | `handleExport` function | 🟡 Partial (JSON only) |
| Real-time Updates | WebSocket integration | ⏳ Planned (Phase 2) |
| ML Scoring API | Backend service | ⏳ Planned (Phase 2) |

### Design System → Implementation Mapping

| Design Specification | Implementation | Alignment |
|---------------------|----------------|-----------|
| Color: Deep Navy `oklch(0.25 0.06 250)` | Tailwind theme | ✅ |
| Typography: IBM Plex Sans | Font family config | ✅ |
| Components: Shadcn/Radix | UI component library | ✅ |
| Icons: Phosphor | `@phosphor-icons/react` | ✅ |
| Animations: Subtle micro-interactions | Framer Motion | ✅ |
| Mobile-first responsive | Tailwind breakpoints | ✅ |
| Glassmorphism effects | CSS backdrop-blur | ✅ |

### Logic Analysis → Code Implementation Mapping

| Logic Issue Identified | Solution Implemented | Status |
|------------------------|----------------------|--------|
| Stale Data Detection | `StaleDataWarning` component | ✅ Fixed |
| Unclaim Operations | `handleUnclaimLead` function | ✅ Fixed |
| Batch Operations | `BatchOperations` component | ✅ Fixed |
| Advanced Filtering | `AdvancedFilters` (8 dimensions) | ✅ Fixed |
| Sorting Capabilities | `SortControls` component | ✅ Fixed |
| Export Flexibility | Unified export (single + batch) | ✅ Fixed |
| useKV Stale Closures | Functional updates pattern | ✅ Fixed |
| Filter Performance | useMemo optimization | ✅ Fixed |
| Selection Management | `selectedProspectIds` Set | ✅ Fixed |
| TypeScript Safety | Complete type coverage | ✅ Fixed |

---

## Appendix

### Glossary

- **UCC**: Uniform Commercial Code - Legal framework for secured transactions
- **MCA**: Merchant Cash Advance - Alternative financing for businesses
- **DEWS**: Distress Early Warning System
- **ML**: Machine Learning
- **KV Storage**: Key-Value Storage
- **SPA**: Single Page Application
- **HMR**: Hot Module Replacement
- **TTI**: Time to Interactive
- **LCP**: Largest Contentful Paint

### References

- [Product Requirements Document (PRD.md)](../PRD.md)
- [Logic Analysis (LOGIC_ANALYSIS.md)](../LOGIC_ANALYSIS.md)
- [Security Policy (SECURITY.md)](../SECURITY.md)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [GitHub Spark](https://spark.github.com/)

### Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-09 | Copilot | Initial architecture alignment document |

---

**Document Owner**: Engineering Team  
**Last Review**: 2025-11-09  
**Next Review**: 2026-01-09 (Quarterly)

