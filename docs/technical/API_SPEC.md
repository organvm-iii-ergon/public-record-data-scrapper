# Backend API Specification

This document outlines the REST API endpoints for the data enrichment backend (to be implemented).

## Base URL

```
http://localhost:3000/api
```

## Authentication

All endpoints require JWT authentication via Bearer token:

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Enrichment

#### POST /api/prospects/enrich

Enrich a prospect with data from multiple sources.

**Request Body:**
```json
{
  "companyName": "Acme Corporation",
  "state": "CA",
  "tier": "free",
  "userId": "user-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "companyName": "Acme Corporation",
    "normalizedName": "Acme Corporation",
    "state": "CA",
    "dataAcquisition": {
      "sec-edgar": { "cik": "1234567", "sicCode": "5812" },
      "osha": { "violations": 2, "totalPenalties": 5000 }
    },
    "uccFilings": [],
    "sources": ["sec-edgar", "osha"],
    "searchUrls": {
      "ucc": "https://businesssearch.sos.ca.gov/..."
    }
  },
  "cost": 0,
  "responseTime": 3245,
  "timestamp": "2024-11-05T22:00:00.000Z"
}
```

#### GET /api/prospects/:id

Get enriched prospect details.

**Response:**
```json
{
  "id": "prospect-123",
  "companyName": "Acme Corporation",
  "enrichmentData": { ... },
  "lastEnriched": "2024-11-05T22:00:00.000Z"
}
```

### Usage

#### GET /api/usage

Get current user's usage statistics.

**Query Parameters:**
- `period`: "daily" or "monthly" (default: "monthly")

**Response:**
```json
{
  "userId": "user-123",
  "tier": "free",
  "period": "monthly",
  "totalCalls": 45,
  "successfulCalls": 42,
  "failedCalls": 3,
  "totalCost": 0,
  "quotaUsed": 45,
  "quotaLimit": 100,
  "quotaRemaining": 55,
  "percentUsed": 45.0,
  "lastUpdated": "2024-11-05T22:00:00.000Z"
}
```

#### POST /api/usage/track

Track a usage event (internal use).

**Request Body:**
```json
{
  "userId": "user-123",
  "action": "data-fetch",
  "source": "sec-edgar",
  "cost": 0,
  "success": true,
  "metadata": {
    "companyName": "Acme Inc"
  }
}
```

### Sources

#### GET /api/sources/status

Get status of all data sources.

**Response:**
```json
{
  "sources": [
    {
      "name": "sec-edgar",
      "tier": "free",
      "cost": 0,
      "available": true,
      "configured": true
    },
    {
      "name": "dnb",
      "tier": "starter",
      "cost": 0.50,
      "available": true,
      "configured": false,
      "message": "API key not configured"
    }
  ]
}
```

#### GET /api/sources/:source/status

Get status of a specific data source.

**Response:**
```json
{
  "name": "sec-edgar",
  "tier": "free",
  "cost": 0,
  "available": true,
  "configured": true,
  "rateLimit": {
    "maxRequests": 10,
    "period": "second"
  }
}
```

### Scraping

#### GET /api/scraper/states

Get list of supported states for UCC scraping.

**Response:**
```json
{
  "states": ["CA", "TX", "FL"],
  "count": 3
}
```

#### GET /api/scraper/manual-url

Get manual search URL for a company.

**Query Parameters:**
- `companyName`: Company name
- `state`: State code

**Response:**
```json
{
  "state": "CA",
  "companyName": "Acme Inc",
  "manualSearchUrl": "https://businesssearch.sos.ca.gov/..."
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-11-05T22:00:00.000Z"
}
```

### Common Error Codes

- `QUOTA_EXCEEDED`: User has exceeded their monthly quota
- `INVALID_TIER`: User tier doesn't have access to requested source
- `SOURCE_UNAVAILABLE`: Data source is temporarily unavailable
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `INVALID_REQUEST`: Request parameters are invalid
- `UNAUTHORIZED`: Authentication failed

## WebSocket Events (Future)

Real-time enrichment progress updates:

```javascript
// Connect
const ws = new WebSocket('ws://localhost:3000/enrichment')

// Subscribe to enrichment
ws.send(JSON.stringify({
  action: 'subscribe',
  enrichmentId: 'enrichment-123'
}))

// Receive progress updates
ws.onmessage = (event) => {
  const update = JSON.parse(event.data)
  // { stage: 'data-acquisition', status: 'in-progress' }
}
```

## Database Schema (PostgreSQL)

### prospects

```sql
CREATE TABLE prospects (
  id UUID PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255),
  state VARCHAR(2) NOT NULL,
  priority_score DECIMAL(5,2),
  health_grade VARCHAR(1),
  enrichment_data JSONB,
  last_enriched TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_company_name (company_name),
  INDEX idx_state (state)
);
```

### ucc_filings

```sql
CREATE TABLE ucc_filings (
  id UUID PRIMARY KEY,
  prospect_id UUID REFERENCES prospects(id),
  filing_number VARCHAR(50) NOT NULL,
  debtor_name VARCHAR(255),
  secured_party VARCHAR(255),
  filing_date DATE,
  collateral TEXT,
  status VARCHAR(20),
  filing_type VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_prospect_id (prospect_id),
  INDEX idx_filing_number (filing_number)
);
```

### usage_logs

```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  source VARCHAR(50),
  cost DECIMAL(10,2),
  success BOOLEAN,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

### user_tiers

```sql
CREATE TABLE user_tiers (
  id UUID PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL UNIQUE,
  tier VARCHAR(20) NOT NULL,
  quota_used INTEGER DEFAULT 0,
  quota_limit INTEGER,
  last_reset DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id (user_id)
);
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ucc_platform

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
DNB_API_KEY=your_dnb_key
GOOGLE_PLACES_API_KEY=your_google_key
CLEARBIT_API_KEY=your_clearbit_key
EXPERIAN_API_KEY=your_experian_key
ZOOMINFO_API_KEY=your_zoominfo_key
NEWSAPI_KEY=your_newsapi_key

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRY=7d

# Server
PORT=3000
NODE_ENV=production
```

## Rate Limits

Per user rate limits (in addition to tier quotas):

- Free tier: 10 requests/minute
- Starter tier: 30 requests/minute
- Professional tier: 100 requests/minute
- Enterprise tier: Unlimited

## Implementation Checklist

- [ ] Express server setup
- [ ] PostgreSQL connection and migrations
- [ ] JWT authentication middleware
- [ ] Enrichment endpoints
- [ ] Usage tracking endpoints
- [ ] Source status endpoints
- [ ] Error handling middleware
- [ ] Request validation
- [ ] Rate limiting middleware
- [ ] CORS configuration
- [ ] WebSocket server
- [ ] BullMQ job queue
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Integration tests
- [ ] Load testing
- [ ] Deployment configuration
