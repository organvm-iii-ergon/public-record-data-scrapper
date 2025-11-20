# Data Enrichment Pipeline

This document describes the tiered data enrichment pipeline implemented for the UCC-MCA Intelligence Platform.

## Overview

The enrichment pipeline provides multi-tier data acquisition, normalization, and monitoring capabilities through a coordinated agentic architecture.

## Architecture

### Core Components

1. **Subscription Tier Management**
   - Free, Starter, Professional, and Enterprise tiers
   - Quota tracking and enforcement
   - Feature access control

2. **Data Sources**
   - Free tier: SEC EDGAR, OSHA, USPTO, Census, SAM.gov
   - Starter tier: D&B, Google Places, Clearbit
   - Professional tier: Experian, ZoomInfo, NewsAPI (structure ready)

3. **Enrichment Agents**
   - DataAcquisitionAgent
   - ScraperAgent
   - DataNormalizationAgent
   - MonitoringAgent
   - EnrichmentOrchestratorAgent

## Agents

### DataAcquisitionAgent

Manages data source integration and routing based on subscription tiers.

**Capabilities:**
- Multi-source data fetching
- Tier-based access control
- API authentication management
- Retry logic and error handling
- Response normalization

**Usage:**
```typescript
import { DataAcquisitionAgent } from './src/lib/agentic'

const agent = new DataAcquisitionAgent()
const result = await agent.executeTask({
  type: 'fetch-data',
  payload: {
    companyName: 'Acme Inc',
    state: 'CA',
    tier: 'free',
    userId: 'user-123'
  }
})
```

### ScraperAgent

Manages UCC filing scraping from state Secretary of State portals.

**Capabilities:**
- UCC filing scraping
- Multi-state support (CA, TX, FL)
- Rate limiting (5 requests/minute per state)
- Anti-detection measures
- CAPTCHA handling (returns manual URL on detection)

**Usage:**
```typescript
import { ScraperAgent } from './src/lib/agentic'

const agent = new ScraperAgent()
const result = await agent.executeTask({
  type: 'scrape-ucc',
  payload: {
    companyName: 'Acme Inc',
    state: 'CA'
  }
})
```

**Note:** Scraper implementations are templates. Full Playwright/Puppeteer implementations are needed for production use.

### DataNormalizationAgent

Canonicalizes, standardizes, and deduplicates data from multiple sources.

**Capabilities:**
- Company name canonicalization (removes LLC/Inc suffixes)
- Address normalization (USPS standards)
- Date standardization (ISO 8601)
- Fuzzy matching and deduplication
- Data validation

**Usage:**
```typescript
import { DataNormalizationAgent } from './src/lib/agentic'

const agent = new DataNormalizationAgent()
const result = await agent.executeTask({
  type: 'normalize-company-name',
  payload: { name: 'acme corporation, llc' }
})
// Result: { normalized: 'Acme Corporation' }
```

### MonitoringAgent

Tracks usage, enforces quotas, and monitors system health.

**Capabilities:**
- Usage tracking
- Quota enforcement
- Cost calculation
- Alert generation
- Audit trail logging
- Usage reporting

**Usage:**
```typescript
import { MonitoringAgent } from './src/lib/agentic'

const agent = new MonitoringAgent()
const result = await agent.executeTask({
  type: 'check-quota',
  payload: { userId: 'user-123' }
})
```

### EnrichmentOrchestratorAgent

Coordinates the enrichment workflow across all agents.

**Capabilities:**
- Workflow coordination
- Task orchestration
- Parallel processing
- Error handling
- Progress tracking
- Result aggregation

**Usage:**
```typescript
import { EnrichmentOrchestratorAgent } from './src/lib/agentic'

const orchestrator = new EnrichmentOrchestratorAgent()
const result = await orchestrator.executeTask({
  type: 'enrich-prospect',
  payload: {
    companyName: 'Acme Inc',
    state: 'CA',
    tier: 'free',
    userId: 'user-123'
  }
})
```

## Subscription Tiers

### Free Tier
- **Quota:** 100 requests/month
- **Sources:** SEC EDGAR, OSHA, USPTO, Census, SAM.gov
- **Cost:** $0
- **Concurrent requests:** 1

### Starter Tier
- **Quota:** 1,000 requests/month
- **Sources:** Free tier + D&B, Google Places, Clearbit
- **Cost:** ~$1.50 per enrichment
- **Concurrent requests:** 3

### Professional Tier
- **Quota:** 5,000 requests/month
- **Sources:** Starter tier + Experian, ZoomInfo, NewsAPI
- **Cost:** ~$3.00+ per enrichment
- **Concurrent requests:** 5

### Enterprise Tier
- **Quota:** Unlimited
- **Sources:** All sources
- **Cost:** Custom pricing
- **Concurrent requests:** 10

## Tier Management

```typescript
import { TierManager } from './src/lib/subscription/tier-manager'

// Check if user has access to a data source
const hasAccess = TierManager.hasSourceAccess('free', 'sec-edgar') // true
const hasAccess2 = TierManager.hasSourceAccess('free', 'dnb') // false

// Get monthly quota
const quota = TierManager.getMonthlyQuota('free') // 100
```

## Usage Tracking

```typescript
import { usageTracker } from './src/lib/subscription/usage-tracker'

// Set user tier
usageTracker.setUserTier('user-123', 'free')

// Track usage
usageTracker.trackUsage({
  userId: 'user-123',
  action: 'data-fetch',
  source: 'sec-edgar',
  cost: 0,
  timestamp: new Date().toISOString(),
  success: true
})

// Get usage stats
const stats = usageTracker.getUsageStats('user-123', 'monthly')
console.log(`Used ${stats.quotaUsed}/${stats.quotaLimit} requests`)
```

## Rate Limiting

```typescript
import { rateLimiterManager } from './src/lib/subscription/rate-limiter'

// Try to consume tokens
if (rateLimiterManager.tryConsume('sec-edgar', 1)) {
  // Proceed with request
} else {
  // Rate limit exceeded
}

// Wait for tokens
await rateLimiterManager.waitForTokens('sec-edgar', 1)
// Now proceed with request
```

## Data Sources

### Free Tier Sources

#### SEC EDGAR
- **Endpoint:** `https://www.sec.gov/cgi-bin/browse-edgar`
- **Data:** Company filings, CIK, SIC codes
- **Rate Limit:** 10 requests/second
- **Cost:** Free

#### OSHA Violations
- **Endpoint:** `https://data.dol.gov/get/inspection`
- **Data:** Workplace safety violations, penalties
- **Rate Limit:** 1 request/second
- **Cost:** Free

#### USPTO Trademarks
- **Endpoint:** `https://developer.uspto.gov/ds-api/trademarks`
- **Data:** Trademark registrations
- **Rate Limit:** 1 request/second
- **Cost:** Free

### Starter Tier Sources

#### D&B Direct
- **Data:** Business credit, DUNS number, revenue estimates
- **Cost:** $0.50 per lookup
- **Requires:** API key in `DNB_API_KEY` env variable

#### Google Places
- **Data:** Business location, reviews, ratings
- **Cost:** $0.02 per lookup
- **Requires:** API key in `GOOGLE_PLACES_API_KEY` env variable

#### Clearbit
- **Data:** Company enrichment, tech stack, employee count
- **Cost:** $1.00 per lookup
- **Requires:** API key in `CLEARBIT_API_KEY` env variable

## Environment Variables

To use commercial data sources, set these environment variables:

```bash
DNB_API_KEY=your_dnb_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
CLEARBIT_API_KEY=your_clearbit_api_key
```

## Enrichment Workflow

1. **Quota Check** - Verify user has quota remaining
2. **Data Acquisition** - Fetch from all available sources in parallel
3. **UCC Scraping** - Scrape state Secretary of State portal (if supported)
4. **Normalization** - Canonicalize and standardize all data
5. **Usage Tracking** - Track usage and update quota

## Testing

Run the demo to see the enrichment pipeline in action:

```bash
npm run dev
# Open browser and check console for enrichment demo
```

## Future Enhancements

1. **Backend API** - Express server with PostgreSQL
2. **Job Queue** - BullMQ for async processing
3. **WebSocket** - Real-time progress updates
4. **Playwright Integration** - Full scraper implementations
5. **Professional Tier Sources** - Experian, ZoomInfo, NewsAPI
6. **Caching** - Redis for response caching
7. **Analytics** - Usage analytics dashboard

## File Structure

```
src/lib/
├── agentic/
│   ├── agents/
│   │   ├── DataAcquisitionAgent.ts
│   │   ├── ScraperAgent.ts
│   │   ├── DataNormalizationAgent.ts
│   │   ├── MonitoringAgent.ts
│   │   └── EnrichmentOrchestratorAgent.ts
│   └── types.ts
├── data-sources/
│   ├── base-source.ts
│   ├── free-tier.ts
│   └── starter-tier.ts
└── subscription/
    ├── tier-manager.ts
    ├── usage-tracker.ts
    └── rate-limiter.ts

scripts/scrapers/
├── base-scraper.ts
└── states/
    ├── california.ts
    ├── texas.ts
    └── florida.ts
```

## License

MIT
