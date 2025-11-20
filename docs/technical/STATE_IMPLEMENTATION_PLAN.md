# State Agent Implementation Plan - Priority States

## Overview

This document provides detailed implementation requirements for the top 5 priority states (NY, CA, TX, FL, IL) that represent the largest markets for UCC filing data collection.

**Priority Order**: NY → CA → TX → FL → IL

**Estimated Timeline**: 2-3 weeks per state for full implementation and testing

---

## Implementation Priority Matrix

| State | Priority | Market Size | Complexity | Est. Days | Status |
|-------|----------|-------------|------------|-----------|--------|
| NY    | 1        | Very Large  | Medium     | 10-12     | Pending |
| CA    | 2        | Largest     | High       | 12-15     | Pending |
| TX    | 3        | Very Large  | Medium-High| 10-12     | Pending |
| FL    | 4        | Large       | Low-Medium | 8-10      | Pending |
| IL    | 5        | Large       | Medium     | 8-10      | Pending |

---

## 1. New York (NY) - Priority 1

### Configuration
```typescript
{
  stateCode: 'NY',
  stateName: 'New York',
  portalUrl: 'https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame',
  requiresAuth: false,
  rateLimit: { requestsPerMinute: 30, requestsPerHour: 500, requestsPerDay: 5000 },
  dataFormat: 'html',
  updateFrequency: 'daily',
  businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
}
```

### Portal Structure Analysis

**Portal Type**: HTML-based search portal with frames
- **Technology**: Oracle PL/SQL web application
- **Access**: Public (no authentication required)
- **Search Interface**: Frame-based multi-step form

**Search Flow**:
1. Main frame loads search interface
2. User selects search type (Business Name, Filing Number, etc.)
3. Results displayed in separate frame
4. Detail page for each filing

### Implementation Requirements

#### Phase 1: Portal Scraping Setup (3 days)
**Required Libraries**:
```json
{
  "puppeteer": "^21.6.0",  // For frame handling
  "cheerio": "^1.0.0-rc.12" // For HTML parsing
}
```

**Scraping Strategy**:
```typescript
class NYPortalScraper {
  async searchByBusinessName(name: string): Promise<UCCFiling[]> {
    // 1. Navigate to main frame
    // 2. Select "Business Name" search type
    // 3. Enter search term
    // 4. Submit form
    // 5. Parse results frame
    // 6. Extract filing details
  }

  async searchByFilingNumber(filingNumber: string): Promise<UCCFiling> {
    // Direct filing lookup
  }

  async getFilingDetails(filingId: string): Promise<FilingDetails> {
    // Navigate to detail page
    // Extract all filing information
  }
}
```

#### Phase 2: Data Extraction (4 days)
**Data Points to Extract**:
- Filing Number (UCC-1, UCC-3, etc.)
- Filing Date
- Secured Party Name & Address
- Debtor Name & Address
- Collateral Description
- Filing Status (Active, Terminated, Lapsed)
- Expiration Date
- Amendment History

**HTML Selectors** (Need to verify):
```typescript
const NY_SELECTORS = {
  searchForm: 'form[name="search_form"]',
  searchTypeSelect: 'select[name="search_type"]',
  searchInput: 'input[name="search_term"]',
  resultsTable: 'table.results',
  filingRow: 'tr.filing-row',
  filingNumber: 'td.filing-number',
  filingDate: 'td.filing-date',
  debtorName: 'td.debtor-name',
  securedParty: 'td.secured-party',
  detailsLink: 'a.details-link'
}
```

#### Phase 3: Rate Limiting & Error Handling (2 days)
**Rate Limiter Implementation**:
```typescript
class NYRateLimiter {
  private requestsPerMinute = 30
  private requestsPerHour = 500
  private requestsPerDay = 5000

  private minuteQueue: number[] = []
  private hourQueue: number[] = []
  private dayQueue: number[] = []

  async acquireSlot(): Promise<void> {
    // Check all three limits
    // Wait if any limit is exceeded
    // Track request timestamps
  }
}
```

**Error Handling**:
- Network timeouts (retry 3x with exponential backoff)
- Portal structure changes (alert + graceful degradation)
- CAPTCHA detection (manual intervention required)
- Session expiration (automatic reconnection)

#### Phase 4: Testing & Validation (2 days)
**Test Cases**:
1. Search by common business names (500+ results)
2. Search by specific filing numbers
3. Handle pagination (NY can return 100+ pages)
4. Verify data accuracy against manual portal checks
5. Load testing at rate limits
6. Business hours vs. off-hours performance

### Known Challenges

🚨 **Frame Handling**: NY portal uses frames which require Puppeteer
🚨 **Session Management**: Portal may timeout after 20 minutes of inactivity
🚨 **Pagination**: Results limited to 500 per search, requires multiple searches
⚠️ **Data Consistency**: Some fields may be optional or missing

### Success Metrics
- ✅ 95%+ success rate for searches
- ✅ <2 second average response time
- ✅ Zero rate limit violations
- ✅ 99%+ data accuracy

---

## 2. California (CA) - Priority 2

### Configuration
```typescript
{
  stateCode: 'CA',
  stateName: 'California',
  portalUrl: 'https://bizfileonline.sos.ca.gov/search/business',
  apiEndpoint: 'https://bizfileonline.sos.ca.gov/api',
  requiresAuth: true,
  rateLimit: { requestsPerMinute: 60, requestsPerHour: 1200, requestsPerDay: 12000 },
  dataFormat: 'json',
  updateFrequency: 'hourly',
  businessHours: { timezone: 'America/Los_Angeles', start: '08:00', end: '17:00' }
}
```

### Portal Structure Analysis

**Portal Type**: Modern REST API with JSON responses
- **Technology**: RESTful API with OAuth2 authentication
- **Access**: Requires API key (free registration)
- **Response Format**: JSON

**API Endpoints** (to be verified):
```
GET  /api/v1/ucc/search?q={businessName}&limit=100
GET  /api/v1/ucc/filing/{filingNumber}
GET  /api/v1/ucc/debtor/{debtorId}
POST /api/v1/ucc/bulk-search
```

### Implementation Requirements

#### Phase 1: API Client Setup (2 days)
**Authentication Flow**:
```typescript
class CAAPIClient {
  private apiKey: string
  private baseUrl = 'https://bizfileonline.sos.ca.gov/api/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async authenticate(): Promise<string> {
    // Exchange API key for access token
    // Store token with expiration
    // Auto-refresh before expiration
  }

  async request<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    // Add auth headers
    // Handle rate limiting
    // Retry on failures
  }
}
```

#### Phase 2: API Integration (3 days)
**Request/Response Types**:
```typescript
interface CASearchRequest {
  query: string
  type: 'business_name' | 'filing_number' | 'debtor_name'
  limit?: number
  offset?: number
  filingDate?: {
    from: string // ISO date
    to: string
  }
}

interface CASearchResponse {
  results: CAFiling[]
  totalCount: number
  page: number
  hasMore: boolean
}

interface CAFiling {
  filingNumber: string
  filingType: string
  filingDate: string
  expirationDate: string
  status: 'active' | 'lapsed' | 'terminated'
  securedParty: Party
  debtor: Party
  collateral: string
  amendments: Amendment[]
}
```

#### Phase 3: Bulk Operations (4 days)
**Bulk Search Strategy**:
```typescript
class CABulkCollector {
  async collectNewFilings(since: Date): Promise<CAFiling[]> {
    // Use date range API
    // Paginate through all results
    // Handle large result sets (100k+ records)
  }

  async collectByCounty(county: string): Promise<CAFiling[]> {
    // CA has 58 counties
    // Distribute searches across counties
  }

  async fullStateSync(): Promise<void> {
    // Initial data load
    // Estimated: 5-10 million records
    // Use parallel requests (max 60/min)
  }
}
```

#### Phase 4: Incremental Updates (3 days)
**Real-time Collection**:
- CA updates hourly during business hours
- Use webhooks if available (needs verification)
- Otherwise, poll every hour for new filings
- Track last successful sync timestamp

#### Phase 5: Testing & Validation (3 days)
**Test Scenarios**:
1. API authentication and token refresh
2. Bulk data collection (1000+ records)
3. Incremental updates (hourly)
4. Error handling (API downtime, rate limits)
5. Data validation against portal
6. Cost monitoring ($0.01 per request)

### Known Challenges

🚨 **Cost Management**: At $0.01/request, full sync = $50k-$100k
🚨 **API Limits**: Daily limit of 12,000 requests
🚨 **Authentication**: Token expiration requires refresh logic
⚠️ **Data Volume**: Largest state by filing volume

### Success Metrics
- ✅ 99%+ API success rate
- ✅ <500ms average response time
- ✅ Hourly sync during business hours
- ✅ Cost per filing <$0.02

---

## 3. Texas (TX) - Priority 3

### Configuration
```typescript
{
  stateCode: 'TX',
  stateName: 'Texas',
  portalUrl: 'https://www.sos.state.tx.us/corp/soscorporate/corporationsearchdirect.shtml',
  apiEndpoint: 'https://www.sos.state.tx.us/corp/soscorporate/api',
  requiresAuth: true,
  rateLimit: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000 },
  dataFormat: 'json',
  updateFrequency: 'hourly',
  businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
}
```

### Portal Structure Analysis

**Portal Type**: Hybrid - Portal + API
- **Portal**: HTML search interface
- **API**: JSON endpoints for registered users
- **Access**: Free registration required for API

**Unique Features**:
- Real-time data (updates continuously)
- Batch download available (CSV)
- Historical data API (back to 1990)

### Implementation Requirements

#### Phase 1: API Setup (2 days)
Similar to CA but with TX-specific auth

#### Phase 2: Hybrid Collection Strategy (4 days)
**Use API for**:
- New filings (real-time)
- Bulk downloads
- Specific filing lookups

**Use Portal for**:
- Complex searches not supported by API
- Verification of API data
- Fallback if API is down

#### Phase 3: Historical Data Import (3 days)
**Bulk Download Process**:
```typescript
async downloadHistoricalData(year: number): Promise<void> {
  // 1. Request bulk CSV download
  // 2. Poll for download readiness
  // 3. Download compressed file
  // 4. Extract and parse CSV
  // 5. Import to database
  // 6. Validate record counts
}
```

#### Phase 4: Testing (2 days)

### Known Challenges

🚨 **Dual Interface**: Need to maintain both API and portal logic
🚨 **Historical Volume**: 30+ years of data available
⚠️ **Rate Limits**: Lower than CA (10k/day vs 12k/day)

### Success Metrics
- ✅ 98%+ combined success rate
- ✅ Historical import within 1 week
- ✅ Real-time updates with <1 hour lag

---

## 4. Florida (FL) - Priority 4

### Configuration
```typescript
{
  stateCode: 'FL',
  stateName: 'Florida',
  portalUrl: 'https://dos.myflorida.com/sunbiz/search/',
  requiresAuth: false,
  rateLimit: { requestsPerMinute: 40, requestsPerHour: 800, requestsPerDay: 8000 },
  dataFormat: 'html',
  updateFrequency: 'daily'
}
```

### Portal Structure Analysis

**Portal Type**: Simple HTML search
- **Technology**: Standard HTML forms
- **Access**: Public, no auth
- **Search**: Fast response times

**Advantages**:
- Clean, simple HTML structure
- Fast server response
- No authentication complexity
- Generous rate limits

### Implementation Requirements

#### Phase 1: Portal Scraper (3 days)
Similar to NY but simpler HTML structure

#### Phase 2: Data Extraction (3 days)
Standard cheerio-based parsing

#### Phase 3: Testing (2 days)

### Known Challenges

⚠️ **No API**: Must rely entirely on scraping
✅ **Simple Structure**: Easier to implement than NY

### Success Metrics
- ✅ 96%+ success rate
- ✅ <1.5 second average response
- ✅ Daily full sync

---

## 5. Illinois (IL) - Priority 5

### Configuration
```typescript
{
  stateCode: 'IL',
  stateName: 'Illinois',
  portalUrl: 'https://apps.ilsos.gov/corporatellc/',
  requiresAuth: false,
  rateLimit: { requestsPerMinute: 35, requestsPerHour: 700, requestsPerDay: 7000 },
  dataFormat: 'html',
  updateFrequency: 'daily'
}
```

### Portal Structure Analysis

**Portal Type**: HTML with AJAX
- **Technology**: jQuery-based interface
- **Access**: Public
- **Search**: AJAX-powered results

### Implementation Requirements

#### Phase 1: AJAX Request Analysis (2 days)
Capture and replicate AJAX calls

#### Phase 2: API-style Scraping (3 days)
Direct AJAX endpoint calls instead of full page loads

#### Phase 3: Testing (2 days)

### Known Challenges

⚠️ **AJAX Complexity**: Need to reverse-engineer requests
✅ **JSON Responses**: AJAX returns JSON (easier parsing)

### Success Metrics
- ✅ 95%+ success rate
- ✅ <1 second average response
- ✅ Daily sync

---

## Common Implementation Patterns

### 1. Base Collector Interface

```typescript
interface StateCollector {
  searchByBusinessName(name: string): Promise<Filing[]>
  searchByFilingNumber(number: string): Promise<Filing>
  getFilingDetails(id: string): Promise<FilingDetails>
  collectNewFilings(since: Date): Promise<Filing[]>
  validateFiling(filing: Filing): boolean
}
```

### 2. Rate Limiting Middleware

```typescript
class RateLimiter {
  constructor(config: RateLimitConfig) {}
  async acquire(): Promise<void>
  release(): void
  reset(): void
}
```

### 3. Error Handling Strategy

```typescript
class CollectionError extends Error {
  constructor(
    public state: string,
    public errorType: 'NETWORK' | 'PARSE' | 'RATE_LIMIT' | 'AUTH',
    public recoverable: boolean,
    message: string
  ) {}
}
```

### 4. Data Validation

```typescript
function validateFiling(filing: Filing): ValidationResult {
  const errors: string[] = []

  if (!filing.filingNumber) errors.push('Missing filing number')
  if (!filing.filingDate) errors.push('Missing filing date')
  if (!filing.debtor?.name) errors.push('Missing debtor name')

  return {
    valid: errors.length === 0,
    errors
  }
}
```

---

## Implementation Checklist per State

- [ ] **Research Phase**
  - [ ] Portal structure analysis
  - [ ] Identify all search methods
  - [ ] Document data fields available
  - [ ] Check for API documentation
  - [ ] Test rate limits manually

- [ ] **Development Phase**
  - [ ] Implement collector class
  - [ ] Add rate limiting
  - [ ] Implement error handling
  - [ ] Add retry logic
  - [ ] Create data validators

- [ ] **Testing Phase**
  - [ ] Unit tests for parser
  - [ ] Integration tests for collector
  - [ ] Load testing at rate limits
  - [ ] Error scenario testing
  - [ ] Data accuracy validation

- [ ] **Deployment Phase**
  - [ ] Add monitoring
  - [ ] Set up alerts
  - [ ] Document configuration
  - [ ] Create runbook
  - [ ] Deploy to production

---

## Resource Requirements

### Development Team
- **1 Senior Backend Developer**: State collector implementation
- **1 QA Engineer**: Testing and validation
- **0.5 DevOps Engineer**: Monitoring and deployment

### Infrastructure
- **Proxies**: Rotate IP addresses to avoid blocks
- **Storage**: ~10GB per state for historical data
- **Compute**: 2-4 CPU cores per active collector
- **Database**: PostgreSQL for storing filings

### Third-Party Services
- **Puppeteer Cloud** (optional): For complex scraping
- **Proxy Services**: Rotating residential proxies
- **Monitoring**: DataDog or similar APM

---

## Next Steps

1. **Week 1-2**: Implement NY collector (Priority 1)
2. **Week 3-4**: Implement CA collector (Priority 2)
3. **Week 5-6**: Implement TX collector (Priority 3)
4. **Week 7**: Implement FL collector (Priority 4)
5. **Week 8**: Implement IL collector (Priority 5)
6. **Week 9**: Integration testing across all 5 states
7. **Week 10**: Production deployment and monitoring

**Total Timeline**: 10 weeks for top 5 states

---

## Cost Estimates

| State | Type    | Monthly Cost | Notes |
|-------|---------|--------------|-------|
| NY    | Scraper | $50-100      | Proxy costs |
| CA    | API     | $500-1000    | Per-request pricing |
| TX    | Hybrid  | $200-400     | API + proxy |
| FL    | Scraper | $50-100      | Proxy costs |
| IL    | Scraper | $50-100      | Proxy costs |
| **Total** |     | **$850-1700/mo** | For top 5 states |

---

## Maintenance & Updates

### Weekly Tasks
- Monitor success rates
- Review error logs
- Update selectors if portal changes

### Monthly Tasks
- Performance optimization
- Cost analysis
- Capacity planning

### Quarterly Tasks
- Full regression testing
- Rate limit renegotiation (for APIs)
- Competitive analysis
