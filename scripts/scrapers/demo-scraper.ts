/**
 * Demo Script for UCC Scrapers
 *
 * This script demonstrates how to use the UCC scrapers for CA, TX, FL, and NY.
 * It's meant for testing and demonstration purposes.
 *
 * Usage:
 *   npm install
 *   npx ts-node scripts/scrapers/demo-scraper.ts
 *
 * Note: Make sure Puppeteer and Playwright are installed:
 *   npm install -D puppeteer playwright
 */

import { CaliforniaScraper } from './states/california'
import { TexasScraper } from './states/texas'
import { FloridaScraper } from './states/florida'
import { NewYorkScraper } from './states/newyork'

async function main() {
  console.log('=== UCC Scraper Demo ===\n')

  const companyName = process.argv[2] || 'ACME Corporation'
  const state = process.argv[3]?.toUpperCase()

  console.log(`Searching for: ${companyName}`)
  if (state) {
    console.log(`State: ${state}\n`)
  } else {
    console.log('State: All available states\n')
  }

  const scrapers = {
    CA: new CaliforniaScraper(),
    TX: new TexasScraper(),
    FL: new FloridaScraper(),
    NY: new NewYorkScraper()
  }

  const statesToSearch = state ? [state] : Object.keys(scrapers)

  for (const stateCode of statesToSearch) {
    const scraper = scrapers[stateCode as keyof typeof scrapers]
    if (!scraper) {
      console.log(`\n❌ No scraper available for ${stateCode}`)
      continue
    }

    console.log(`\n🔍 Searching ${stateCode} for "${companyName}"...`)
    console.log('─'.repeat(60))

    try {
      const result = await scraper.search(companyName)

      if (result.success) {
        console.log(`✅ Search completed successfully`)
        console.log(`Found ${result.filings?.length || 0} filings`)

        if (result.retryCount && result.retryCount > 0) {
          console.log(`⚠️  Required ${result.retryCount} retries`)
        }

        if (result.parsingErrors && result.parsingErrors.length > 0) {
          console.log(`⚠️  ${result.parsingErrors.length} parsing errors occurred`)
        }

        if (result.filings && result.filings.length > 0) {
          console.log('\nFilings:')
          result.filings.slice(0, 5).forEach((filing, idx) => {
            console.log(`  ${idx + 1}. ${filing.filingNumber}`)
            console.log(`     Debtor: ${filing.debtorName}`)
            console.log(`     Secured Party: ${filing.securedParty}`)
            console.log(`     Date: ${filing.filingDate}`)
            console.log(`     Status: ${filing.status}`)
            console.log(`     Type: ${filing.filingType}`)
          })

          if (result.filings.length > 5) {
            console.log(`  ... and ${result.filings.length - 5} more`)
          }
        }

        if (result.searchUrl) {
          console.log(`\nManual search URL: ${result.searchUrl}`)
        }
      } else {
        console.log(`❌ Search failed: ${result.error}`)
        if (result.searchUrl) {
          console.log(`Try manually at: ${result.searchUrl}`)
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Close browser if the scraper has one
    if ('closeBrowser' in scraper && typeof scraper.closeBrowser === 'function') {
      await scraper.closeBrowser()
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Demo completed')
}

// Run the demo
main().catch(console.error)
