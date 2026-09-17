/**
 * Test Script for State UCC Scrapers
 *
 * Validates TX, FL, CA, and NY scrapers against live portals with:
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
 *   npm run test:scrapers -- NY     # Test New York only
 *   npm run test:scrapers -- --headed  # Run in headed mode (see browser)
 */

import { TexasScraper } from './states/texas'
import { FloridaScraper } from './states/florida'
import { CaliforniaScraper } from './states/california'
import { NewYorkScraper } from './states/newyork'
import type { BaseScraper, ScraperResult } from './base-scraper'
import { hasTexasAuth } from './auth-config'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'node:url'

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
  skipped?: boolean
  skipReason?: string
  screenshotPath?: string
  domPath?: string
}

// Test cases for each state
const TEST_CASES: Record<string, TestCase[]> = {
  TX: [
    { companyName: 'Tesla Inc', description: 'Large public company', expectedMinResults: 0 },
    {
      companyName: 'Dell Technologies',
      description: 'Texas-based tech company',
      expectedMinResults: 0
    },
    { companyName: 'ACME Corporation', description: 'Generic test name', expectedMinResults: 0 }
  ],
  FL: [
    {
      companyName: 'Publix Super Markets',
      description: 'Florida-based grocery chain',
      expectedMinResults: 0
    },
    {
      companyName: 'NextEra Energy',
      description: 'Large Florida utility company',
      expectedMinResults: 0
    },
    { companyName: 'Test Company LLC', description: 'Generic test name', expectedMinResults: 0 }
  ],
  CA: [
    { companyName: 'Apple Inc', description: 'California tech giant', expectedMinResults: 0 },
    {
      companyName: 'Intel Corporation',
      description: 'California semiconductor company',
      expectedMinResults: 0
    },
    { companyName: 'Sample Business Inc', description: 'Generic test name', expectedMinResults: 0 }
  ],
  NY: [
    { companyName: 'IBM', description: 'New York-based tech company', expectedMinResults: 0 },
    {
      companyName: 'Consolidated Edison',
      description: 'New York utility company',
      expectedMinResults: 0
    },
    { companyName: 'ACME Corporation', description: 'Generic test name', expectedMinResults: 0 }
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
  async testState(state: 'TX' | 'FL' | 'CA' | 'NY'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing ${state} UCC Scraper`)
    console.log('='.repeat(60))

    const scraper = this.getScraper(state)
    const testCases = TEST_CASES[state]

    if (state === 'TX' && !hasTexasAuth()) {
      const skipReason = 'TX_UCC_USERNAME/TX_UCC_PASSWORD not set; skipping TX live portal tests.'
      console.log(`⚠️  ${skipReason}`)

      for (const testCase of testCases) {
        const skippedResult: TestResult = {
          state,
          testCase,
          result: {
            success: false,
            error: skipReason,
            timestamp: new Date().toISOString()
          },
          success: false,
          duration: 0,
          error: skipReason,
          skipped: true,
          skipReason
        }

        this.results.push(skippedResult)
      }

      return
    }

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
          console.log(
            `✅ Success - Found ${scraperResult.filings?.length || 0} filings in ${duration}ms`
          )

          if (scraperResult.filings && scraperResult.filings.length > 0) {
            console.log(
              `   First filing: ${scraperResult.filings[0].filingNumber} - ${scraperResult.filings[0].debtorName}`
            )
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

      if (!result.success) {
        const artifacts = await this.captureDiagnostics(scraper, state, testCase)
        if (artifacts.screenshotPath) {
          result.screenshotPath = artifacts.screenshotPath
        }
        if (artifacts.domPath) {
          result.domPath = artifacts.domPath
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
  private getScraper(state: 'TX' | 'FL' | 'CA' | 'NY'): BaseScraper & {
    closeBrowser?: () => Promise<void>
    captureDiagnostics?: (
      outputDir: string,
      baseName: string
    ) => Promise<{ screenshotPath?: string; htmlPath?: string }>
  } {
    const options = { headless: !this.isHeaded, keepPageOpenOnFailure: true }
    switch (state) {
      case 'TX':
        return new TexasScraper(options)
      case 'FL':
        return new FloridaScraper(options)
      case 'CA':
        return new CaliforniaScraper(options)
      case 'NY':
        return new NewYorkScraper(options)
      default:
        throw new Error(`Unknown state: ${state}`)
    }
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
    return slug.length > 0 ? slug : 'unknown'
  }

  private async captureDiagnostics(
    scraper: BaseScraper & {
      captureDiagnostics?: (
        outputDir: string,
        baseName: string
      ) => Promise<{ screenshotPath?: string; htmlPath?: string }>
    },
    state: string,
    testCase: TestCase
  ): Promise<{ screenshotPath?: string; domPath?: string }> {
    if (!scraper.captureDiagnostics) {
      return {}
    }

    const artifactsDir = join(this.resultsDir, 'artifacts')
    if (!existsSync(artifactsDir)) {
      mkdirSync(artifactsDir, { recursive: true })
    }

    const baseName = `${state}-${this.slugify(testCase.companyName)}`
    const artifacts = await scraper.captureDiagnostics(artifactsDir, baseName)

    return {
      screenshotPath: artifacts.screenshotPath,
      domPath: artifacts.htmlPath
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
      const completed = results.filter((r) => !r.skipped)
      const successful = completed.filter((r) => r.success).length
      const failed = completed.filter((r) => !r.success).length
      const skipped = results.filter((r) => r.skipped).length
      const withResults = results.filter(
        (r) => r.result.filings && r.result.filings.length > 0
      ).length
      const avgDuration =
        completed.length > 0
          ? completed.reduce((sum, r) => sum + r.duration, 0) / completed.length
          : 0

      console.log(`\n${state}:`)
      console.log(`  Total tests: ${results.length}`)
      console.log(
        `  Successful: ${successful} (${completed.length > 0 ? ((successful / completed.length) * 100).toFixed(1) : '0.0'}%)`
      )
      console.log(`  Failed: ${failed}`)
      console.log(`  Skipped: ${skipped}`)
      console.log(`  Tests with results: ${withResults}`)
      console.log(`  Avg duration: ${avgDuration.toFixed(0)}ms`)

      // Show failures
      const failures = results.filter((r) => !r.success && !r.skipped)
      if (failures.length > 0) {
        console.log(`  Failures:`)
        for (const failure of failures) {
          console.log(`    - ${failure.testCase.companyName}: ${failure.error}`)
        }
      }
    }

    // Overall stats
    const totalTests = this.results.length
    const totalCompleted = this.results.filter((r) => !r.skipped).length
    const totalSuccessful = this.results.filter((r) => r.success).length
    const totalFailed = this.results.filter((r) => !r.success && !r.skipped).length
    const totalSkipped = this.results.filter((r) => r.skipped).length

    console.log(`\n${'='.repeat(60)}`)
    console.log(
      `Overall: ${totalSuccessful}/${totalCompleted} tests passed (${totalCompleted > 0 ? ((totalSuccessful / totalCompleted) * 100).toFixed(1) : '0.0'}%)`
    )
    console.log(`Skipped: ${totalSkipped}`)
    console.log('='.repeat(60))

    // Write detailed JSON report
    const reportPath = join(this.resultsDir, 'report.json')
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          summary: {
            total: totalTests,
            completed: totalCompleted,
            successful: totalSuccessful,
            failed: totalFailed,
            skipped: totalSkipped,
            successRate: totalCompleted > 0 ? totalSuccessful / totalCompleted : 0
          },
          results: this.results
        },
        null,
        2
      )
    )

    console.log(`\nDetailed report saved to: ${reportPath}`)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Main test runner
 */
async function main() {
  const args = process.argv.slice(2)
  const stateArg = args.find((arg) => ['TX', 'FL', 'CA', 'NY'].includes(arg.toUpperCase()))
  const isHeaded = args.includes('--headed')

  const runner = new ScraperTestRunner(isHeaded)

  console.log('State UCC Scraper Test Suite')
  console.log('============================')
  console.log(`Mode: ${isHeaded ? 'Headed (browser visible)' : 'Headless'}`)
  console.log(`Testing: ${stateArg ? stateArg.toUpperCase() : 'All states (TX, FL, CA, NY)'}`)

  try {
    if (stateArg) {
      // Test single state
      await runner.testState(stateArg.toUpperCase() as 'TX' | 'FL' | 'CA' | 'NY')
    } else {
      // Test all states
      await runner.testState('TX')
      await runner.testState('FL')
      await runner.testState('CA')
      await runner.testState('NY')
    }

    // Generate report
    runner.generateReport()

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  }
}

const isMain = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false

// Run tests
if (isMain) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}
