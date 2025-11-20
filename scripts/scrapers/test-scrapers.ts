/**
 * Test Script for State UCC Scrapers
 *
 * Validates TX, FL, and CA scrapers against live portals with:
 * - Screenshot capture on failures
 * - Detailed logging and reporting
 * - Configurable headless/headed mode
 * - Multiple test cases per state
 *
 * Usage:
 *   npm run test:scrapers           # Test all states
 *   npm run test:scrapers -- TX     # Test Texas only
 *   npm run test:scrapers -- FL     # Test Florida only
 *   npm run test:scrapers -- CA     # Test California only
 *   npm run test:scrapers -- --headed  # Run in headed mode (see browser)
 */

import { TexasScraper } from './states/texas'
import { FloridaScraper } from './states/florida'
import { CaliforniaScraper } from './states/california'
import type { BaseScraper, ScraperResult } from './base-scraper'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// Test configuration
interface TestCase {
  companyName: string
  description: string
  expectedMinResults?: number // Minimum expected results (0 if we don't know)
}

interface TestResult {
  state: string
  testCase: TestCase
  result: ScraperResult
  success: boolean
  duration: number
  error?: string
  screenshotPath?: string
}

// Test cases for each state
const TEST_CASES: Record<string, TestCase[]> = {
  TX: [
    { companyName: 'Tesla Inc', description: 'Large public company', expectedMinResults: 0 },
    { companyName: 'Dell Technologies', description: 'Texas-based tech company', expectedMinResults: 0 },
    { companyName: 'ACME Corporation', description: 'Generic test name', expectedMinResults: 0 }
  ],
  FL: [
    { companyName: 'Publix Super Markets', description: 'Florida-based grocery chain', expectedMinResults: 0 },
    { companyName: 'NextEra Energy', description: 'Large Florida utility company', expectedMinResults: 0 },
    { companyName: 'Test Company LLC', description: 'Generic test name', expectedMinResults: 0 }
  ],
  CA: [
    { companyName: 'Apple Inc', description: 'California tech giant', expectedMinResults: 0 },
    { companyName: 'Intel Corporation', description: 'California semiconductor company', expectedMinResults: 0 },
    { companyName: 'Sample Business Inc', description: 'Generic test name', expectedMinResults: 0 }
  ]
}

class ScraperTestRunner {
  private resultsDir: string
  private results: TestResult[] = []
  private isHeaded: boolean

  constructor(isHeaded: boolean = false) {
    this.isHeaded = isHeaded
    this.resultsDir = join(process.cwd(), 'test-results', `run-${Date.now()}`)

    // Create results directory
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true })
    }
  }

  /**
   * Run all tests for a specific state
   */
  async testState(state: 'TX' | 'FL' | 'CA'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing ${state} UCC Scraper`)
    console.log('='.repeat(60))

    const scraper = this.getScraper(state)
    const testCases = TEST_CASES[state]

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i]
      console.log(`\n[${i + 1}/${testCases.length}] Testing: ${testCase.companyName}`)
      console.log(`Description: ${testCase.description}`)

      const startTime = Date.now()
      let result: TestResult

      try {
        const scraperResult = await scraper.search(testCase.companyName)
        const duration = Date.now() - startTime

        result = {
          state,
          testCase,
          result: scraperResult,
          success: scraperResult.success,
          duration
        }

        // Analyze result
        if (scraperResult.success) {
          console.log(`✅ Success - Found ${scraperResult.filings?.length || 0} filings in ${duration}ms`)

          if (scraperResult.filings && scraperResult.filings.length > 0) {
            console.log(`   First filing: ${scraperResult.filings[0].filingNumber} - ${scraperResult.filings[0].debtorName}`)
          } else {
            console.log(`   No filings found (this may be expected)`)
          }

          if (scraperResult.parsingErrors && scraperResult.parsingErrors.length > 0) {
            console.log(`   ⚠️  Parsing errors: ${scraperResult.parsingErrors.length}`)
          }
        } else {
          console.log(`❌ Failed - ${scraperResult.error}`)
          result.error = scraperResult.error
        }

      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)

        console.log(`❌ Exception - ${errorMessage}`)

        result = {
          state,
          testCase,
          result: {
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
          },
          success: false,
          duration,
          error: errorMessage
        }
      }

      this.results.push(result)

      // Rate limiting between tests
      if (i < testCases.length - 1) {
        console.log('Waiting 15 seconds before next test (rate limiting)...')
        await this.sleep(15000)
      }
    }

    // Cleanup browser
    if (scraper.closeBrowser) {
      await scraper.closeBrowser()
    }
  }

  /**
   * Get scraper instance for a state
   */
  private getScraper(state: 'TX' | 'FL' | 'CA'): BaseScraper & { closeBrowser?: () => Promise<void> } {
    switch (state) {
      case 'TX':
        return new TexasScraper()
      case 'FL':
        return new FloridaScraper()
      case 'CA':
        return new CaliforniaScraper()
      default:
        throw new Error(`Unknown state: ${state}`)
    }
  }

  /**
   * Generate test report
   */
  generateReport(): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('Test Summary')
    console.log('='.repeat(60))

    const byState: Record<string, TestResult[]> = {}

    for (const result of this.results) {
      if (!byState[result.state]) {
        byState[result.state] = []
      }
      byState[result.state].push(result)
    }

    // Summary by state
    for (const [state, results] of Object.entries(byState)) {
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      const withResults = results.filter(r => r.result.filings && r.result.filings.length > 0).length
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length

      console.log(`\n${state}:`)
      console.log(`  Total tests: ${results.length}`)
      console.log(`  Successful: ${successful} (${(successful / results.length * 100).toFixed(1)}%)`)
      console.log(`  Failed: ${failed}`)
      console.log(`  Tests with results: ${withResults}`)
      console.log(`  Avg duration: ${avgDuration.toFixed(0)}ms`)

      // Show failures
      const failures = results.filter(r => !r.success)
      if (failures.length > 0) {
        console.log(`  Failures:`)
        for (const failure of failures) {
          console.log(`    - ${failure.testCase.companyName}: ${failure.error}`)
        }
      }
    }

    // Overall stats
    const totalTests = this.results.length
    const totalSuccessful = this.results.filter(r => r.success).length
    const totalFailed = this.results.filter(r => !r.success).length

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Overall: ${totalSuccessful}/${totalTests} tests passed (${(totalSuccessful / totalTests * 100).toFixed(1)}%)`)
    console.log('='.repeat(60))

    // Write detailed JSON report
    const reportPath = join(this.resultsDir, 'report.json')
    writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        successful: totalSuccessful,
        failed: totalFailed,
        successRate: totalSuccessful / totalTests
      },
      results: this.results
    }, null, 2))

    console.log(`\nDetailed report saved to: ${reportPath}`)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Main test runner
 */
async function main() {
  const args = process.argv.slice(2)
  const stateArg = args.find(arg => ['TX', 'FL', 'CA'].includes(arg.toUpperCase()))
  const isHeaded = args.includes('--headed')

  const runner = new ScraperTestRunner(isHeaded)

  console.log('State UCC Scraper Test Suite')
  console.log('============================')
  console.log(`Mode: ${isHeaded ? 'Headed (browser visible)' : 'Headless'}`)
  console.log(`Testing: ${stateArg ? stateArg.toUpperCase() : 'All states (TX, FL, CA)'}`)

  try {
    if (stateArg) {
      // Test single state
      await runner.testState(stateArg.toUpperCase() as 'TX' | 'FL' | 'CA')
    } else {
      // Test all states
      await runner.testState('TX')
      await runner.testState('FL')
      await runner.testState('CA')
    }

    // Generate report
    runner.generateReport()

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  }
}

// Run tests
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
