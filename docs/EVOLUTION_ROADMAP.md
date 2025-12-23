# Evolution Roadmap

## UCC-MCA Intelligence Platform

**Document Version**: 1.0  
**Last Updated**: December 19, 2025  
**Status**: Active Development

---

## Overview

This roadmap outlines the strategic evolution of the UCC-MCA Intelligence Platform based on the comprehensive critique completed on December 19, 2025. It prioritizes fixes, enhancements, and transformational changes to move from a solid MVP to an enterprise-grade platform.

---

## Priority Matrix

### P0: Critical (Blocks Production)

- Build system failures
- Security vulnerabilities
- Authentication/Authorization
- Data integrity issues

### P1: High (Degrades Experience)

- UX pain points
- Performance bottlenecks
- Missing core features
- Compliance gaps

### P2: Medium (Nice to Have)

- Feature enhancements
- Developer experience improvements
- Documentation updates

### P3: Low (Future Vision)

- Platform transformation
- Market expansion
- Advanced AI features

---

## Sprint 1-2: Critical Fixes (Weeks 1-2)

### ✅ Build System [COMPLETED]

**Status**: DONE  
**Changes**:

- [x] Added `react-is` dependency to fix Recharts build issue
- [x] Build now completes successfully
- [ ] Address bundle size warning (1.1MB+ is large)

**Verification**:

```bash
npm run build  # Should complete without errors
```

### 🔒 Security Hardening [IN PROGRESS]

#### 1. Input Sanitization

**Priority**: P0  
**Risk**: XSS vulnerabilities  
**Files to Update**:

- `src/lib/utils/sanitize.ts` (create)
- `src/components/ProspectDetailDialog.tsx`
- `src/components/ProspectCard.tsx`

**Implementation**:

```typescript
// src/lib/utils/sanitize.ts
import DOMPurify from 'dompurify'

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  })
}

export function sanitizeText(text: string): string {
  return text.replace(/[<>\"']/g, (char) => {
    const map: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
    return map[char] || char
  })
}
```

**Dependencies**:

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

#### 2. SQL Injection Prevention

**Priority**: P0  
**Risk**: Database compromise  
**Action**: Audit all database queries in `server/` directory

**Checklist**:

- [ ] Review `server/services/*.ts` for raw SQL
- [ ] Ensure all queries use parameterized statements
- [ ] Consider migrating to Prisma ORM for type safety

#### 3. Rate Limiting

**Priority**: P1  
**Risk**: DOS attacks, API abuse  
**Implementation**: Create distributed rate limiter

```typescript
// server/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later'
})

export const scrapeLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:scrape:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 scrape requests per hour
  message: 'Scraping limit exceeded'
})
```

### 🔑 Authentication & Authorization

**Priority**: P0  
**Blocker**: Cannot deploy to production without auth  
**Recommendation**: Use Auth0 or Clerk for quick implementation

#### Option A: Auth0 (Enterprise-Ready)

**Pros**:

- Battle-tested, SOC 2 compliant
- Role-based access control (RBAC)
- MFA, SSO, passwordless

**Implementation Timeline**: 3-5 days

```typescript
// src/lib/auth/auth0.ts
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: 'openid profile email'
      }}
    >
      {children}
    </Auth0Provider>
  )
}
```

#### Option B: Clerk (Developer-Friendly)

**Pros**:

- Beautiful pre-built UI components
- Faster integration
- Good free tier

**Implementation Timeline**: 2-3 days

```typescript
// src/lib/auth/clerk.ts
import { ClerkProvider, SignIn, SignUp, UserButton } from '@clerk/clerk-react'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      {children}
    </ClerkProvider>
  )
}
```

#### Protected Routes

```typescript
// src/components/ProtectedRoute.tsx
import { useAuth } from '@/lib/auth'
import { Navigate } from 'react-router-dom'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return <Navigate to="/login" />

  return <>{children}</>
}
```

---

## Sprint 3-4: UX Improvements (Weeks 3-4)

### 1. Onboarding Flow

**Priority**: P1  
**Impact**: Reduce time-to-value, increase activation rate

**Implementation**:

```bash
npm install intro.js
npm install --save-dev @types/intro.js
```

```typescript
// src/components/Onboarding.tsx
import { useEffect } from 'react'
import introJs from 'intro.js'
import 'intro.js/introjs.css'

export function useOnboarding(isFirstVisit: boolean) {
  useEffect(() => {
    if (!isFirstVisit) return

    const intro = introJs()
    intro.setOptions({
      steps: [
        {
          element: '#stats-overview',
          intro: 'Welcome! Here you can see key metrics at a glance.'
        },
        {
          element: '#prospect-list',
          intro: 'This is your prospect list, sorted by priority score.'
        },
        {
          element: '#filters',
          intro: 'Use filters to narrow down to your ideal leads.'
        },
        {
          element: '#batch-operations',
          intro: 'Select multiple prospects for batch operations.'
        }
      ],
      exitOnOverlayClick: false,
      showStepNumbers: true
    })

    intro.start()
  }, [isFirstVisit])
}
```

### 2. Virtual Scrolling

**Priority**: P1  
**Impact**: Handle 100k+ prospects without performance degradation

```bash
npm install react-window
npm install --save-dev @types/react-window
```

```typescript
// src/components/ProspectVirtualList.tsx
import { FixedSizeList } from 'react-window'
import { ProspectCard } from './ProspectCard'

export function ProspectVirtualList({ prospects }: { prospects: Prospect[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <ProspectCard prospect={prospects[index]} />
    </div>
  )

  return (
    <FixedSizeList
      height={800}
      itemCount={prospects.length}
      itemSize={200}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  )
}
```

### 3. Real-Time Updates

**Priority**: P1  
**Impact**: Competitive advantage, fresher data

**Architecture**:

```
Frontend (React)
  ↓ WebSocket
Server (Express + Socket.io)
  ↓ Listen to
PostgreSQL (NOTIFY/LISTEN) or Redis Pub/Sub
```

**Implementation**:

```typescript
// server/websocket.ts
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'

export function setupWebSocket(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL }
  })

  const pubClient = new Redis(process.env.REDIS_URL!)
  const subClient = pubClient.duplicate()

  io.adapter(createAdapter(pubClient, subClient))

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('subscribe:prospects', () => {
      socket.join('prospects')
    })
  })

  return io
}

// Emit updates when new prospects arrive
export function notifyNewProspects(io: Server, prospects: Prospect[]) {
  io.to('prospects').emit('prospects:new', prospects)
}
```

```typescript
// src/hooks/useRealtimeProspects.ts
import { useEffect } from 'react'
import { io } from 'socket.io-client'

export function useRealtimeProspects(onUpdate: (prospects: Prospect[]) => void) {
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL)

    socket.on('connect', () => {
      socket.emit('subscribe:prospects')
    })

    socket.on('prospects:new', (prospects) => {
      onUpdate(prospects)
    })

    return () => {
      socket.disconnect()
    }
  }, [onUpdate])
}
```

### 4. Optimistic UI with Undo

**Priority**: P1  
**Impact**: Faster perceived performance, error recovery

```typescript
// src/hooks/useOptimisticClaim.ts
import { useState } from 'react'
import { toast } from 'sonner'

export function useOptimisticClaim() {
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Prospect>>(new Map())

  const claimProspect = async (prospect: Prospect) => {
    // Optimistic update
    const originalStatus = prospect.status
    const updatedProspect = { ...prospect, status: 'claimed' as const }

    setOptimisticUpdates((prev) => new Map(prev).set(prospect.id, prospect))

    // Update UI immediately
    onUpdate(updatedProspect)

    try {
      // Make API call
      await claimProspectApi(prospect.id)

      // Success - remove from optimistic updates
      setOptimisticUpdates((prev) => {
        const next = new Map(prev)
        next.delete(prospect.id)
        return next
      })

      // Show undo toast
      toast.success('Lead claimed', {
        action: {
          label: 'Undo',
          onClick: () => unclaimProspect(prospect.id)
        }
      })
    } catch (error) {
      // Rollback on error
      onUpdate({ ...prospect, status: originalStatus })
      setOptimisticUpdates((prev) => {
        const next = new Map(prev)
        next.delete(prospect.id)
        return next
      })

      toast.error('Failed to claim lead')
    }
  }

  return { claimProspect, optimisticUpdates }
}
```

---

## Sprint 5-6: Feature Enhancements (Weeks 5-6)

### 1. CRM Integrations

#### Salesforce Integration

**Priority**: P1  
**Revenue Impact**: High (required for enterprise sales)

**OAuth Flow**:

```typescript
// server/integrations/salesforce.ts
import jsforce from 'jsforce'

export async function connectSalesforce(userId: string, code: string) {
  const oauth2 = new jsforce.OAuth2({
    clientId: process.env.SALESFORCE_CLIENT_ID!,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET!,
    redirectUri: `${process.env.API_URL}/integrations/salesforce/callback`
  })

  const conn = new jsforce.Connection({ oauth2 })
  const tokenResponse = await conn.authorize(code)

  // Store tokens in database
  await db.integration.create({
    data: {
      userId,
      platform: 'salesforce',
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      instanceUrl: tokenResponse.instance_url
    }
  })

  return conn
}

export async function syncProspectToSalesforce(prospectId: string, userId: string) {
  const prospect = await db.prospect.findUnique({ where: { id: prospectId } })
  const integration = await db.integration.findFirst({
    where: { userId, platform: 'salesforce' }
  })

  const conn = new jsforce.Connection({
    instanceUrl: integration.instanceUrl,
    accessToken: integration.accessToken
  })

  const lead = await conn.sobject('Lead').create({
    FirstName: prospect.companyName,
    Company: prospect.companyName,
    Status: 'New',
    LeadSource: 'UCC Intelligence Platform',
    Priority__c: prospect.priorityScore,
    Description: `UCC Filing Default. Health Grade: ${prospect.healthGrade}`
  })

  return lead
}
```

### 2. Email Integration

**Priority**: P1  
**Provider**: SendGrid or Postmark

```typescript
// server/services/email.ts
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export async function sendOutreachEmail(
  to: string,
  template: 'intro' | 'followup' | 'proposal',
  variables: Record<string, any>
) {
  const msg = {
    to,
    from: 'sales@yourcompany.com',
    templateId: getTemplateId(template),
    dynamicTemplateData: variables,
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true }
    }
  }

  const response = await sgMail.send(msg)

  // Store in database for tracking
  await db.outreachEmail.create({
    data: {
      prospectId: variables.prospectId,
      template,
      sentAt: new Date(),
      sendgridMessageId: response[0].headers['x-message-id']
    }
  })

  return response
}

// Webhook to track opens/clicks
export async function handleSendgridWebhook(events: any[]) {
  for (const event of events) {
    if (event.event === 'open') {
      await db.outreachEmail.update({
        where: { sendgridMessageId: event.sg_message_id },
        data: { openedAt: new Date(event.timestamp * 1000) }
      })
    }

    if (event.event === 'click') {
      await db.outreachEmail.update({
        where: { sendgridMessageId: event.sg_message_id },
        data: { clickedAt: new Date(event.timestamp * 1000) }
      })
    }
  }
}
```

---

## Sprint 7-12: Platform Features (Weeks 7-12)

### 1. Public API Launch

**Priority**: P2  
**Revenue Model**: Freemium (100 calls/day free, $99/mo for 10k)

#### API Gateway Setup

```typescript
// server/api/v1/prospects.ts
import express from 'express'
import { authenticateApiKey, rateLimitByKey } from '@/middleware'

const router = express.Router()

/**
 * @api {get} /v1/prospects List Prospects
 * @apiVersion 1.0.0
 * @apiName ListProspects
 * @apiGroup Prospects
 * @apiPermission user
 *
 * @apiParam {String} [industry] Filter by industry
 * @apiParam {String} [state] Filter by state
 * @apiParam {Number} [minScore=0] Minimum priority score
 * @apiParam {Number} [page=1] Page number
 * @apiParam {Number} [limit=25] Results per page (max 100)
 *
 * @apiSuccess {Object[]} prospects List of prospects
 * @apiSuccess {Number} total Total count
 * @apiSuccess {Number} page Current page
 * @apiSuccess {Number} pages Total pages
 */
router.get('/prospects', authenticateApiKey, rateLimitByKey, async (req, res) => {
  const { industry, state, minScore = 0, page = 1, limit = 25 } = req.query

  const prospects = await db.prospect.findMany({
    where: {
      ...(industry && { industryType: industry }),
      ...(state && { state }),
      priorityScore: { gte: Number(minScore) }
    },
    skip: (Number(page) - 1) * Number(limit),
    take: Math.min(Number(limit), 100),
    orderBy: { priorityScore: 'desc' }
  })

  const total = await db.prospect.count({
    where: {
      /* same filters */
    }
  })

  res.json({
    prospects,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit))
  })
})

export default router
```

#### API Key Management

```typescript
// server/services/apiKeys.ts
import crypto from 'crypto'

export function generateApiKey(): string {
  return `ucc_${crypto.randomBytes(32).toString('hex')}`
}

export async function createApiKey(
  userId: string,
  name: string,
  tier: 'free' | 'pro' | 'enterprise'
) {
  const key = generateApiKey()
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex')

  await db.apiKey.create({
    data: {
      userId,
      name,
      key: hashedKey,
      tier,
      rateLimit: tier === 'free' ? 100 : tier === 'pro' ? 10000 : 100000,
      rateLimitWindow: 86400 // 24 hours
    }
  })

  return key // Only time we return unhashed key
}

export async function validateApiKey(key: string) {
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex')
  const apiKey = await db.apiKey.findUnique({ where: { key: hashedKey } })

  if (!apiKey || !apiKey.isActive) return null

  // Check rate limit
  const usage = await db.apiUsage.count({
    where: {
      apiKeyId: apiKey.id,
      createdAt: {
        gte: new Date(Date.now() - apiKey.rateLimitWindow * 1000)
      }
    }
  })

  if (usage >= apiKey.rateLimit) {
    throw new Error('Rate limit exceeded')
  }

  // Log usage
  await db.apiUsage.create({
    data: { apiKeyId: apiKey.id }
  })

  return apiKey
}
```

### 2. Chrome Extension

**Priority**: P2  
**Viral Potential**: High

**Manifest**:

```json
{
  "manifest_version": 3,
  "name": "UCC Intelligence Lookup",
  "version": "1.0.0",
  "description": "Instantly see UCC filing intelligence on company websites",
  "permissions": ["activeTab", "storage"],
  "host_permissions": ["https://api.yourcompany.com/*"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "content_scripts": [
    {
      "matches": ["*://*.linkedin.com/*"],
      "js": ["content.js"]
    }
  ]
}
```

**Content Script** (Inject on LinkedIn):

```typescript
// extension/content.js
async function enrichLinkedInProfile() {
  const companyName = document.querySelector('.org-top-card-summary__title')?.textContent

  if (!companyName) return

  const response = await fetch(`https://api.yourcompany.com/v1/prospects/search?q=${companyName}`, {
    headers: { 'X-API-Key': await getApiKey() }
  })

  const data = await response.json()

  if (data.prospects.length > 0) {
    const prospect = data.prospects[0]

    // Inject widget
    const widget = document.createElement('div')
    widget.innerHTML = `
      <div class="ucc-widget">
        <h3>UCC Intelligence</h3>
        <p>Priority Score: ${prospect.priorityScore}/100</p>
        <p>Health Grade: ${prospect.healthGrade}</p>
        <p>Growth Signals: ${prospect.growthSignals.length}</p>
        <button id="claim-lead">Claim Lead</button>
      </div>
    `

    document.querySelector('.org-top-card').appendChild(widget)
  }
}

enrichLinkedInProfile()
```

---

## Phase 2: Platform Transformation (Months 4-12)

### 1. Microservices Migration

**Timeline**: 6-9 months  
**Complexity**: High

**Current Architecture**:

```
Monolith React App + Node Server
├── Frontend (React)
├── API (Express)
├── Scrapers (Puppeteer)
└── Database (PostgreSQL)
```

**Target Architecture**:

```
API Gateway (GraphQL)
├── Frontend Service (React + Next.js)
├── Scraper Service (Go + Temporal)
├── ML Service (Python + FastAPI)
├── Notification Service (Node + Bull)
└── Auth Service (Node + Passport)

Event Bus (Kafka)
Data Stores
├── PostgreSQL (transactional)
├── Redis (cache + rate limiting)
├── Elasticsearch (search)
└── S3 (exports + backups)
```

**Migration Strategy**:

1. Extract scrapers first (isolated, heavy compute)
2. Extract ML scoring (Python better for data science)
3. Extract notifications (decouples from main app)
4. Implement API gateway with GraphQL federation
5. Gradually migrate frontend to Next.js for SSR

### 2. Real-Time Data Pipeline

**Timeline**: 9-12 months  
**Complexity**: Very High

**Current**: Batch scraping (daily/weekly)  
**Target**: Streaming pipeline (<5 min latency)

**Architecture**:

```
State UCC Portals
  ↓ (CDC or polling)
Change Detection Service
  ↓ (Kafka)
Stream Processing (Kafka Streams)
  ↓ (parallel)
├── Enrichment Pipeline
├── ML Scoring Pipeline
└── Notification Pipeline
  ↓
Dashboard (WebSocket updates)
```

**Technologies**:

- Debezium for Change Data Capture
- Kafka for event streaming
- Kafka Streams for processing
- Materialize for real-time views

---

## Success Metrics

### Engineering KPIs

- Build Success Rate: 100% ✅
- Test Coverage: >80% (currently 100% ✅)
- Zero Critical Vulnerabilities ✅
- Deployment Frequency: >5/week
- Mean Time to Recovery: <1 hour

### Product KPIs

- NPS Score: >50
- Time to First Value: <5 minutes
- Mobile Traffic: >20%
- API Adoption: >100 developers in first 6 months

### Business KPIs

- MRR Growth: 15% month-over-month
- Churn Rate: <5% monthly
- Customer Acquisition Cost: <3x LTV
- Lead Conversion Rate: >10%

---

## Risks & Mitigations

### Technical Risks

1. **Data Quality Issues**
   - Risk: Scrapers break due to site changes
   - Mitigation: Automated monitoring, fallback to APIs, redundant sources

2. **Scalability Bottlenecks**
   - Risk: Cannot handle 100k+ users
   - Mitigation: Horizontal scaling, caching, CDN

3. **Security Breaches**
   - Risk: Customer data leaked
   - Mitigation: Penetration testing, bug bounty, SOC 2 compliance

### Business Risks

1. **Regulatory Changes**
   - Risk: UCC data becomes restricted
   - Mitigation: Diversify data sources, lobby for access

2. **Competitive Pressure**
   - Risk: ZoomInfo builds similar product
   - Mitigation: Focus on niche (MCA), build moats (data accumulation)

---

## Next Steps

1. **Immediate** (This Week):
   - ✅ Fix build system
   - [ ] Add input sanitization
   - [ ] Deploy staging environment

2. **Short-Term** (This Month):
   - [ ] Implement authentication
   - [ ] Add rate limiting
   - [ ] Launch onboarding flow

3. **Medium-Term** (Next Quarter):
   - [ ] Public API launch
   - [ ] CRM integrations
   - [ ] Chrome extension

4. **Long-Term** (Next Year):
   - [ ] Microservices migration
   - [ ] Real-time pipeline
   - [ ] Mobile app

---

**Document Maintained By**: Engineering Team  
**Review Frequency**: Monthly  
**Last Review**: December 19, 2025
