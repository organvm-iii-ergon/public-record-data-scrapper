# Phase 1: Foundation Strengthening - Detailed Task Breakdown

**Duration**: 4 weeks (Weeks 1-4)
**Goal**: Production-ready testing and type safety
**Priority**: CRITICAL

---

## Week 1-2: Testing Infrastructure

### Task 1.1: Service Layer Unit Tests

**Assignee**: TBD
**Effort**: 5 days
**Dependencies**: None
**Priority**: CRITICAL

#### Subtask 1.1.1: DataIngestionService Tests

**File**: `src/lib/services/__tests__/DataIngestionService.test.ts`
**Time**: 2 days

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataIngestionService } from '../DataIngestionService'

describe('DataIngestionService', () => {
  let service: DataIngestionService

  beforeEach(() => {
    service = new DataIngestionService()
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limit of 60 req/min per source', async () => {
      // Mock 61 requests in < 60 seconds
      // Expect 61st request to be delayed
    })

    it('should allow requests after rate limit window expires', async () => {
      // Test token bucket refill
    })
  })

  describe('Circuit Breaker', () => {
    it('should open circuit after 5 consecutive failures', async () => {
      // Mock 5 failed API calls
      // Expect circuit to open
    })

    it('should transition to half-open after timeout', async () => {
      // Wait for circuit breaker timeout (60s)
      // Expect next request to test connection
    })

    it('should close circuit after successful half-open request', async () => {
      // Successful request in half-open state
      // Expect circuit to close
    })
  })

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      // Mock transient failure
      // Expect 3 retries with delays: 2s, 4s, 8s
    })

    it('should not retry on non-retryable errors (4xx)', async () => {
      // Mock 400 Bad Request
      // Expect immediate failure, no retries
    })

    it('should add jitter to retry delays', async () => {
      // Verify delay is baseDelay * (2^attempt) * (0.5-1.5 random)
    })
  })

  describe('Multi-Source Ingestion', () => {
    it('should ingest from state portal source', async () => {
      const result = await service.ingest({
        type: 'state-portal',
        state: 'NY',
        endpoint: 'https://appext20.dos.ny.gov/pls/ucc_public/'
      })
      expect(result.records.length).toBeGreaterThan(0)
      expect(result.source).toBe('NY')
    })

    it('should ingest from API source', async () => {
      // Test API-based ingestion
    })

    it('should ingest from database source', async () => {
      // Test database-based ingestion
    })
  })

  describe('Error Handling', () => {
    it('should handle portal outages gracefully', async () => {
      // Mock 503 Service Unavailable
      // Expect queued for retry
    })

    it('should handle CAPTCHA detection', async () => {
      // Mock CAPTCHA response
      // Expect manual review queue
    })

    it('should handle timeout errors', async () => {
      // Mock timeout
      // Expect retry with increased timeout
    })
  })

  describe('Batch Processing', () => {
    it('should process records in batches of 100', async () => {
      // Ingest 250 records
      // Expect 3 batches: 100, 100, 50
    })

    it('should continue batch processing on partial failure', async () => {
      // Mock failure in batch 2 of 3
      // Expect batches 1 and 3 to succeed
    })
  })
})
```

**Acceptance Criteria:**

- [ ] All rate limiting tests pass
- [ ] Circuit breaker state transitions verified
- [ ] Retry logic with backoff confirmed
- [ ] Multi-source ingestion tested
- [ ] Error scenarios handled
- [ ] Batch processing validated
- [ ] Coverage: 80%+ for DataIngestionService

**Commands:**

```bash
# Create test file
touch src/lib/services/__tests__/DataIngestionService.test.ts

# Run tests
npm test DataIngestionService

# Check coverage
npm run test:coverage -- src/lib/services/DataIngestionService.ts
```

---

#### Subtask 1.1.2: DataEnrichmentService Tests

**File**: `src/lib/services/__tests__/DataEnrichmentService.test.ts`
**Time**: 2 days

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataEnrichmentService } from '../DataEnrichmentService'
import type { Prospect } from '../../types'

describe('DataEnrichmentService', () => {
  let service: DataEnrichmentService
  let mockProspect: Prospect

  beforeEach(() => {
    service = new DataEnrichmentService()
    mockProspect = {
      id: 'test-1',
      companyName: 'Acme Corp',
      state: 'NY'
      // ... other fields
    }
  })

  describe('Growth Signal Detection', () => {
    it('should detect hiring signals from job postings', async () => {
      // Mock job board API response
      const signals = await service.detectGrowthSignals(mockProspect)
      expect(signals.hiring).toBeDefined()
      expect(signals.hiring.count).toBeGreaterThan(0)
    })

    it('should detect permit signals', async () => {
      // Mock building permit database
    })

    it('should detect contract signals', async () => {
      // Mock SAM.gov API
    })

    it('should detect expansion signals from news', async () => {
      // Mock NewsAPI
    })

    it('should detect equipment financing signals', async () => {
      // Mock equipment financing DB
    })

    it('should return empty signals when no data found', async () => {
      // Mock empty responses
      const signals = await service.detectGrowthSignals(mockProspect)
      expect(signals.hiring.count).toBe(0)
      expect(signals.permits.count).toBe(0)
    })
  })

  describe('Health Score Calculation', () => {
    it('should calculate health score from reviews', async () => {
      // Mock Google Reviews: 4.5 stars
      const health = await service.calculateHealthScore(mockProspect)
      expect(health.score).toBeGreaterThan(70)
      expect(health.grade).toBe('B')
    })

    it('should penalize for OSHA violations', async () => {
      // Mock OSHA violations
      const health = await service.calculateHealthScore(mockProspect)
      expect(health.score).toBeLessThan(60)
      expect(health.violations.osha).toBeGreaterThan(0)
    })

    it('should perform sentiment analysis on reviews', async () => {
      // Mock mixed sentiment reviews
      const health = await service.calculateHealthScore(mockProspect)
      expect(health.sentiment).toBeGreaterThan(-1)
      expect(health.sentiment).toBeLessThan(1)
    })

    it('should detect health trends (improving/stable/declining)', async () => {
      // Mock historical health scores
      const health = await service.calculateHealthScore(mockProspect)
      expect(['improving', 'stable', 'declining']).toContain(health.trend)
    })
  })

  describe('Revenue Estimation', () => {
    it('should estimate revenue from lien amount (4-6x multiplier)', async () => {
      mockProspect.lienAmount = 100000
      const revenue = await service.estimateRevenue(mockProspect)
      expect(revenue).toBeGreaterThanOrEqual(400000)
      expect(revenue).toBeLessThanOrEqual(600000)
    })

    it('should adjust estimate by industry', async () => {
      // Restaurants: 4x, Manufacturing: 6x
      mockProspect.industry = 'restaurant'
      const restaurantRevenue = await service.estimateRevenue(mockProspect)

      mockProspect.industry = 'manufacturing'
      const mfgRevenue = await service.estimateRevenue(mockProspect)

      expect(mfgRevenue).toBeGreaterThan(restaurantRevenue)
    })

    it('should adjust estimate by location (high/low cost)', async () => {
      // NYC higher than rural areas
    })
  })

  describe('Industry Classification', () => {
    it('should classify restaurant industry', async () => {
      mockProspect.companyName = "Joe's Pizza & Grill"
      const industry = await service.classifyIndustry(mockProspect)
      expect(industry).toBe('restaurant')
    })

    it('should classify construction industry', async () => {
      mockProspect.companyName = 'ABC Construction LLC'
      const industry = await service.classifyIndustry(mockProspect)
      expect(industry).toBe('construction')
    })

    it('should handle ambiguous company names', async () => {
      mockProspect.companyName = 'Acme Corporation'
      const industry = await service.classifyIndustry(mockProspect)
      expect(industry).toBe('services') // Default
    })
  })

  describe('Priority Score Calculation', () => {
    it('should calculate priority score from formula', async () => {
      // defaultScore (30) + growthScore (20) + healthPoints (16) = 66
      const priority = await service.calculatePriorityScore({
        ...mockProspect,
        defaultDays: 90,
        growthSignals: { count: 4 },
        healthScore: { score: 80 }
      })
      expect(priority).toBe(66)
    })

    it('should cap priority score at 100', async () => {
      // Test with high values
      const priority = await service.calculatePriorityScore({
        ...mockProspect,
        defaultDays: 365,
        growthSignals: { count: 10 },
        healthScore: { score: 100 }
      })
      expect(priority).toBe(100)
    })

    it('should handle minimum score of 0', async () => {
      const priority = await service.calculatePriorityScore({
        ...mockProspect,
        defaultDays: 0,
        growthSignals: { count: 0 },
        healthScore: { score: 0 }
      })
      expect(priority).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Batch Enrichment', () => {
    it('should enrich 5 prospects concurrently', async () => {
      const prospects = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...mockProspect,
          id: `test-${i}`
        }))

      const startTime = Date.now()
      await service.enrichBatch(prospects)
      const duration = Date.now() - startTime

      // Should be faster than sequential (10 * 2s = 20s)
      expect(duration).toBeLessThan(10000) // < 10s with concurrency=5
    })

    it('should handle partial batch failures', async () => {
      // Mock failure for prospect 3 of 5
      // Expect 4 successful enrichments
    })
  })

  describe('Subscription Tier Quotas', () => {
    it('should enforce free tier quota (100/month)', async () => {
      // Mock 101 enrichments
      // Expect 101st to be rejected
    })

    it('should allow starter tier quota (1000/month)', async () => {
      // Test quota enforcement
    })

    it('should track usage per data source', async () => {
      // Verify usage tracking
    })
  })
})
```

**Acceptance Criteria:**

- [ ] All 5 growth signal types tested
- [ ] Health score calculation verified
- [ ] Revenue estimation accuracy confirmed
- [ ] Industry classification working
- [ ] Priority score formula validated
- [ ] Batch enrichment concurrent processing
- [ ] Quota enforcement tested
- [ ] Coverage: 80%+ for DataEnrichmentService

**Commands:**

```bash
touch src/lib/services/__tests__/DataEnrichmentService.test.ts
npm test DataEnrichmentService
npm run test:coverage -- src/lib/services/DataEnrichmentService.ts
```

---

#### Subtask 1.1.3: DataRefreshScheduler Tests

**File**: `src/lib/services/__tests__/DataRefreshScheduler.test.ts`
**Time**: 1 day

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DataRefreshScheduler } from '../DataRefreshScheduler'

describe('DataRefreshScheduler', () => {
  let scheduler: DataRefreshScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    scheduler = new DataRefreshScheduler()
  })

  afterEach(() => {
    vi.useRealTimers()
    scheduler.stop()
  })

  describe('Scheduling Logic', () => {
    it('should trigger ingestion every 24 hours', async () => {
      const ingestionSpy = vi.fn()
      scheduler.on('ingestion:started', ingestionSpy)

      scheduler.start()

      // Fast-forward 24 hours
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)

      expect(ingestionSpy).toHaveBeenCalledTimes(1)
    })

    it('should trigger enrichment every 6 hours', async () => {
      const enrichmentSpy = vi.fn()
      scheduler.on('enrichment:started', enrichmentSpy)

      scheduler.start()

      // Fast-forward 18 hours (3 cycles)
      await vi.advanceTimersByTimeAsync(18 * 60 * 60 * 1000)

      expect(enrichmentSpy).toHaveBeenCalledTimes(3)
    })

    it('should not schedule when stopped', async () => {
      const spy = vi.fn()
      scheduler.on('ingestion:started', spy)

      scheduler.start()
      scheduler.stop()

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('Event System', () => {
    it('should emit ingestion:started event', async () => {
      const handler = vi.fn()
      scheduler.on('ingestion:started', handler)

      await scheduler.triggerIngestion()

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'ingestion:started' }))
    })

    it('should emit ingestion:completed event with stats', async () => {
      const handler = vi.fn()
      scheduler.on('ingestion:completed', handler)

      await scheduler.triggerIngestion()

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ingestion:completed',
          stats: expect.objectContaining({
            recordsProcessed: expect.any(Number),
            duration: expect.any(Number)
          })
        })
      )
    })

    it('should emit ingestion:failed event on error', async () => {
      const handler = vi.fn()
      scheduler.on('ingestion:failed', handler)

      // Mock ingestion failure
      vi.spyOn(scheduler, 'ingest').mockRejectedValue(new Error('Network error'))

      await scheduler.triggerIngestion()

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ingestion:failed',
          error: expect.any(Error)
        })
      )
    })
  })

  describe('Manual Triggers', () => {
    it('should allow manual ingestion trigger', async () => {
      const result = await scheduler.triggerIngestion()
      expect(result.success).toBe(true)
      expect(result.recordsProcessed).toBeGreaterThan(0)
    })

    it('should allow manual enrichment trigger', async () => {
      const result = await scheduler.triggerEnrichment()
      expect(result.success).toBe(true)
      expect(result.prospectsEnriched).toBeGreaterThan(0)
    })

    it('should not allow concurrent ingestion runs', async () => {
      const promise1 = scheduler.triggerIngestion()
      const promise2 = scheduler.triggerIngestion()

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('already running')
    })
  })

  describe('Stale Data Detection', () => {
    it('should detect prospects with stale data (>24h)', async () => {
      // Mock prospects with old lastUpdated
      const staleProspects = await scheduler.detectStaleData()
      expect(staleProspects.length).toBeGreaterThan(0)
      expect(staleProspects[0].staleDays).toBeGreaterThan(1)
    })

    it('should prioritize stale data refresh', async () => {
      // Stale prospects should be enriched first
    })
  })
})
```

**Acceptance Criteria:**

- [ ] Scheduling intervals verified (24h, 6h)
- [ ] Event system tested (6 event types)
- [ ] Manual triggers working
- [ ] Concurrent run prevention
- [ ] Stale data detection
- [ ] Coverage: 80%+ for DataRefreshScheduler

---

### Task 1.2: Utility Tests

**Assignee**: TBD
**Effort**: 2 days
**Dependencies**: None

#### Subtask 1.2.1: Retry Utilities Tests

**File**: `src/lib/utils/__tests__/retry.test.ts`
**Time**: 1 day

```typescript
import { describe, it, expect, vi } from 'vitest'
import { retryWithBackoff, CircuitBreaker } from '../retry'

describe('Retry Utilities', () => {
  describe('retryWithBackoff', () => {
    it('should retry 3 times with exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('Success')

      const result = await retryWithBackoff(fn, { maxRetries: 3 })

      expect(fn).toHaveBeenCalledTimes(3)
      expect(result).toBe('Success')
    })

    it('should apply exponential backoff delays', async () => {
      const delays: number[] = []
      const fn = vi.fn().mockRejectedValue(new Error('Fail'))

      try {
        await retryWithBackoff(fn, {
          maxRetries: 3,
          baseDelay: 100,
          onRetry: (attempt, delay) => delays.push(delay)
        })
      } catch {}

      expect(delays).toEqual([100, 200, 400]) // 100 * 2^attempt
    })

    it('should add jitter to delays', async () => {
      // Test jitter randomness (0.5x - 1.5x)
    })

    it('should respect maxDelay cap', async () => {
      const delays: number[] = []
      const fn = vi.fn().mockRejectedValue(new Error('Fail'))

      try {
        await retryWithBackoff(fn, {
          maxRetries: 5,
          baseDelay: 1000,
          maxDelay: 3000,
          onRetry: (attempt, delay) => delays.push(delay)
        })
      } catch {}

      expect(Math.max(...delays)).toBeLessThanOrEqual(3000)
    })

    it('should not retry on non-retryable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('Bad Request'), { statusCode: 400 }))

      try {
        await retryWithBackoff(fn, {
          shouldRetry: (error: any) => error.statusCode >= 500
        })
      } catch {}

      expect(fn).toHaveBeenCalledTimes(1) // No retries
    })
  })

  describe('CircuitBreaker', () => {
    it('should open after failure threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 })
      const fn = vi.fn().mockRejectedValue(new Error('Fail'))

      // Trigger 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(fn)
        } catch {}
      }

      expect(cb.state).toBe('open')

      // Next call should fail immediately without executing fn
      try {
        await cb.execute(fn)
      } catch (error: any) {
        expect(error.message).toContain('Circuit breaker is open')
      }

      expect(fn).toHaveBeenCalledTimes(3) // Not called on 4th attempt
    })

    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers()

      const cb = new CircuitBreaker({
        failureThreshold: 2,
        timeout: 5000
      })
      const fn = vi.fn().mockRejectedValue(new Error('Fail'))

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(fn)
        } catch {}
      }

      expect(cb.state).toBe('open')

      // Wait for timeout
      await vi.advanceTimersByTimeAsync(5000)

      expect(cb.state).toBe('half-open')

      vi.useRealTimers()
    })

    it('should close on successful half-open request', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 })
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('Success')

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(fn)
        } catch {}
      }

      // Transition to half-open (mock timeout)
      cb.state = 'half-open'

      // Successful request
      await cb.execute(fn)

      expect(cb.state).toBe('closed')
    })
  })
})
```

**Acceptance Criteria:**

- [ ] Retry logic tested (exponential backoff)
- [ ] Jitter implementation verified
- [ ] Circuit breaker states tested
- [ ] Timeout handling confirmed
- [ ] Coverage: 90%+ for retry utilities

---

### Task 1.3: Integration Tests

**Assignee**: TBD
**Effort**: 3 days
**Dependencies**: Task 1.1, 1.2

#### Subtask 1.3.1: E2E Pipeline Test

**File**: `tests/integration/pipeline.test.ts`
**Time**: 2 days

```typescript
import { describe, it, expect } from 'vitest'
import { DataIngestionService } from '@/lib/services/DataIngestionService'
import { DataEnrichmentService } from '@/lib/services/DataEnrichmentService'

describe('Data Pipeline Integration', () => {
  it('should complete full pipeline: ingest → enrich → score', async () => {
    // 1. Ingest UCC filings
    const ingestionService = new DataIngestionService()
    const ingestionResult = await ingestionService.ingest({
      type: 'state-portal',
      state: 'NY',
      endpoint: 'https://test-portal.ny.gov'
    })

    expect(ingestionResult.records.length).toBeGreaterThan(0)

    // 2. Enrich prospects
    const enrichmentService = new DataEnrichmentService()
    const prospects = ingestionResult.records.map((r) => ({
      id: r.id,
      companyName: r.debtorName,
      state: 'NY',
      lienAmount: r.amount
    }))

    const enrichedProspects = await enrichmentService.enrichBatch(prospects)

    expect(enrichedProspects.length).toBe(prospects.length)
    expect(enrichedProspects[0].growthSignals).toBeDefined()
    expect(enrichedProspects[0].healthScore).toBeDefined()

    // 3. Verify priority scores calculated
    enrichedProspects.forEach((prospect) => {
      expect(prospect.priorityScore).toBeGreaterThanOrEqual(0)
      expect(prospect.priorityScore).toBeLessThanOrEqual(100)
    })
  })

  it('should handle errors gracefully in pipeline', async () => {
    // Test partial failures
  })

  it('should respect rate limits across services', async () => {
    // Test coordinated rate limiting
  })
})
```

**Acceptance Criteria:**

- [ ] Full pipeline tested end-to-end
- [ ] Error recovery verified
- [ ] Rate limiting coordination
- [ ] Data consistency checks

---

### Task 1.4: E2E Tests with Playwright

**Assignee**: TBD
**Effort**: 3 days
**Dependencies**: None

#### Subtask 1.4.1: Setup Playwright

**Time**: 0.5 days

```bash
# Install Playwright
npm install -D @playwright/test

# Initialize Playwright
npx playwright install
```

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
})
```

**Acceptance Criteria:**

- [ ] Playwright installed
- [ ] Configuration created
- [ ] Test directory set up

---

#### Subtask 1.4.2: Prospect Claiming Workflow

**File**: `tests/e2e/prospect-claiming.spec.ts`
**Time**: 1 day

```typescript
import { test, expect } from '@playwright/test'

test.describe('Prospect Claiming Workflow', () => {
  test('should claim a prospect', async ({ page }) => {
    await page.goto('/')

    // Wait for prospects to load
    await page.waitForSelector('[data-testid="prospect-card"]')

    // Click first unclaimed prospect
    const firstProspect = page.locator('[data-testid="prospect-card"]').first()
    await expect(firstProspect).toContainText('Unclaimed')

    // Click claim button
    await firstProspect.locator('[data-testid="claim-button"]').click()

    // Verify claim dialog appears
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('[role="dialog"]')).toContainText('Claim Prospect')

    // Confirm claim
    await page.locator('[data-testid="confirm-claim"]').click()

    // Verify prospect is now claimed
    await expect(firstProspect).toContainText('Claimed')

    // Verify appears in Portfolio tab
    await page.click('text=Portfolio')
    await expect(page.locator('[data-testid="portfolio-item"]').first()).toBeVisible()
  })

  test('should unclaim a prospect', async ({ page }) => {
    // Similar flow for unclaiming
  })

  test('should claim multiple prospects via batch operation', async ({ page }) => {
    await page.goto('/')

    // Select 3 prospects
    const checkboxes = page.locator('[data-testid="prospect-checkbox"]')
    await checkboxes.nth(0).check()
    await checkboxes.nth(1).check()
    await checkboxes.nth(2).check()

    // Click batch claim button
    await page.click('[data-testid="batch-claim-button"]')

    // Verify all 3 are claimed
    await expect(checkboxes.nth(0)).toBeChecked()
    // ... verify claim status
  })
})
```

**Acceptance Criteria:**

- [ ] Single claim workflow tested
- [ ] Unclaim workflow tested
- [ ] Batch claim tested
- [ ] Visual regression checks

---

#### Subtask 1.4.3: Export Functionality

**File**: `tests/e2e/export.spec.ts`
**Time**: 1 day

```typescript
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

test.describe('Export Functionality', () => {
  test('should export prospects as CSV', async ({ page }) => {
    await page.goto('/')

    // Click export button
    await page.click('[data-testid="export-button"]')

    // Select CSV format
    await page.click('[data-testid="format-csv"]')

    // Start download
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="confirm-export"]')
    const download = await downloadPromise

    // Verify download
    const filePath = path.join(__dirname, 'downloads', download.suggestedFilename())
    await download.saveAs(filePath)

    expect(fs.existsSync(filePath)).toBe(true)

    // Verify CSV content
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('Company Name,State,Priority Score')

    // Cleanup
    fs.unlinkSync(filePath)
  })

  test('should export prospects as JSON', async ({ page }) => {
    // Similar test for JSON format
  })

  test('should export filtered prospects only', async ({ page }) => {
    await page.goto('/')

    // Apply filter
    await page.click('[data-testid="filters-button"]')
    await page.selectOption('[data-testid="state-filter"]', 'NY')
    await page.click('[data-testid="apply-filters"]')

    // Export
    // ... verify only NY prospects in export
  })
})
```

**Acceptance Criteria:**

- [ ] CSV export tested
- [ ] JSON export tested
- [ ] Excel export tested
- [ ] Filtered export verified
- [ ] Downloaded files validated

---

### Task 1.5: CI/CD Integration

**Assignee**: TBD
**Effort**: 1 day
**Dependencies**: Task 1.1-1.4

#### Update GitHub Actions

**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, claude/**]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test -- --coverage

      - name: Check coverage threshold
        run: |
          COVERAGE=$(jq -r '.total.lines.pct' coverage/coverage-summary.json)
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Build application
        run: npm run build

  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

**Acceptance Criteria:**

- [ ] CI runs on all pushes
- [ ] Coverage threshold enforced (80%)
- [ ] E2E tests run in CI
- [ ] Build verification
- [ ] Reports uploaded

---

## Week 3-4: Type Safety & Code Quality

### Task 1.6: Fix TypeScript Errors

**Assignee**: TBD
**Effort**: 3 days
**Priority**: HIGH

#### Subtask 1.6.1: Fix App.tsx Type Errors

**File**: `src/App.tsx`
**Time**: 1 day

**Current Issues:**

```typescript
// Line ~350: Type error in handleClaim
const handleClaim = (id: string) => {
  // Error: Type 'string' is not assignable to type 'never'
}

// Line ~420: Type error in handleExport
const handleExport = (format: string) => {
  // Missing type annotation
}
```

**Fix:**

```typescript
import type { Prospect, ExportFormat } from './lib/types'

// Add proper types
const handleClaim = (id: string): void => {
  setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'claimed' as const } : p)))
}

const handleExport = (format: ExportFormat): void => {
  // Proper type annotation
  const data = filteredProspects.map(/* ... */)
  exportToFormat(data, format)
}

// Fix state types
const [filter, setFilter] = useState<ProspectFilter>({
  states: [],
  industries: [],
  minScore: 0,
  maxScore: 100,
  status: 'all'
})
```

**Acceptance Criteria:**

- [ ] All type errors in App.tsx resolved
- [ ] Proper type annotations added
- [ ] No `any` types remain
- [ ] Type inference working correctly

---

#### Subtask 1.6.2: Fix use-agentic-engine.ts

**File**: `src/hooks/use-agentic-engine.ts`
**Time**: 0.5 days

**Current Issues:**

```typescript
// Undefined type imports
import { AgentAnalysis } from '../lib/agentic/types' // May not exist
```

**Fix:**

```typescript
import type { AgentAnalysis, CouncilReview, ImprovementCategory } from '@/lib/agentic/types'

interface UseAgenticEngineReturn {
  runCycle: () => Promise<CouncilReview>
  analysis: AgentAnalysis | null
  isRunning: boolean
  error: Error | null
}

export const useAgenticEngine = (): UseAgenticEngineReturn => {
  // Proper return type
}
```

**Acceptance Criteria:**

- [ ] All type imports resolved
- [ ] Return type properly defined
- [ ] Hook type-safe

---

#### Subtask 1.6.3: Fix CompetitorAgent.ts

**File**: `src/lib/agentic/agents/CompetitorAgent.ts`
**Time**: 0.5 days

**Current Issues:**

```typescript
// ImprovementCategory type mismatch
category: 'competitive-intelligence' // Error: not in union type
```

**Fix:**

```typescript
// Update types.ts
export type ImprovementCategory =
  | 'data-quality'
  | 'performance'
  | 'security'
  | 'ux'
  | 'competitive-intelligence' // Add missing category
  | 'business-intelligence'

// Or update CompetitorAgent.ts
category: 'business-intelligence' as const
```

**Acceptance Criteria:**

- [ ] Category type updated
- [ ] No type errors
- [ ] Consistent with other agents

---

### Task 1.7: Enable Strict Mode

**Assignee**: TBD
**Effort**: 2 days
**Dependencies**: Task 1.6

#### Subtask 1.7.1: Update tsconfig.json

**File**: `tsconfig.json`
**Time**: 0.5 days

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Acceptance Criteria:**

- [ ] Strict mode enabled
- [ ] All strict flags configured
- [ ] Build succeeds

---

#### Subtask 1.7.2: Fix Strict Mode Errors

**Time**: 1.5 days

**Common fixes needed:**

```typescript
// 1. Fix implicit any
// Before:
function process(data) {} // Error: Parameter 'data' implicitly has 'any' type

// After:
function process(data: unknown): void {}

// 2. Fix null checks
// Before:
const value = obj.field.nested // Error: Object is possibly 'undefined'

// After:
const value = obj.field?.nested ?? defaultValue

// 3. Fix type assertions
// Before:
const element = document.getElementById('foo')
element.textContent = 'bar' // Error: Object is possibly 'null'

// After:
const element = document.getElementById('foo')
if (element) {
  element.textContent = 'bar'
}
```

**Acceptance Criteria:**

- [ ] All strict mode errors fixed
- [ ] No type assertion circumventions
- [ ] Proper null/undefined handling

---

### Task 1.8: Code Quality Setup

**Assignee**: TBD
**Effort**: 2 days
**Dependencies**: None

#### Subtask 1.8.1: Prettier Configuration

**File**: `.prettierrc`
**Time**: 0.5 days

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

Create `.prettierignore`:

```
node_modules
dist
build
coverage
.next
*.min.js
```

**Commands:**

```bash
npm install -D prettier
npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css}"
```

**Update package.json:**

```json
{
  "scripts": {
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css}\""
  }
}
```

**Acceptance Criteria:**

- [ ] Prettier configured
- [ ] All files formatted
- [ ] Format script working

---

#### Subtask 1.8.2: Husky Pre-commit Hooks

**File**: `.husky/pre-commit`
**Time**: 0.5 days

```bash
npm install -D husky lint-staged
npx husky init
```

Create `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

Create `.lintstagedrc.json`:

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write", "vitest related --run"],
  "*.{json,css,md}": ["prettier --write"]
}
```

**Acceptance Criteria:**

- [ ] Husky installed
- [ ] Pre-commit hook runs
- [ ] Lint-staged configured
- [ ] Tests run on commit

---

#### Subtask 1.8.3: ESLint Strict Rules

**File**: `eslint.config.js`
**Time**: 1 day

```javascript
import js from '@eslint/js'
import typescript from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  ...typescript.configs.strictTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  }
]
```

**Acceptance Criteria:**

- [ ] Strict ESLint rules configured
- [ ] No `any` types allowed
- [ ] React hooks rules enforced
- [ ] All files pass linting

---

## Phase 1 Completion Checklist

### Week 1-2: Testing Infrastructure ✓

- [ ] DataIngestionService tests (80%+ coverage)
- [ ] DataEnrichmentService tests (80%+ coverage)
- [ ] DataRefreshScheduler tests (80%+ coverage)
- [ ] Retry utilities tests (90%+ coverage)
- [ ] Integration tests (E2E pipeline)
- [ ] Playwright E2E tests (claiming, export, filters)
- [ ] CI/CD pipeline with coverage gates

### Week 3-4: Type Safety & Code Quality ✓

- [ ] All TypeScript errors fixed (0 errors)
- [ ] Strict mode enabled
- [ ] Prettier configured and all files formatted
- [ ] Husky pre-commit hooks active
- [ ] ESLint strict rules enforced
- [ ] No `any` types in codebase

### Deliverables

- [ ] Test coverage report (80%+ overall)
- [ ] CI/CD pipeline passing
- [ ] Type-safe codebase
- [ ] Automated code quality checks
- [ ] Documentation updated

### Metrics

- **Test Coverage**: Target 80%+, Current ~60%
- **TypeScript Errors**: Target 0, Current 5-10
- **Build Time**: Target <20s, Current ~30s
- **CI Pipeline**: All checks passing

---

**Total Effort**: 4 weeks
**Total Cost**: ~$24,000 (@ $150/hr)
**Next Phase**: Phase 2 - Real Data Integration
