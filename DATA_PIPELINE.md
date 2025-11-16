# Data Ingestion & Enrichment Pipeline

## Overview

The UCC-MCA Intelligence Platform now includes a comprehensive **automated data ingestion and enrichment pipeline** that transforms raw UCC filing data into actionable business intelligence.

This pipeline was implemented in response to the DataAnalyzerAgent's recommendation (identified as a high-priority improvement in the Agentic Forces system).

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                   Data Pipeline Architecture                │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Data Sources    │
│  - State Portals │
│  - APIs          │
│  - Databases     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   DataIngestion  │──► Rate Limiting
│   Service        │──► Circuit Breaker
│                  │──► Retry Logic
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   UCC Filings    │
│   (Raw Data)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  DataEnrichment  │──► Growth Signals
│  Service         │──► Health Scores
│                  │──► Revenue Estimates
│                  │──► Industry Classification
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Prospects      │
│ (Enriched Data)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  DataRefresh     │──► Scheduled Ingestion
│  Scheduler       │──► Periodic Enrichment
│                  │──► Stale Data Refresh
└──────────────────┘
```

## Features

### 1. Data Ingestion Service (`DataIngestionService.ts`)

Fetches UCC filing data from multiple sources:

- **State UCC Portals**: Scrapes state-level UCC filing databases
- **External APIs**: Integrates with third-party data providers
- **Databases**: Queries internal or external databases

**Key Features:**
- Rate limiting (respects API limits)
- Circuit breaker pattern (prevents cascading failures)
- Exponential backoff retry logic
- Concurrent processing with batch support
- Comprehensive error handling

### 2. Data Enrichment Service (`DataEnrichmentService.ts`)

Enriches raw UCC filings with additional intelligence:

**Growth Signals:**
- Hiring signals (job postings)
- Permit signals (building permits, licenses)
- Contract signals (government contracts)
- Expansion signals (news, press releases)
- Equipment signals (financing, leases)

**Health Scoring:**
- Sentiment analysis from reviews
- Violation tracking (OSHA, health dept)
- Trend analysis (improving/declining)
- Review aggregation (Google, Yelp, BBB)

**Additional Enrichment:**
- Revenue estimation (ML-based)
- Industry classification
- Priority score calculation
- AI-generated narratives

### 3. Data Refresh Scheduler (`DataRefreshScheduler.ts`)

Manages periodic data refresh operations:

**Scheduled Operations:**
- **Ingestion**: Fetch new UCC filings (daily)
- **Enrichment**: Process incomplete data (6 hours)
- **Refresh**: Update stale data (12 hours)

**Event System:**
- Real-time status updates
- Error notifications
- Progress tracking
- Metrics collection

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Feature Flags
VITE_USE_MOCK_DATA=true              # Use mock data (set to false for production)
VITE_ENABLE_REALTIME_INGESTION=false # Enable real-time data ingestion
VITE_ENABLE_ML_ENRICHMENT=false      # Enable ML-based enrichment
VITE_ENABLE_AUTO_REFRESH=false       # Enable automatic data refresh

# Data Sources
VITE_UCC_API_ENDPOINT=https://api.ucc-filings.com/v1
VITE_UCC_API_KEY=your_api_key_here

# ML Services
VITE_ML_API_ENDPOINT=https://ml.example.com/v1
VITE_ML_API_KEY=your_ml_api_key_here

# Scraping
VITE_SCRAPER_ENDPOINT=https://scraper.example.com
```

### Configuration Files

Edit `src/lib/config/dataPipeline.ts` to customize:

**Data Sources:**
```typescript
sources: [
  {
    id: 'production-api',
    name: 'Production UCC API',
    type: 'api',
    endpoint: 'https://api.ucc-filings.com/v1',
    apiKey: 'your_api_key',
    rateLimit: 100 // requests per minute
  }
]
```

**Schedule Configuration:**
```typescript
schedule: {
  enabled: true,
  ingestionInterval: 24 * 60 * 60 * 1000, // 24 hours
  enrichmentInterval: 6 * 60 * 60 * 1000, // 6 hours
  refreshInterval: 12 * 60 * 60 * 1000,   // 12 hours
  staleDataThreshold: 7, // days
  autoStart: true
}
```

## Usage

### Basic Integration

```typescript
import { useDataPipeline } from '@/hooks/use-data-pipeline'

function App() {
  const {
    prospects,        // Enriched prospect data
    loading,          // Loading state
    error,            // Error message
    schedulerStatus,  // Scheduler status
    refresh,          // Manually refresh all data
    startScheduler,   // Start automatic refresh
    stopScheduler,    // Stop automatic refresh
    triggerIngestion  // Manually trigger ingestion
  } = useDataPipeline()

  return (
    <div>
      <button onClick={refresh}>Refresh Data</button>
      <button onClick={triggerIngestion}>Ingest New Data</button>

      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}

      <ProspectList prospects={prospects} />
    </div>
  )
}
```

### Manual Operations

```typescript
// Manually trigger ingestion
await triggerIngestion()

// Refresh all data
await refresh()

// Start/stop scheduler
startScheduler()
stopScheduler()
```

## Data Flow

### Ingestion → Enrichment → Storage

1. **Ingestion**:
   - Fetch UCC filings from configured sources
   - Apply rate limiting and retry logic
   - Filter for lapsed/defaulted filings

2. **Enrichment**:
   - Classify industry from company name
   - Detect growth signals from multiple sources
   - Calculate health scores
   - Estimate revenue
   - Generate priority score
   - Create AI narrative

3. **Storage**:
   - Store enriched prospects in memory (or database)
   - Update last refresh timestamps
   - Track enrichment confidence

4. **Refresh**:
   - Identify stale data (>7 days old)
   - Re-fetch growth signals
   - Recalculate health scores
   - Update priority scores

## Error Handling

### Retry Logic

The pipeline implements sophisticated retry logic:

- **Exponential Backoff**: Delays increase exponentially (2s → 4s → 8s → 16s)
- **Jitter**: Random delay added to prevent thundering herd
- **Max Delay Cap**: Delays capped at 30 seconds
- **Conditional Retry**: Only retries on retryable errors (5xx, timeouts, rate limits)

### Circuit Breaker

Prevents cascading failures:

- **Threshold**: Opens after 5 consecutive failures
- **Timeout**: Stays open for 60 seconds
- **Half-Open**: Attempts one request after timeout
- **Auto-Reset**: Closes on successful request

### Error Types

```typescript
// Retryable errors (will retry)
- Network errors
- 5xx server errors
- 429 rate limit errors
- Timeout errors

// Non-retryable errors (will fail immediately)
- 4xx client errors (except 429)
- Invalid data format
- Authentication failures
```

## Monitoring

### Scheduler Events

Subscribe to scheduler events:

```typescript
scheduler.on((event) => {
  console.log(event.type, event.data)
})

// Event types:
- 'ingestion-started'
- 'ingestion-completed'
- 'enrichment-started'
- 'enrichment-completed'
- 'refresh-started'
- 'refresh-completed'
- 'error'
```

### Status Metrics

```typescript
const status = scheduler.getStatus()

console.log({
  running: status.running,
  lastIngestionRun: status.lastIngestionRun,
  lastEnrichmentRun: status.lastEnrichmentRun,
  totalProspectsProcessed: status.totalProspectsProcessed,
  totalErrors: status.totalErrors
})
```

## Development vs Production

### Development Mode

```bash
# .env
VITE_USE_MOCK_DATA=true
```

- Uses mock data generators
- Faster iteration
- No external API calls
- Smaller dataset (100 prospects)

### Production Mode

```bash
# .env
VITE_USE_MOCK_DATA=false
VITE_ENABLE_REALTIME_INGESTION=true
VITE_ENABLE_ML_ENRICHMENT=true
```

- Real data ingestion from configured sources
- Full enrichment pipeline
- Scheduled refresh operations
- Larger dataset (configurable)

## Performance

### Optimizations

- **Batch Processing**: Processes data in configurable batch sizes
- **Concurrency Control**: Limits concurrent requests
- **Rate Limiting**: Respects API rate limits
- **Caching**: Reduces redundant API calls
- **Incremental Updates**: Only refreshes stale data

### Resource Usage

**Development:**
- Memory: ~50MB
- Network: Minimal (mock data)
- CPU: Low

**Production:**
- Memory: ~200-500MB (depending on dataset size)
- Network: Moderate (API calls, web scraping)
- CPU: Medium (ML inference, data processing)

## Testing

### Mock Data Mode

```typescript
// In development, automatically uses mock data
const prospects = generateProspects(100)
```

### Manual Testing

```bash
# Start dev server
npm run dev

# In browser console:
# Trigger manual ingestion
await window.triggerIngestion()

# Check scheduler status
console.log(window.schedulerStatus)
```

### Unit Tests

```bash
# Run tests (when implemented)
npm test
```

## Roadmap

### Planned Enhancements

- [ ] **Database Integration**: Store prospects in PostgreSQL/MongoDB
- [ ] **Real-time Scraping**: Implement Playwright-based state portal scrapers
- [ ] **ML Models**: Train custom models for revenue estimation
- [ ] **Web Scraping**: Implement growth signal detection from web sources
- [ ] **API Integrations**: Connect to job boards, permit databases, etc.
- [ ] **Webhooks**: Real-time notifications for new filings
- [ ] **Analytics**: Data quality metrics and ingestion analytics
- [ ] **Multi-tenant**: Support for multiple organizations

## Troubleshooting

### Common Issues

**1. No data appearing:**
```bash
# Check if using mock data
console.log(import.meta.env.VITE_USE_MOCK_DATA)

# Manually trigger ingestion
await triggerIngestion()
```

**2. Scheduler not running:**
```typescript
// Check scheduler status
console.log(schedulerStatus)

// Manually start
startScheduler()
```

**3. API errors:**
```bash
# Check API key
echo $VITE_UCC_API_KEY

# Check circuit breaker state
console.log(circuitBreakerState)
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT License - See [LICENSE](./LICENSE)
