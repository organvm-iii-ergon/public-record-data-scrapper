# Phase 2: Real Data Integration - Detailed Task Breakdown

**Duration**: 4 weeks (Weeks 5-8)
**Goal**: Replace mocks with production data sources
**Priority**: CRITICAL
**Dependencies**: Phase 1 complete

---

## Week 5-6: UCC Portal Scrapers

### Task 2.1: New York UCC Portal Scraper

**Assignee**: TBD
**Effort**: 5 days
**Priority**: CRITICAL (Largest market)

#### Subtask 2.1.1: Setup Playwright Infrastructure

**Time**: 1 day

**Install Dependencies:**

```bash
npm install playwright playwright-core
npm install -D @types/node
```

**Create Base Scraper Class:**
**File**: `src/lib/scrapers/BaseScraper.ts`

```typescript
import { Browser, Page, chromium } from 'playwright'
import { retryWithBackoff, CircuitBreaker } from '../utils/retry'

export interface ScraperConfig {
  headless: boolean
  timeout: number
  userAgent: string
  rateLimit: {
    requestsPerMinute: number
    delayMs: number
  }
  antiDetection: {
    randomDelay: boolean
    rotateUserAgent: boolean
  }
}

export abstract class BaseScraper {
  protected browser: Browser | null = null
  protected page: Page | null = null
  protected config: ScraperConfig
  protected circuitBreaker: CircuitBreaker

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      rateLimit: {
        requestsPerMinute: 5,
        delayMs: 12000 // 60000ms / 5 = 12000ms
      },
      antiDetection: {
        randomDelay: true,
        rotateUserAgent: true
      },
      ...config
    }

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 60000
    })
  }

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
    })

    const context = await this.browser.newContext({
      userAgent: this.config.userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US'
    })

    this.page = await context.newPage()
    this.page.setDefaultTimeout(this.config.timeout)

    // Anti-detection: Remove webdriver flag
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      })
    })
  }

  async cleanup(): Promise<void> {
    if (this.page) await this.page.close()
    if (this.browser) await this.browser.close()
  }

  protected async randomDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    if (!this.config.antiDetection.randomDelay) return
    const delay = Math.random() * (maxMs - minMs) + minMs
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  protected async rateLimitDelay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.config.rateLimit.delayMs))
  }

  protected async detectCaptcha(page: Page): Promise<boolean> {
    const captchaSelectors = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="hcaptcha"]',
      '.g-recaptcha',
      '#captcha'
    ]

    for (const selector of captchaSelectors) {
      const element = await page.$(selector)
      if (element) return true
    }

    return false
  }

  abstract scrape(...args: any[]): Promise<any>
}
```

**Acceptance Criteria:**

- [ ] BaseScraper class created
- [ ] Playwright initialized
- [ ] Anti-detection measures implemented
- [ ] Rate limiting built-in
- [ ] CAPTCHA detection working

---

#### Subtask 2.1.2: NY UCC Portal Implementation

**File**: `src/lib/scrapers/NYUCCPortalScraper.ts`
**Time**: 2 days

```typescript
import { BaseScraper } from './BaseScraper'
import type { UCCFiling } from '../types'

export interface NYSearchParams {
  debtorName?: string
  filingNumber?: string
  dateFrom?: string
  dateTo?: string
}

export class NYUCCPortalScraper extends BaseScraper {
  private readonly PORTAL_URL = 'https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame'

  async scrape(params: NYSearchParams): Promise<UCCFiling[]> {
    return await this.circuitBreaker.execute(async () => {
      await this.initialize()

      try {
        // Navigate to portal
        await this.page!.goto(this.PORTAL_URL, { waitUntil: 'networkidle' })

        // Check for CAPTCHA
        if (await this.detectCaptcha(this.page!)) {
          throw new Error('CAPTCHA_DETECTED: Manual review required')
        }

        // Fill search form
        if (params.debtorName) {
          await this.page!.fill('input[name="debtor_name"]', params.debtorName)
        }

        if (params.dateFrom) {
          await this.page!.fill('input[name="filing_date_from"]', params.dateFrom)
        }

        if (params.dateTo) {
          await this.page!.fill('input[name="filing_date_to"]', params.dateTo)
        }

        // Submit search
        await this.page!.click('input[type="submit"]')
        await this.randomDelay(2000, 4000)

        // Wait for results
        await this.page!.waitForSelector('table.results', { timeout: 10000 })

        // Parse results
        const filings = await this.parseResultsTable()

        // Handle pagination
        const allFilings: UCCFiling[] = [...filings]
        let hasNextPage = await this.hasNextPage()

        while (hasNextPage) {
          await this.rateLimitDelay()
          await this.page!.click('a:has-text("Next")')
          await this.randomDelay(1000, 2000)

          const moreFilings = await this.parseResultsTable()
          allFilings.push(...moreFilings)

          hasNextPage = await this.hasNextPage()
        }

        return allFilings
      } catch (error) {
        console.error('NY UCC scraping error:', error)
        throw error
      } finally {
        await this.cleanup()
      }
    })
  }

  private async parseResultsTable(): Promise<UCCFiling[]> {
    const rows = await this.page!.$$('table.results tbody tr')
    const filings: UCCFiling[] = []

    for (const row of rows) {
      const cells = await row.$$('td')

      if (cells.length < 6) continue

      const filing: UCCFiling = {
        id: (await cells[0].textContent()) || '',
        filingNumber: (await cells[1].textContent()) || '',
        filingDate: (await cells[2].textContent()) || '',
        debtorName: (await cells[3].textContent()) || '',
        securedParty: (await cells[4].textContent()) || '',
        status: (await cells[5].textContent()) || '',
        state: 'NY',
        sourceUrl: this.PORTAL_URL,
        scrapedAt: new Date().toISOString()
      }

      filings.push(filing)
    }

    return filings
  }

  private async hasNextPage(): Promise<boolean> {
    const nextButton = await this.page!.$('a:has-text("Next")')
    if (!nextButton) return false

    const isDisabled = await nextButton.getAttribute('disabled')
    return !isDisabled
  }

  async getFilingDetails(filingNumber: string): Promise<UCCFiling | null> {
    return await this.circuitBreaker.execute(async () => {
      await this.initialize()

      try {
        await this.page!.goto(this.PORTAL_URL)

        // Search by filing number
        await this.page!.fill('input[name="filing_number"]', filingNumber)
        await this.page!.click('input[type="submit"]')

        await this.randomDelay(1000, 2000)
        await this.page!.waitForSelector('.filing-details')

        // Parse detailed view
        const details = await this.page!.evaluate(() => {
          const getText = (selector: string) =>
            document.querySelector(selector)?.textContent?.trim() || ''

          return {
            filingNumber: getText('.filing-number'),
            filingDate: getText('.filing-date'),
            lapseDate: getText('.lapse-date'),
            debtorName: getText('.debtor-name'),
            debtorAddress: getText('.debtor-address'),
            securedParty: getText('.secured-party'),
            securedPartyAddress: getText('.secured-party-address'),
            collateralDescription: getText('.collateral-description'),
            lienAmount: getText('.lien-amount'),
            status: getText('.status')
          }
        })

        return {
          ...details,
          id: filingNumber,
          state: 'NY',
          sourceUrl: this.page!.url(),
          scrapedAt: new Date().toISOString()
        }
      } finally {
        await this.cleanup()
      }
    })
  }
}
```

**Acceptance Criteria:**

- [ ] Portal navigation working
- [ ] Search form automation
- [ ] Results parsing accurate
- [ ] Pagination handling
- [ ] Detailed view scraping
- [ ] CAPTCHA detection triggering manual queue
- [ ] Rate limiting enforced (5 req/min)

---

#### Subtask 2.1.3: NY Scraper Tests

**File**: `src/lib/scrapers/__tests__/NYUCCPortalScraper.test.ts`
**Time**: 1 day

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NYUCCPortalScraper } from '../NYUCCPortalScraper'

describe('NYUCCPortalScraper', () => {
  let scraper: NYUCCPortalScraper

  beforeEach(() => {
    scraper = new NYUCCPortalScraper({ headless: true })
  })

  afterEach(async () => {
    await scraper.cleanup()
  })

  it('should scrape UCC filings by debtor name', async () => {
    const filings = await scraper.scrape({
      debtorName: 'Test Company LLC'
    })

    expect(filings.length).toBeGreaterThan(0)
    expect(filings[0]).toHaveProperty('filingNumber')
    expect(filings[0]).toHaveProperty('debtorName')
    expect(filings[0].state).toBe('NY')
  })

  it('should handle pagination', async () => {
    // Mock search with 50+ results (multiple pages)
    const filings = await scraper.scrape({
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31'
    })

    expect(filings.length).toBeGreaterThan(25) // Default page size
  })

  it('should detect CAPTCHA and throw error', async () => {
    // Mock CAPTCHA response
    await expect(scraper.scrape({ debtorName: 'CAPTCHA_TRIGGER' })).rejects.toThrow(
      'CAPTCHA_DETECTED'
    )
  })

  it('should enforce rate limiting', async () => {
    const startTime = Date.now()

    // Make 3 requests
    await scraper.scrape({ debtorName: 'Test 1' })
    await scraper.scrape({ debtorName: 'Test 2' })
    await scraper.scrape({ debtorName: 'Test 3' })

    const duration = Date.now() - startTime

    // Should take at least 24 seconds (12s delay × 2 intervals)
    expect(duration).toBeGreaterThan(24000)
  })

  it('should retrieve filing details', async () => {
    const details = await scraper.getFilingDetails('2024-1234567')

    expect(details).toBeDefined()
    expect(details?.filingNumber).toBe('2024-1234567')
    expect(details?.debtorAddress).toBeDefined()
    expect(details?.collateralDescription).toBeDefined()
  })

  it('should handle portal outage gracefully', async () => {
    // Mock 503 error
    await expect(scraper.scrape({ debtorName: 'Test' })).rejects.toThrow()
    // Verify circuit breaker opened after 3 failures
  })
})
```

**Acceptance Criteria:**

- [ ] All scraper methods tested
- [ ] CAPTCHA detection verified
- [ ] Rate limiting confirmed
- [ ] Error handling tested
- [ ] Coverage: 80%+

---

#### Subtask 2.1.4: Manual Review Queue

**File**: `src/lib/services/ManualReviewQueue.ts`
**Time**: 1 day

```typescript
import { useKV } from '@github/spark'
import type { UCCFiling } from '../types'

export interface ManualReviewItem {
  id: string
  type: 'CAPTCHA_BLOCKED' | 'PARSING_ERROR' | 'AMBIGUOUS_DATA'
  filing: Partial<UCCFiling>
  error: string
  scrapeAttempts: number
  createdAt: string
  status: 'pending' | 'in_review' | 'resolved' | 'rejected'
}

export class ManualReviewQueue {
  private queue: ManualReviewItem[] = []

  async add(item: Omit<ManualReviewItem, 'id' | 'createdAt' | 'status'>): Promise<void> {
    const reviewItem: ManualReviewItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    }

    this.queue.push(reviewItem)
    await this.persist()

    // Notify admin (email, Slack, etc.)
    await this.notifyAdmin(reviewItem)
  }

  async getPending(): Promise<ManualReviewItem[]> {
    return this.queue.filter((item) => item.status === 'pending')
  }

  async resolve(id: string, resolvedData: UCCFiling): Promise<void> {
    const item = this.queue.find((i) => i.id === id)
    if (!item) throw new Error('Review item not found')

    item.status = 'resolved'
    item.filing = resolvedData

    await this.persist()
  }

  async reject(id: string, reason: string): Promise<void> {
    const item = this.queue.find((i) => i.id === id)
    if (!item) throw new Error('Review item not found')

    item.status = 'rejected'
    item.error = reason

    await this.persist()
  }

  private async persist(): Promise<void> {
    // Save to KV storage or database
    localStorage.setItem('manual-review-queue', JSON.stringify(this.queue))
  }

  private async notifyAdmin(item: ManualReviewItem): Promise<void> {
    console.warn('Manual review required:', item)
    // TODO: Send email/Slack notification
  }
}
```

**Acceptance Criteria:**

- [ ] Queue management implemented
- [ ] Admin notifications working
- [ ] Status tracking
- [ ] Persistence layer

---

### Task 2.2: California UCC Portal Scraper

**Assignee**: TBD
**Effort**: 4 days
**Priority**: HIGH

#### Subtask 2.2.1: CA Portal Implementation

**File**: `src/lib/scrapers/CAUCCPortalScraper.ts`
**Time**: 2 days

```typescript
import { BaseScraper } from './BaseScraper'
import type { UCCFiling } from '../types'

export class CAUCCPortalScraper extends BaseScraper {
  private readonly PORTAL_URL = 'https://businesssearch.sos.ca.gov/'

  async scrape(params: { debtorName: string }): Promise<UCCFiling[]> {
    return await this.circuitBreaker.execute(async () => {
      await this.initialize()

      try {
        await this.page!.goto(this.PORTAL_URL)

        // CA uses a different search interface
        await this.page!.fill('input#SearchCriteria', params.debtorName)
        await this.page!.selectOption('select#SearchType', 'DEBTOR')
        await this.page!.click('button#search-submit')

        await this.randomDelay(2000, 4000)
        await this.page!.waitForSelector('.search-results')

        const filings = await this.parseCAResults()
        return filings
      } finally {
        await this.cleanup()
      }
    })
  }

  private async parseCAResults(): Promise<UCCFiling[]> {
    // CA-specific parsing logic
    return []
  }
}
```

**Acceptance Criteria:**

- [ ] CA portal navigation
- [ ] Search automation
- [ ] Results parsing
- [ ] Tests written (80%+ coverage)

---

### Task 2.3: Texas & Florida Scrapers

**Assignee**: TBD
**Effort**: 5 days
**Priority**: HIGH

#### Subtask 2.3.1: TX UCC Portal

**File**: `src/lib/scrapers/TXUCCPortalScraper.ts`
**Time**: 2.5 days

```typescript
import { BaseScraper } from './BaseScraper'

export class TXUCCPortalScraper extends BaseScraper {
  private readonly PORTAL_URL = 'https://www.sos.state.tx.us/corp/soskb/csearch.asp'

  async scrape(params: { debtorName: string }): Promise<UCCFiling[]> {
    // TX-specific implementation
    return []
  }
}
```

**Acceptance Criteria:**

- [ ] TX portal working
- [ ] Tests passing

---

#### Subtask 2.3.2: FL UCC Portal

**File**: `src/lib/scrapers/FLUCCPortalScraper.ts`
**Time**: 2.5 days

```typescript
import { BaseScraper } from './BaseScraper'

export class FLUCCPortalScraper extends BaseScraper {
  private readonly PORTAL_URL = 'https://dos.fl.gov/sunbiz/search/'

  async scrape(params: { debtorName: string }): Promise<UCCFiling[]> {
    // FL-specific implementation
    return []
  }
}
```

**Acceptance Criteria:**

- [ ] FL portal working
- [ ] Tests passing

---

### Task 2.4: Scraper Factory & Orchestration

**Assignee**: TBD
**Effort**: 2 days
**Priority**: MEDIUM

**File**: `src/lib/scrapers/ScraperFactory.ts`

```typescript
import { NYUCCPortalScraper } from './NYUCCPortalScraper'
import { CAUCCPortalScraper } from './CAUCCPortalScraper'
import { TXUCCPortalScraper } from './TXUCCPortalScraper'
import { FLUCCPortalScraper } from './FLUCCPortalScraper'

export type StateCode = 'NY' | 'CA' | 'TX' | 'FL'

export class ScraperFactory {
  static getScraper(state: StateCode) {
    switch (state) {
      case 'NY':
        return new NYUCCPortalScraper()
      case 'CA':
        return new CAUCCPortalScraper()
      case 'TX':
        return new TXUCCPortalScraper()
      case 'FL':
        return new FLUCCPortalScraper()
      default:
        throw new Error(`No scraper available for state: ${state}`)
    }
  }

  static async scrapeMultipleStates(
    states: StateCode[],
    params: any
  ): Promise<Record<StateCode, UCCFiling[]>> {
    const results: Record<string, UCCFiling[]> = {}

    for (const state of states) {
      const scraper = this.getScraper(state)
      results[state] = await scraper.scrape(params)
    }

    return results as Record<StateCode, UCCFiling[]>
  }
}
```

**Acceptance Criteria:**

- [ ] Factory pattern implemented
- [ ] Multi-state scraping
- [ ] Error handling per state

---

## Week 7-8: Free Tier Data Sources

### Task 2.5: SEC EDGAR Integration

**Assignee**: TBD
**Effort**: 2 days
**Priority**: HIGH

**File**: `src/lib/integrations/SECEdgarAPI.ts`

```typescript
import axios from 'axios'

export interface SECCompanyInfo {
  cik: string
  name: string
  tickers: string[]
  exchanges: string[]
  sic: string
  sicDescription: string
  filings: SECFiling[]
}

export interface SECFiling {
  accessionNumber: string
  filingDate: string
  reportDate: string
  form: string // 10-K, 10-Q, 8-K, etc.
  fileNumber: string
  filmNumber: string
}

export class SECEdgarAPI {
  private readonly BASE_URL = 'https://data.sec.gov'
  private readonly USER_AGENT = 'UCC-MCA-Platform contact@example.com'
  private readonly RATE_LIMIT = 10 // requests per second

  private lastRequestTime = 0

  async searchCompany(companyName: string): Promise<SECCompanyInfo | null> {
    await this.rateLimit()

    try {
      // Search company by name
      const searchUrl = `${this.BASE_URL}/cgi-bin/browse-edgar`
      const response = await axios.get(searchUrl, {
        params: {
          company: companyName,
          action: 'getcompany',
          output: 'json'
        },
        headers: {
          'User-Agent': this.USER_AGENT
        }
      })

      if (!response.data || !response.data.cik) {
        return null
      }

      return this.getCompanyByCIK(response.data.cik)
    } catch (error) {
      console.error('SEC EDGAR search error:', error)
      return null
    }
  }

  async getCompanyByCIK(cik: string): Promise<SECCompanyInfo | null> {
    await this.rateLimit()

    try {
      const paddedCIK = cik.padStart(10, '0')
      const submissionsUrl = `${this.BASE_URL}/submissions/CIK${paddedCIK}.json`

      const response = await axios.get(submissionsUrl, {
        headers: {
          'User-Agent': this.USER_AGENT
        }
      })

      const data = response.data

      return {
        cik: data.cik,
        name: data.name,
        tickers: data.tickers || [],
        exchanges: data.exchanges || [],
        sic: data.sic,
        sicDescription: data.sicDescription,
        filings:
          data.filings?.recent?.map((filing: any, index: number) => ({
            accessionNumber: filing.accessionNumber[index],
            filingDate: filing.filingDate[index],
            reportDate: filing.reportDate[index],
            form: filing.form[index],
            fileNumber: filing.fileNumber[index],
            filmNumber: filing.filmNumber[index]
          })) || []
      }
    } catch (error) {
      console.error('SEC EDGAR CIK lookup error:', error)
      return null
    }
  }

  async getFilingDocument(accessionNumber: string, cik: string): Promise<string | null> {
    await this.rateLimit()

    try {
      const paddedCIK = cik.padStart(10, '0')
      const accessionNoHyphens = accessionNumber.replace(/-/g, '')
      const docUrl = `${this.BASE_URL}/Archives/edgar/data/${paddedCIK}/${accessionNoHyphens}/${accessionNumber}.txt`

      const response = await axios.get(docUrl, {
        headers: {
          'User-Agent': this.USER_AGENT
        }
      })

      return response.data
    } catch (error) {
      console.error('SEC filing document error:', error)
      return null
    }
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const minInterval = 1000 / this.RATE_LIMIT // 100ms for 10 req/sec

    if (timeSinceLastRequest < minInterval) {
      await new Promise((resolve) => setTimeout(resolve, minInterval - timeSinceLastRequest))
    }

    this.lastRequestTime = Date.now()
  }
}
```

**Tests**: `src/lib/integrations/__tests__/SECEdgarAPI.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { SECEdgarAPI } from '../SECEdgarAPI'

describe('SECEdgarAPI', () => {
  const api = new SECEdgarAPI()

  it('should search company by name', async () => {
    const result = await api.searchCompany('Tesla Inc')

    expect(result).toBeDefined()
    expect(result?.name).toContain('Tesla')
    expect(result?.cik).toBeDefined()
  })

  it('should get company info by CIK', async () => {
    const result = await api.getCompanyByCIK('1318605') // Tesla CIK

    expect(result).toBeDefined()
    expect(result?.name).toContain('Tesla')
    expect(result?.filings.length).toBeGreaterThan(0)
  })

  it('should enforce rate limit (10 req/sec)', async () => {
    const startTime = Date.now()

    // Make 20 requests
    for (let i = 0; i < 20; i++) {
      await api.searchCompany('Test')
    }

    const duration = Date.now() - startTime

    // Should take at least 2 seconds (20 requests / 10 per second)
    expect(duration).toBeGreaterThan(2000)
  })

  it('should return null for non-existent company', async () => {
    const result = await api.searchCompany('NONEXISTENT_COMPANY_XYZ_123')
    expect(result).toBeNull()
  })
})
```

**Acceptance Criteria:**

- [ ] SEC EDGAR API integration working
- [ ] Company search by name
- [ ] CIK lookup
- [ ] Filing retrieval
- [ ] Rate limiting (10 req/sec)
- [ ] Tests passing (80%+ coverage)

---

### Task 2.6: OSHA API Integration

**Assignee**: TBD
**Effort**: 1 day
**Priority**: MEDIUM

**File**: `src/lib/integrations/OSHAAPI.ts`

```typescript
import axios from 'axios'

export interface OSHAInspection {
  activityNr: string
  reportingId: string
  establishmentName: string
  city: string
  state: string
  zipCode: string
  naicsCode: string
  inspectionDate: string
  violations: OSHAViolation[]
}

export interface OSHAViolation {
  citationId: string
  standardViolated: string
  violationType: 'Serious' | 'Willful' | 'Repeat' | 'Other'
  penaltyAmount: number
  violationDescription: string
  abatementDate: string
}

export class OSHAAPI {
  private readonly BASE_URL = 'https://data.osha.gov/ords/osha/rest/inspections'

  async searchInspections(establishmentName: string, state?: string): Promise<OSHAInspection[]> {
    try {
      const response = await axios.get(this.BASE_URL, {
        params: {
          establishment_name: establishmentName,
          state: state,
          limit: 100
        }
      })

      return response.data.items || []
    } catch (error) {
      console.error('OSHA API error:', error)
      return []
    }
  }

  async getViolationsByEstablishment(establishmentName: string): Promise<OSHAViolation[]> {
    const inspections = await this.searchInspections(establishmentName)
    const allViolations: OSHAViolation[] = []

    for (const inspection of inspections) {
      if (inspection.violations) {
        allViolations.push(...inspection.violations)
      }
    }

    return allViolations
  }

  calculateViolationScore(violations: OSHAViolation[]): number {
    if (violations.length === 0) return 100

    const weights = {
      Serious: -10,
      Willful: -20,
      Repeat: -15,
      Other: -5
    }

    let score = 100
    violations.forEach((v) => {
      score += weights[v.violationType] || -5
    })

    return Math.max(0, Math.min(100, score))
  }
}
```

**Acceptance Criteria:**

- [ ] OSHA inspection search
- [ ] Violation retrieval
- [ ] Violation scoring
- [ ] Tests passing

---

### Task 2.7: USPTO API Integration

**Assignee**: TBD
**Effort**: 1 day
**Priority**: MEDIUM

**File**: `src/lib/integrations/USPTOAPI.ts`

```typescript
import axios from 'axios'

export interface USPTOTrademark {
  serialNumber: string
  registrationNumber: string
  markIdentification: string
  owner: string
  filingDate: string
  registrationDate: string
  status: string
  statusDate: string
}

export class USPTOAPI {
  private readonly BASE_URL = 'https://developer.uspto.gov/ibd-api/v1/application'

  async searchTrademarks(ownerName: string): Promise<USPTOTrademark[]> {
    try {
      const response = await axios.get(`${this.BASE_URL}/publications`, {
        params: {
          ownerName: ownerName,
          rows: 100
        }
      })

      return response.data.results || []
    } catch (error) {
      console.error('USPTO API error:', error)
      return []
    }
  }

  async getTrademarkBySerial(serialNumber: string): Promise<USPTOTrademark | null> {
    try {
      const response = await axios.get(`${this.BASE_URL}/${serialNumber}`)
      return response.data
    } catch (error) {
      return null
    }
  }
}
```

**Acceptance Criteria:**

- [ ] Trademark search working
- [ ] Serial number lookup
- [ ] Tests passing

---

### Task 2.8: Census Bureau API Integration

**Assignee**: TBD
**Effort**: 1 day
**Priority**: LOW

**File**: `src/lib/integrations/CensusBureauAPI.ts`

```typescript
export class CensusBureauAPI {
  private readonly BASE_URL = 'https://api.census.gov/data'
  private readonly API_KEY = process.env.CENSUS_API_KEY || ''

  async getBusinessPatterns(zipCode: string, naicsCode: string): Promise<any> {
    // Implementation
    return {}
  }
}
```

---

### Task 2.9: SAM.gov API Integration

**Assignee**: TBD
**Effort**: 1.5 days
**Priority**: MEDIUM

**File**: `src/lib/integrations/SAMgovAPI.ts`

```typescript
export interface FederalContract {
  awardId: string
  contractNumber: string
  vendorName: string
  amount: number
  awardDate: string
  description: string
}

export class SAMgovAPI {
  private readonly BASE_URL = 'https://api.sam.gov/opportunities/v2/search'
  private readonly API_KEY = process.env.SAM_API_KEY || ''

  async searchContracts(vendorName: string): Promise<FederalContract[]> {
    try {
      const response = await axios.get(this.BASE_URL, {
        params: {
          api_key: this.API_KEY,
          vendorName: vendorName,
          limit: 100
        }
      })

      return response.data.opportunitiesData || []
    } catch (error) {
      console.error('SAM.gov API error:', error)
      return []
    }
  }
}
```

**Acceptance Criteria:**

- [ ] Contract search working
- [ ] Tests passing

---

### Task 2.10: Unified Enrichment Pipeline

**Assignee**: TBD
**Effort**: 2 days
**Priority**: HIGH
**Dependencies**: Tasks 2.5-2.9

**File**: `src/lib/services/UnifiedEnrichmentService.ts`

```typescript
import { SECEdgarAPI } from '../integrations/SECEdgarAPI'
import { OSHAAPI } from '../integrations/OSHAAPI'
import { USPTOAPI } from '../integrations/USPTOAPI'
import { SAMgovAPI } from '../integrations/SAMgovAPI'
import type { Prospect, EnrichmentResult } from '../types'

export class UnifiedEnrichmentService {
  private sec = new SECEdgarAPI()
  private osha = new OSHAAPI()
  private uspto = new USPTOAPI()
  private sam = new SAMgovAPI()

  async enrichProspect(prospect: Prospect): Promise<EnrichmentResult> {
    const results = await Promise.allSettled([
      this.sec.searchCompany(prospect.companyName),
      this.osha.searchInspections(prospect.companyName, prospect.state),
      this.uspto.searchTrademarks(prospect.companyName),
      this.sam.searchContracts(prospect.companyName)
    ])

    const [secResult, oshaResult, usptoResult, samResult] = results

    return {
      prospect,
      enrichment: {
        secInfo: secResult.status === 'fulfilled' ? secResult.value : null,
        oshaViolations: oshaResult.status === 'fulfilled' ? oshaResult.value : [],
        trademarks: usptoResult.status === 'fulfilled' ? usptoResult.value : [],
        federalContracts: samResult.status === 'fulfilled' ? samResult.value : []
      },
      enrichedAt: new Date().toISOString(),
      errors: results
        .map((r, i) => (r.status === 'rejected' ? { source: i, error: r.reason } : null))
        .filter(Boolean)
    }
  }

  async enrichBatch(prospects: Prospect[], concurrency = 5): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = []

    for (let i = 0; i < prospects.length; i += concurrency) {
      const batch = prospects.slice(i, i + concurrency)
      const batchResults = await Promise.all(batch.map((p) => this.enrichProspect(p)))
      results.push(...batchResults)
    }

    return results
  }
}
```

**Acceptance Criteria:**

- [ ] All 5 APIs integrated
- [ ] Parallel enrichment working
- [ ] Error handling per source
- [ ] Batch processing (concurrency: 5)
- [ ] Tests passing (80%+ coverage)

---

## Phase 2 Completion Checklist

### Week 5-6: UCC Portal Scrapers ✓

- [ ] BaseScraper class with anti-detection
- [ ] NY UCC portal scraper (fully tested)
- [ ] CA UCC portal scraper (fully tested)
- [ ] TX UCC portal scraper (fully tested)
- [ ] FL UCC portal scraper (fully tested)
- [ ] Manual review queue for CAPTCHA
- [ ] Rate limiting enforced (5 req/min)
- [ ] Circuit breaker pattern
- [ ] Scraper factory & orchestration

### Week 7-8: Free Tier Data Sources ✓

- [ ] SEC EDGAR API (company filings)
- [ ] OSHA API (violations)
- [ ] USPTO API (trademarks)
- [ ] Census Bureau API (business patterns)
- [ ] SAM.gov API (federal contracts)
- [ ] Unified enrichment service
- [ ] Batch enrichment (concurrency: 5)
- [ ] Usage tracking per source

### Deliverables

- [ ] 4 state scrapers operational
- [ ] 5 free data source integrations
- [ ] Manual review queue for errors
- [ ] Enrichment pipeline processing real data
- [ ] Test coverage 80%+
- [ ] Documentation updated

### Metrics

- **UCC Filings Ingested**: Target 10,000+
- **Enrichment Success Rate**: Target 85%+
- **Scraper Uptime**: Target 95%+
- **CAPTCHA Rate**: <5% of requests

---

**Total Effort**: 4 weeks
**Total Cost**: ~$24,000 (@ $150/hr)
**Next Phase**: Phase 3 - Backend Infrastructure
