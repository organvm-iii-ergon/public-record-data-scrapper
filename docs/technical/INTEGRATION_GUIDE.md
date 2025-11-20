# Integration Guide

This guide shows how to integrate the new enrichment pipeline with the existing UCC-MCA Intelligence Platform.

## Quick Start

### 1. Import the Agents

```typescript
import {
  EnrichmentOrchestratorAgent,
  DataAcquisitionAgent,
  MonitoringAgent
} from './src/lib/agentic'

import { usageTracker } from './src/lib/subscription/usage-tracker'
```

### 2. Set Up User Tier

```typescript
// Set user's subscription tier
const userId = 'user-123'
usageTracker.setUserTier(userId, 'free') // or 'starter', 'professional', 'enterprise'
```

### 3. Enrich a Prospect

```typescript
// Create orchestrator
const orchestrator = new EnrichmentOrchestratorAgent()

// Enrich prospect
const result = await orchestrator.executeTask({
  type: 'enrich-prospect',
  payload: {
    companyName: 'Acme Corporation',
    state: 'CA',
    tier: 'free',
    userId: userId
  }
})

if (result.success) {
  console.log('Enrichment data:', result.data)
  console.log('Sources used:', result.data.sources)
  console.log('Cost:', result.data.cost)
}
```

## React Component Integration

### Using the Hook

```typescript
import { useEnrichment } from './hooks/use-enrichment'

function ProspectEnrichmentButton({ prospect }) {
  const { enrich, loading, error, result, progress } = useEnrichment()

  const handleEnrich = async () => {
    await enrich({
      companyName: prospect.companyName,
      state: prospect.state,
      tier: 'free',
      userId: currentUser.id
    })
  }

  return (
    <div>
      <button 
        onClick={handleEnrich} 
        disabled={loading}
      >
        {loading ? 'Enriching...' : 'Enrich Data'}
      </button>

      {error && <div className="error">{error}</div>}

      {progress.length > 0 && (
        <div className="progress">
          {progress.map((stage, i) => (
            <div key={i}>
              {stage.stage}: {stage.status}
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="results">
          <h3>Enrichment Complete</h3>
          <p>Sources: {result.sources.join(', ')}</p>
          <p>Cost: ${result.cost}</p>
          <pre>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
```

## Adding Enrichment to Prospect Detail View

Update `src/components/ProspectDetailDialog.tsx`:

```typescript
import { useEnrichment } from '../hooks/use-enrichment'

function ProspectDetailDialog({ prospect, onClose }) {
  const { enrich, loading, result } = useEnrichment()

  const handleEnrich = async () => {
    await enrich({
      companyName: prospect.companyName,
      state: prospect.state,
      tier: 'free', // Get from user context
      userId: 'current-user-id'
    })
  }

  return (
    <Dialog>
      {/* Existing prospect details */}
      
      <div className="enrichment-section">
        <h3>Data Enrichment</h3>
        <button onClick={handleEnrich} disabled={loading}>
          Fetch Additional Data
        </button>

        {result && (
          <div className="enrichment-results">
            {/* Display SEC EDGAR data */}
            {result.data.dataAcquisition['sec-edgar'] && (
              <div>
                <h4>SEC EDGAR</h4>
                <p>CIK: {result.data.dataAcquisition['sec-edgar'].cik}</p>
                <p>SIC: {result.data.dataAcquisition['sec-edgar'].sicCode}</p>
              </div>
            )}

            {/* Display OSHA data */}
            {result.data.dataAcquisition['osha'] && (
              <div>
                <h4>Safety Record</h4>
                <p>Violations: {result.data.dataAcquisition['osha'].violations}</p>
                <p>Penalties: ${result.data.dataAcquisition['osha'].totalPenalties}</p>
              </div>
            )}

            {/* Display UCC filings */}
            {result.data.uccFilings.length > 0 && (
              <div>
                <h4>UCC Filings</h4>
                <ul>
                  {result.data.uccFilings.map(filing => (
                    <li key={filing.filingNumber}>
                      {filing.filingNumber} - {filing.securedParty}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
```

## Adding Usage Tracking Dashboard

Create a new component for usage statistics:

```typescript
import { useEffect, useState } from 'react'
import { MonitoringAgent } from '../lib/agentic'

function UsageDashboard({ userId }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const agent = new MonitoringAgent()
      const result = await agent.executeTask({
        type: 'get-usage',
        payload: { userId, period: 'monthly' }
      })

      if (result.success) {
        setStats(result.data)
      }
      setLoading(false)
    }

    loadStats()
  }, [userId])

  if (loading) return <div>Loading...</div>

  return (
    <div className="usage-dashboard">
      <h2>Usage Statistics</h2>
      <div className="stats-grid">
        <div className="stat">
          <h3>Quota Used</h3>
          <p>{stats.quotaUsed} / {stats.quotaLimit}</p>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${stats.percentUsed}%` }}
            />
          </div>
        </div>

        <div className="stat">
          <h3>Total Cost</h3>
          <p>${stats.totalCost.toFixed(2)}</p>
        </div>

        <div className="stat">
          <h3>Success Rate</h3>
          <p>
            {((stats.successfulCalls / stats.totalCalls) * 100).toFixed(1)}%
          </p>
        </div>

        <div className="stat">
          <h3>Tier</h3>
          <p>{stats.tier}</p>
        </div>
      </div>

      {stats.percentUsed > 80 && (
        <div className="warning">
          ⚠️ You're approaching your monthly quota limit!
        </div>
      )}
    </div>
  )
}
```

## Integrating with AgenticEngine

Update `src/lib/agentic/AgenticEngine.ts` to include enrichment agents:

```typescript
import { 
  DataAnalyzerAgent,
  OptimizerAgent,
  SecurityAgent,
  UXEnhancerAgent,
  DataAcquisitionAgent,
  MonitoringAgent,
  DataNormalizationAgent,
  ScraperAgent,
  EnrichmentOrchestratorAgent
} from './agents'

export class AgenticEngine {
  private agents: Agent[]

  constructor() {
    this.agents = [
      // Existing agents
      new DataAnalyzerAgent(),
      new OptimizerAgent(),
      new SecurityAgent(),
      new UXEnhancerAgent(),
      
      // New enrichment agents
      new DataAcquisitionAgent(),
      new MonitoringAgent(),
      new DataNormalizationAgent(),
      new ScraperAgent(),
      new EnrichmentOrchestratorAgent()
    ]
  }

  // ... rest of implementation
}
```

## Environment Setup

Add these environment variables to `.env`:

```bash
# Free tier sources (no API keys needed for demo)
# Production sources require API keys:

# D&B Direct
DNB_API_KEY=your_dnb_api_key_here

# Google Places
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here

# Clearbit
CLEARBIT_API_KEY=your_clearbit_api_key_here

# For Professional tier (future):
# EXPERIAN_API_KEY=your_experian_api_key_here
# ZOOMINFO_API_KEY=your_zoominfo_api_key_here
# NEWSAPI_KEY=your_newsapi_key_here
```

## Testing

### Run the Demo

```bash
# In browser console or Node.js
import { demoEnrichment } from './demo-enrichment'
await demoEnrichment()
```

### Manual Testing

```typescript
// Test individual agents
import { DataAcquisitionAgent } from './src/lib/agentic'

const agent = new DataAcquisitionAgent()

// Check SEC EDGAR
const result = await agent.executeTask({
  type: 'fetch-from-source',
  payload: {
    source: 'sec-edgar',
    query: { companyName: 'Apple Inc' }
  }
})

console.log(result)
```

## Best Practices

1. **Always check quota before enriching**
   ```typescript
   const quotaCheck = await monitoringAgent.executeTask({
     type: 'check-quota',
     payload: { userId }
   })
   
   if (!quotaCheck.data.hasQuota) {
     // Show upgrade prompt
     return
   }
   ```

2. **Handle errors gracefully**
   ```typescript
   try {
     const result = await orchestrator.executeTask({ ... })
     if (!result.success) {
       // Show user-friendly error
       showError(result.error)
     }
   } catch (error) {
     // Log for debugging
     console.error(error)
     showError('An unexpected error occurred')
   }
   ```

3. **Show progress to users**
   ```typescript
   result.data.progress.forEach(stage => {
     updateProgressUI(stage.stage, stage.status)
   })
   ```

4. **Cache results**
   ```typescript
   // Store enrichment results in local state or database
   // to avoid redundant API calls
   ```

5. **Respect rate limits**
   ```typescript
   // The agents handle this automatically, but be mindful
   // of making too many parallel enrichment requests
   ```

## Troubleshooting

### "Rate limit exceeded" error
- Wait a few seconds and retry
- Check rate limiter configuration
- Consider upgrading tier for higher limits

### "Quota exceeded" error
- User has hit monthly limit
- Show upgrade prompt
- Reset occurs automatically each month

### "Source unavailable" error
- Check API key configuration
- Verify external API is accessible
- Check internet connectivity

### Data quality issues
- Use DataNormalizationAgent to clean data
- Review canonicalization rules
- Report issues for improvement

## Next Steps

1. Implement backend API (see `API_SPEC.md`)
2. Add Playwright for actual scraping
3. Set up PostgreSQL database
4. Configure BullMQ for job queue
5. Add WebSocket for real-time updates
6. Create admin dashboard
7. Add analytics and reporting
8. Implement caching layer
9. Set up monitoring and alerting
10. Deploy to production

## Support

For questions or issues:
- Check `ENRICHMENT_PIPELINE.md` for detailed documentation
- Review `API_SPEC.md` for backend API details
- See `demo-enrichment.ts` for working examples
