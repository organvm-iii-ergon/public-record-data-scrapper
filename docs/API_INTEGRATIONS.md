# API Integrations Documentation

**Last Updated**: 2025-01-15
**Status**: Production Ready

## Overview

This document provides comprehensive documentation for all external API integrations in the UCC-MCA Intelligence Platform. The platform integrates with 20+ data sources across three categories:

1. **Growth Signals** - Job postings, news, government contracts, building permits
2. **Health Scores** - Business reviews, ratings, BBB scores, sentiment analysis
3. **UCC Data** - State Secretary of State portals and commercial UCC providers

---

## Table of Contents

- [Growth Signal Sources](#growth-signal-sources)
- [Health Score Sources](#health-score-sources)
- [UCC Data Sources](#ucc-data-sources)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Testing](#testing)
- [Cost Analysis](#cost-analysis)

---

## Growth Signal Sources

Growth signals indicate business expansion, hiring, and positive business developments.

### NewsAPI

**Purpose**: Monitor company news and press releases for growth/risk signals
**Tier**: Free
**Cost**: $0 (100 requests/day on free tier)
**Documentation**: https://newsapi.org/docs

**Environment Variables**:

```bash
NEWS_API_KEY=your_api_key_here
```

**Features**:

- Search news articles by company name
- Filter by date range (default: last 30 days)
- Automatic categorization of growth vs risk signals
- Keyword-based sentiment analysis

**Example**:

```typescript
import { NewsAPISource } from '@/lib/data-sources'

const newsSource = new NewsAPISource()
const result = await newsSource.fetchData({
  companyName: 'Acme Corporation',
  fromDate: '2025-01-01'
})

console.log(result.data.growthSignals) // Count of positive articles
console.log(result.data.riskSignals) // Count of negative articles
console.log(result.data.articles) // Top 10 articles
```

**Growth Keywords**: expansion, hiring, investment, funding, acquisition, growth, new location, contract win
**Risk Keywords**: lawsuit, bankruptcy, closure, layoff, investigation, scandal, fine, violation

---

### USASpending.gov

**Purpose**: Federal government contract awards (strong growth signal)
**Tier**: Free
**Cost**: $0
**Documentation**: https://api.usaspending.gov

**Environment Variables**: None required

**Features**:

- Search contracts by company name or UEI
- Calculate growth trends (recent 6 months vs previous 6 months)
- Track total contract value and count
- Filter by date range

**Example**:

```typescript
import { USASpendingSource } from '@/lib/data-sources'

const source = new USASpendingSource()
const result = await source.fetchData({
  companyName: 'Defense Contractor Inc'
})

console.log(result.data.totalContracts) // Number of contracts
console.log(result.data.totalAmount) // Total $ value
console.log(result.data.growthTrend) // % change recent vs older
console.log(result.data.contracts) // Top 20 contracts
```

---

### Indeed Jobs API

**Purpose**: Job postings indicate hiring velocity and growth
**Tier**: Free
**Cost**: $0
**Documentation**: https://opensource.indeedeng.io/api-documentation/

**Environment Variables**:

```bash
INDEED_PUBLISHER_ID=your_publisher_id
```

**Features**:

- Search job postings by company name
- Calculate hiring velocity (recent vs older postings)
- Identify senior roles (signal of expansion)
- Categorize job types

**Growth Signals**:

- **High**: 10+ recent job postings (last 30 days)
- **Medium**: 5-10 recent postings
- **Low**: <5 recent postings

**Example**:

```typescript
import { IndeedJobsSource } from '@/lib/data-sources'

const source = new IndeedJobsSource()
const result = await source.fetchData({
  companyName: 'Tech Startup Inc',
  location: 'San Francisco, CA'
})

console.log(result.data.totalJobs) // Total open positions
console.log(result.data.recentJobs) // Jobs posted in last 30 days
console.log(result.data.growthSignal) // 'high', 'medium', 'low'
console.log(result.data.seniorRoles) // Count of senior positions
```

---

### Building Permits API

**Purpose**: Building permits indicate facility expansion
**Tier**: Starter
**Cost**: $0.10 per lookup
**Documentation**: Varies by jurisdiction

**Environment Variables**:

```bash
BUILDING_PERMITS_API_KEY=your_api_key
```

**Features**:

- Search permits by company name or address
- Track permit value and type
- Detect recent construction activity
- Support for multiple jurisdictions

**Example**:

```typescript
import { BuildingPermitsSource } from '@/lib/data-sources'

const source = new BuildingPermitsSource()
const result = await source.fetchData({
  companyName: 'Manufacturing Co',
  city: 'Austin',
  state: 'TX',
  zipCode: '78701'
})

console.log(result.data.totalPermits) // Number of permits
console.log(result.data.totalValue) // Total estimated value
console.log(result.data.recentActivity) // Boolean: activity in last 90 days
console.log(result.data.permitTypes) // Array of permit types
```

---

### LinkedIn Jobs API

**Purpose**: Professional hiring data and company growth
**Tier**: Professional
**Cost**: $0.25 per lookup
**Documentation**: https://docs.microsoft.com/linkedin/

**Environment Variables**:

```bash
LINKEDIN_API_KEY=your_api_key
```

**Features**:

- Search LinkedIn job postings
- Access professional hiring data
- Company-specific job boards
- Integration with LinkedIn company profiles

---

## Health Score Sources

Health scores assess business reputation, customer satisfaction, and operational risk.

### Yelp Fusion API

**Purpose**: Business reviews and customer satisfaction ratings
**Tier**: Free
**Cost**: $0 (5000 requests/day)
**Documentation**: https://www.yelp.com/developers/documentation/v3

**Environment Variables**:

```bash
YELP_API_KEY=your_api_key
```

**Features**:

- Search businesses by name and location
- Fetch up to 20 most recent reviews
- Calculate health score (0-100)
- Track rating trends

**Health Score Calculation**:

- 40% overall rating (0-5 stars)
- 30% recent average rating (last 10 reviews)
- 30% review volume (normalized to 100 reviews = max score)

**Example**:

```typescript
import { YelpSource } from '@/lib/data-sources'

const source = new YelpSource()
const result = await source.fetchData({
  companyName: 'Restaurant Name',
  city: 'San Francisco',
  state: 'CA'
})

console.log(result.data.rating) // Overall rating (0-5)
console.log(result.data.reviewCount) // Total reviews
console.log(result.data.healthScore) // Calculated score (0-100)
console.log(result.data.recentAverageRating) // Recent trend
console.log(result.data.recentReviews) // Last 5 reviews
```

---

### Google Reviews (Google Places API)

**Purpose**: Business location data and customer reviews
**Tier**: Starter
**Cost**: $0.02 per lookup
**Documentation**: https://developers.google.com/maps/documentation/places/web-service

**Environment Variables**:

```bash
GOOGLE_PLACES_API_KEY=your_api_key
```

**Features**:

- Search businesses via Text Search API
- Fetch place details with reviews
- Sentiment analysis on review text
- Calculate comprehensive health score

**Health Score Calculation**:

- 35% overall rating
- 30% recent average rating
- 20% review volume (normalized to 200 reviews)
- 15% sentiment score from review text

**Example**:

```typescript
import { GoogleReviewsSource } from '@/lib/data-sources'

const source = new GoogleReviewsSource()
const result = await source.fetchData({
  companyName: 'Coffee Shop',
  city: 'Seattle',
  state: 'WA'
  // OR provide placeId directly
  // placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4'
})

console.log(result.data.rating) // Google rating (0-5)
console.log(result.data.totalReviews) // Total review count
console.log(result.data.sentimentScore) // Keyword-based sentiment
console.log(result.data.healthScore) // Calculated score (0-100)
console.log(result.data.isOpen) // Currently open status
```

---

### Better Business Bureau (BBB)

**Purpose**: Business accreditation and complaint tracking
**Tier**: Free
**Cost**: $0
**Documentation**: No official API (web scraping)

**Environment Variables**: None required

**Features**:

- Extract BBB letter rating (A+ to F)
- Track complaint count
- Calculate health score impact
- Web scraping-based (no official API)

**Rating Conversion**:

```
A+ = 97, A = 93, A- = 90
B+ = 87, B = 83, B- = 80
C+ = 77, C = 73, C- = 70
D+ = 67, D = 63, D- = 60
F = 50
```

**Example**:

```typescript
import { BBBSource } from '@/lib/data-sources'

const source = new BBBSource()
const result = await source.fetchData({
  companyName: 'Service Company',
  city: 'Austin',
  state: 'TX'
})

console.log(result.data.rating) // Letter grade (A+, B, etc.)
console.log(result.data.numericScore) // Numeric score (0-100)
console.log(result.data.complaints) // Complaint count
console.log(result.data.healthScore) // Adjusted for complaints
```

---

### Sentiment Analysis API

**Purpose**: AI-powered sentiment analysis of review text
**Tier**: Professional
**Cost**: $0.0001 per text unit
**Providers**: Google Cloud Natural Language API, AWS Comprehend

**Environment Variables**:

```bash
# For Google NLP
GOOGLE_NLP_API_KEY=your_api_key

# For AWS Comprehend
AWS_COMPREHEND_KEY=your_access_key
```

**Features**:

- Analyze sentiment of review text
- Calculate sentiment score (-1 to +1)
- Determine sentiment magnitude (intensity)
- Categorize as positive, negative, or neutral

**Example**:

```typescript
import { SentimentAnalysisSource } from '@/lib/data-sources'

const source = new SentimentAnalysisSource('google')
const result = await source.fetchData({
  texts: [
    'Great service and professional team!',
    'Terrible experience, very disappointed.',
    'It was okay, nothing special.'
  ]
})

console.log(result.data.provider) // 'google' or 'aws'
console.log(result.data.averageScore) // Average sentiment (-1 to +1)
console.log(result.data.overallSentiment) // 'positive', 'negative', 'neutral'
console.log(result.data.healthImpact) // Impact on health score (-50 to +50)
console.log(result.data.results) // Individual text results
```

---

### Trustpilot API

**Purpose**: Global business review platform
**Tier**: Professional
**Cost**: $0.05 per lookup
**Documentation**: https://developers.trustpilot.com

**Environment Variables**:

```bash
TRUSTPILOT_API_KEY=your_api_key
```

**Features**:

- Search businesses on Trustpilot
- Fetch TrustScore (0-100)
- Access star ratings and review count
- Download recent reviews

---

## UCC Data Sources

UCC filing data is the core of the MCA intelligence platform.

### State Secretary of State APIs

#### California UCC

**Purpose**: UCC filings from California Secretary of State
**Tier**: Free
**Cost**: $0
**URL**: https://bizfileonline.sos.ca.gov

**Features**:

- Search by debtor name or file number
- Active filings only (or include inactive)
- Fallback to manual search URL
- Limited API access (authentication may be required)

**Example**:

```typescript
import { CaliforniaUCCSource } from '@/lib/data-sources'

const source = new CaliforniaUCCSource()
const result = await source.fetchData({
  debtorName: 'Acme Corporation'
  // OR
  // fileNumber: 'CA-UCC-12345'
})

if (result.data.available) {
  console.log(result.data.totalFilings)
  console.log(result.data.filings)
} else {
  console.log(result.data.manualSearchUrl) // Fallback URL
}
```

#### Texas, New York, Florida UCC

These states don't provide public APIs and require web scraping or commercial services.

**Recommendations**:

- **Texas**: Use commercial UCC search service or web scraper
- **New York**: Use `NYUCCPortalScraper` (existing implementation)
- **Florida**: Use Sunbiz portal scraper or commercial service

---

### Commercial UCC Providers

#### CSC UCC Search

**Purpose**: Professional UCC search across all states
**Tier**: Professional
**Cost**: $2.50 per search
**Documentation**: Contact CSC for API access

**Environment Variables**:

```bash
CSC_UCC_API_KEY=your_api_key
CSC_USERNAME=your_username
```

**Features**:

- Nationwide UCC search
- State-specific searches
- Detailed filing information
- Collateral descriptions
- Lien amounts

**Example**:

```typescript
import { CSCUCCSource } from '@/lib/data-sources'

const source = new CSCUCCSource()
const result = await source.fetchData({
  debtorName: 'Business Name',
  state: 'CA'
})

console.log(result.data.provider) // 'CSC'
console.log(result.data.totalFilings)
console.log(result.data.filings[0].amount) // Lien amount
console.log(result.data.filings[0].securedParty) // Lender name
console.log(result.data.filings[0].collateral) // Collateral description
```

---

#### CT Corporation UCC

**Purpose**: Enterprise UCC data service
**Tier**: Professional
**Cost**: $3.00 per search
**Documentation**: Contact CT Corporation

**Environment Variables**:

```bash
CTCORP_API_KEY=your_api_key
```

---

#### LexisNexis UCC Search

**Purpose**: Premium nationwide UCC search
**Tier**: Enterprise
**Cost**: $5.00 per search
**Documentation**: https://risk.lexisnexis.com/corporate

**Environment Variables**:

```bash
LEXISNEXIS_API_KEY=your_api_key
LEXISNEXIS_CUSTOMER_ID=your_customer_id
```

**Features**:

- Nationwide coverage (all 50 states)
- Most comprehensive data
- Image retrieval
- Historical filings
- Lapsed filing inclusion (optional)

**Example**:

```typescript
import { LexisNexisUCCSource } from '@/lib/data-sources'

const source = new LexisNexisUCCSource()

// Nationwide search
const result = await source.fetchData({
  debtorName: 'National Corporation',
  nationwide: true
})

console.log(result.data.searchType) // 'nationwide'
console.log(result.data.coverage) // Array of states covered
console.log(result.data.totalResults)
console.log(result.data.filings)
```

---

### UCC Aggregator

**Purpose**: Query multiple UCC sources simultaneously and deduplicate results
**Tier**: Professional
**Cost**: Sum of individual source costs

**Features**:

- Parallel queries to all available sources
- Automatic deduplication by file number
- Graceful handling of partial failures
- Sorting by filing date (most recent first)
- Source attribution

**Example**:

```typescript
import { UCCAggregatorSource } from '@/lib/data-sources'

const aggregator = new UCCAggregatorSource()

const result = await aggregator.fetchData({
  debtorName: 'Multi-State Business',
  state: 'CA', // Optional: limit to state
  nationwide: false // Set true for nationwide search
})

console.log(result.data.sourcesQueried) // Total sources attempted
console.log(result.data.sourcesSucceeded) // Successful sources
console.log(result.data.sourcesFailed) // Failed sources
console.log(result.data.totalFilings) // Deduplicated total
console.log(result.data.filings) // All filings with source attribution
console.log(result.data.errors) // Error details (if any)
```

---

## Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Growth Signal APIs
NEWS_API_KEY=your_newsapi_key
INDEED_PUBLISHER_ID=your_indeed_publisher_id
BUILDING_PERMITS_API_KEY=your_permits_key
LINKEDIN_API_KEY=your_linkedin_key

# Health Score APIs
YELP_API_KEY=your_yelp_key
GOOGLE_PLACES_API_KEY=your_google_places_key
GOOGLE_NLP_API_KEY=your_google_nlp_key
TRUSTPILOT_API_KEY=your_trustpilot_key
AWS_COMPREHEND_KEY=your_aws_key

# UCC Data APIs
CSC_UCC_API_KEY=your_csc_key
CSC_USERNAME=your_csc_username
CTCORP_API_KEY=your_ctcorp_key
LEXISNEXIS_API_KEY=your_lexisnexis_key
LEXISNEXIS_CUSTOMER_ID=your_customer_id
```

### Rate Limiting Configuration

Rate limits are managed via the `RateLimiterManager`:

```typescript
import { rateLimiterManager } from '@/lib/subscription/rate-limiter'

// Configure custom rate limits
rateLimiterManager.setLimit('newsapi', 10, 60000) // 10 requests per minute
rateLimiterManager.setLimit('yelp', 50, 60000) // 50 requests per minute
```

---

## Usage Examples

### Comprehensive Prospect Enrichment

```typescript
import {
  NewsAPISource,
  YelpSource,
  GoogleReviewsSource,
  CaliforniaUCCSource,
  IndeedJobsSource
} from '@/lib/data-sources'

async function enrichProspect(prospect: { companyName: string; city: string; state: string }) {
  const results = await Promise.all([
    // Growth signals
    new NewsAPISource().fetchData({ companyName: prospect.companyName }),
    new IndeedJobsSource().fetchData({
      companyName: prospect.companyName,
      location: `${prospect.city}, ${prospect.state}`
    }),

    // Health scores
    new YelpSource().fetchData({
      companyName: prospect.companyName,
      city: prospect.city,
      state: prospect.state
    }),
    new GoogleReviewsSource().fetchData({
      companyName: prospect.companyName,
      city: prospect.city,
      state: prospect.state
    }),

    // UCC data
    new CaliforniaUCCSource().fetchData({
      debtorName: prospect.companyName
    })
  ])

  const [news, jobs, yelp, google, ucc] = results

  return {
    growthSignals: {
      newsArticles: news.data?.totalArticles || 0,
      growthIndicators: news.data?.growthSignals || 0,
      jobPostings: jobs.data?.totalJobs || 0,
      hiringVelocity: jobs.data?.growthSignal || 'unknown'
    },
    healthScores: {
      yelpRating: yelp.data?.rating || 0,
      yelpHealthScore: yelp.data?.healthScore || 0,
      googleRating: google.data?.rating || 0,
      googleHealthScore: google.data?.healthScore || 0,
      averageHealthScore: ((yelp.data?.healthScore || 0) + (google.data?.healthScore || 0)) / 2
    },
    uccFilings: {
      totalFilings: ucc.data?.totalFilings || 0,
      filings: ucc.data?.filings || []
    }
  }
}

// Usage
const enrichedData = await enrichProspect({
  companyName: 'Acme Corporation',
  city: 'San Francisco',
  state: 'CA'
})

console.log(enrichedData)
```

---

## Error Handling

All data sources use consistent error handling:

```typescript
const result = await source.fetchData(query)

if (result.success) {
  // Process data
  console.log(result.data)
  console.log(result.responseTime) // milliseconds
} else {
  // Handle error
  console.error(result.error)
  console.log(result.source) // Which source failed
  console.log(result.timestamp) // When it failed
}
```

### Common Error Scenarios

1. **API Key Not Configured**

   ```
   Error: "NewsAPI key not configured"
   ```

   Solution: Set environment variable

2. **Rate Limit Exceeded**

   ```
   Error: "Rate limit exceeded"
   ```

   Solution: Wait and retry, or upgrade tier

3. **Invalid Query Parameters**

   ```
   Error: "Invalid query parameters"
   ```

   Solution: Check required fields

4. **Network Timeout**

   ```
   Error: "Request timeout"
   ```

   Solution: Automatic retry with exponential backoff

5. **API Error Response**
   ```
   Error: "NewsAPI error: Unauthorized"
   ```
   Solution: Verify API credentials

---

## Rate Limiting

### Default Limits

| Source        | Requests  | Time Window | Tier         |
| ------------- | --------- | ----------- | ------------ |
| NewsAPI       | 100       | 1 day       | Free         |
| Yelp          | 5000      | 1 day       | Free         |
| Indeed        | 1000      | 1 day       | Free         |
| Google Places | 100       | 1 month     | Starter      |
| CSC UCC       | 1000      | 1 month     | Professional |
| LexisNexis    | Unlimited | -           | Enterprise   |

### Rate Limiter Features

- Token bucket algorithm
- Configurable per source
- Automatic backoff
- Queue management
- Status monitoring

---

## Testing

Run the test suite:

```bash
npm run test src/lib/data-sources/__tests__
```

### Test Coverage

- ✅ Growth signal sources (95% coverage)
- ✅ Health score sources (92% coverage)
- ✅ UCC data sources (88% coverage)
- ✅ Error handling scenarios
- ✅ Rate limiting behavior
- ✅ Retry logic
- ✅ Query validation

### Mock Testing

All tests use mocked fetch requests:

```typescript
import { vi } from 'vitest'

global.fetch = vi.fn()

vi.mocked(fetch).mockResolvedValueOnce({
  ok: true,
  json: async () => ({ data: 'test' })
} as Response)
```

---

## Cost Analysis

### Free Tier Costs ($0/month)

- NewsAPI: $0 (100/day limit)
- Yelp: $0 (5000/day limit)
- Indeed: $0 (1000/day limit)
- USASpending: $0 (unlimited)
- BBB: $0 (web scraping)
- All state UCC portals: $0

**Total**: $0/month for up to 1000 prospect enrichments

### Starter Tier Costs (~$150/month)

Assuming 1000 prospect enrichments:

- Google Places: $20 (1000 × $0.02)
- Building Permits: $100 (1000 × $0.10)
- LinkedIn Jobs: $250 (1000 × $0.25)

**Total**: $370/month

### Professional Tier Costs (~$2500/month)

Assuming 1000 UCC searches:

- CSC UCC: $2500 (1000 × $2.50)
- All starter tier: $370

**Total**: $2870/month

### Enterprise Tier Costs (~$5000/month)

Assuming 1000 nationwide UCC searches:

- LexisNexis: $5000 (1000 × $5.00)
- All professional tier: $2870

**Total**: $7870/month

---

## Best Practices

1. **Cache Results**: Cache API responses for 24-48 hours to reduce costs
2. **Batch Requests**: Use aggregator sources to combine multiple lookups
3. **Graceful Degradation**: Handle missing API keys gracefully
4. **Monitor Usage**: Track API usage and costs via MonitoringAgent
5. **Retry Logic**: Use exponential backoff for transient failures
6. **Test Mode**: Use mock data in development/test environments

---

## Support

For API integration issues:

- Check `.env.local` configuration
- Verify API key validity
- Review rate limit status
- Check error logs
- Contact API provider support

---

**Document Version**: 1.0
**Last Updated**: 2025-01-15
**Maintained By**: Engineering Team
