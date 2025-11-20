# UCC Scrapers

Real implementations of UCC (Uniform Commercial Code) filing scrapers for California, Texas, Florida, and New York.

## Overview

These scrapers replace the previous mock implementations with real web scraping functionality using Puppeteer (headless Chrome) to fetch UCC filing data from state Secretary of State portals.

## Supported States

| State | Code | Portal URL | Status |
|-------|------|-----------|---------|
| California | CA | https://bizfileonline.sos.ca.gov/search/ucc | ✅ Implemented |
| Texas | TX | https://www.sos.state.tx.us/ucc/index.shtml | ✅ Implemented |
| Florida | FL | https://www.floridaucc.com/uccweb/search.aspx | ✅ Implemented |
| New York | NY | https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame | ✅ Implemented |

## Features

- **Real web scraping** - Uses Puppeteer/Playwright to interact with actual state portals
- **Anti-detection measures** - Realistic user agents, viewport settings, typing delays
- **Automatic retries** - Exponential backoff retry logic for network errors
- **Rate limiting** - Built-in rate limiting (5 requests/minute) to respect portal servers
- **CAPTCHA detection** - Detects and reports CAPTCHA challenges
- **Multiple selector patterns** - Flexible CSS selectors to handle different page structures
- **Structured logging** - Production-ready logging with JSON output support
- **Validation** - Validates all scraped data before returning results
- **Error handling** - Comprehensive error handling and reporting

## Installation

```bash
# Install dependencies
npm install

# Install browser automation tools
npm install -D puppeteer playwright
```

## Usage

### Programmatic Usage

```typescript
import { CaliforniaScraper } from './scripts/scrapers/states/california'
import { TexasScraper } from './scripts/scrapers/states/texas'
import { FloridaScraper } from './scripts/scrapers/states/florida'
import { NewYorkScraper } from './scripts/scrapers/states/newyork'

// Create a scraper instance
const scraper = new CaliforniaScraper()

// Search for UCC filings
const result = await scraper.search('ACME Corporation LLC')

if (result.success) {
  console.log(`Found ${result.filings.length} filings`)
  result.filings.forEach(filing => {
    console.log(`${filing.filingNumber}: ${filing.debtorName}`)
  })
} else {
  console.error(`Error: ${result.error}`)
}

// Close the browser when done
await scraper.closeBrowser()
```

### Using the Demo Script

```bash
# Search all states
npx ts-node scripts/scrapers/demo-scraper.ts "ACME Corporation"

# Search specific state
npx ts-node scripts/scrapers/demo-scraper.ts "ACME Corporation" CA
```

### Using the ScraperAgent

```typescript
import { ScraperAgent } from './src/lib/agentic/agents/ScraperAgent'

const agent = new ScraperAgent()

// Search for filings
const result = await agent.executeTask({
  type: 'scrape-ucc',
  payload: {
    companyName: 'ACME Corporation',
    state: 'CA'
  }
})

// Get manual search URL
const urlResult = await agent.executeTask({
  type: 'get-manual-url',
  payload: {
    companyName: 'ACME Corporation',
    state: 'CA'
  }
})

// List available states
const statesResult = await agent.executeTask({
  type: 'list-available-states',
  payload: {}
})
```

## Architecture

### Base Scraper

All scrapers extend `BaseScraper` which provides:
- Retry logic with exponential backoff
- Rate limiting
- Structured logging
- Data validation
- Common utility methods

### State-Specific Scrapers

Each state has its own scraper that implements:
- `search(companyName: string): Promise<ScraperResult>` - Main search method
- `getManualSearchUrl(companyName: string): string` - Returns URL for manual searching

### Result Format

```typescript
interface ScraperResult {
  success: boolean
  filings?: UCCFiling[]
  error?: string
  searchUrl?: string
  timestamp: string
  retryCount?: number
  parsingErrors?: string[]
}

interface UCCFiling {
  filingNumber: string
  debtorName: string
  securedParty: string
  filingDate: string
  collateral: string
  status: 'active' | 'terminated' | 'lapsed'
  filingType: 'UCC-1' | 'UCC-3'
}
```

## Important Notes

### Legal and Ethical Considerations

- **Respect robots.txt** - Always check and respect the portal's robots.txt
- **Rate limiting** - Built-in rate limiting helps prevent server overload
- **Terms of Service** - Review and comply with each portal's Terms of Service
- **Manual verification** - Always verify critical data manually

### Technical Limitations

1. **CAPTCHAs** - Some portals may show CAPTCHAs; scrapers will detect and report this
2. **Authentication** - Texas portal requires login; automated search may not work without credentials
3. **Page Structure Changes** - State portals may update their HTML structure, breaking selectors
4. **Browser Requirements** - Requires Chrome/Chromium for Puppeteer
5. **Network Dependencies** - Requires stable internet connection

### State-Specific Notes

#### California
- Uses form-based search interface
- Free public access
- May occasionally show CAPTCHA

#### Texas
- **Requires SOS Portal account login** as of September 2025
- Automated scraping may not work without credentials
- New online-only filing system (no more paper filings)

#### Florida
- Uses ASP.NET-based search system
- Free public access
- Contains filings since January 1997

#### New York
- Uses Playwright instead of Puppeteer
- Free public access
- Well-structured search results

## Development

### Adding a New State

1. Create a new file in `scripts/scrapers/states/`
2. Extend `BaseScraper`
3. Implement `search()` and `getManualSearchUrl()`
4. Add to `ScraperAgent` in `src/lib/agentic/agents/ScraperAgent.ts`

Example:

```typescript
import { BaseScraper, ScraperResult } from '../base-scraper'
import puppeteer, { Browser, Page } from 'puppeteer'

export class MichiganScraper extends BaseScraper {
  constructor() {
    super({
      state: 'MI',
      baseUrl: 'https://example-mi-ucc-portal.gov',
      rateLimit: 5,
      timeout: 30000,
      retryAttempts: 2
    })
  }

  async search(companyName: string): Promise<ScraperResult> {
    // Implementation here
  }

  getManualSearchUrl(companyName: string): string {
    return this.config.baseUrl
  }
}
```

## Troubleshooting

### "Playwright not installed" error
```bash
npm install -D playwright
```

### "Browser failed to launch" error
```bash
# Install Chrome/Chromium dependencies (Linux)
sudo apt-get install -y chromium-browser

# Or use puppeteer bundled Chromium
npm install -D puppeteer
```

### "No result elements found" error
- The page structure may have changed
- Check if CAPTCHA is present
- Try accessing the manual search URL to verify the portal is accessible

### "CAPTCHA detected" error
- Use manual search URL provided in the result
- Consider implementing CAPTCHA solving service (if legally permitted)
- Reduce request frequency

## Testing

```bash
# Run all tests
npm test

# Run specific test
npm test -- scripts/scrapers
```

## License

See the main repository LICENSE file.
