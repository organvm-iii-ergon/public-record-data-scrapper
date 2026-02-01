/**
 * Multiverse Comparison Framework
 *
 * Runs ALL scraper implementations simultaneously for the same query
 * and compares performance, accuracy, cost, and reliability.
 *
 * This is the core of the multiversal strategy - let reality choose the winners.
 */

import { performance } from 'perf_hooks'
import { closeDatabase, connectDatabase } from '../apps/web/src/lib/database/client'
import type { ScraperImplementation, SupportedState } from './scrapers/scraper-factory'
import { ScraperFactory } from './scrapers/scraper-factory'
import type { ScraperResult, UCCFiling } from './scrapers/base-scraper'

interface ImplementationResult {
  implementation: ScraperImplementation
  state: SupportedState
  companyName: string
  success: boolean
  duration: number // milliseconds
  filingsCount: number
  filings: UCCFiling[]
  error?: string
  retryCount?: number

  // Quality metrics
  dataCompleteness: number // 0-100%
  hasValidDates: boolean
  hasValidFilingNumbers: boolean

  // Cost estimate
  estimatedCost: number // dollars per query
}

interface ComparisonResult {
  query: {
    state: SupportedState
    companyName: string
    timestamp: string
  }
  results: ImplementationResult[]
  winner: {
    fastest: ScraperImplementation
    mostAccurate: ScraperImplementation
    mostCostEffective: ScraperImplementation
    recommended: ScraperImplementation
  }
  summary: {
    totalDuration: number
    successfulImplementations: number
    failedImplementations: number
    averageFilingsPerImplementation: number
    consensusFilingCount: number // Most common count
    dataAgreementScore: number // How similar are the results? 0-100%
  }
}

/**
 * Run a single implementation and collect metrics
 */
async function runImplementation(
  state: SupportedState,
  implementation: ScraperImplementation,
  companyName: string
): Promise<ImplementationResult> {
  console.log(`  🔄 Testing ${implementation.toUpperCase()} implementation...`)

  const startTime = performance.now()

  try {
    const scraper = ScraperFactory.create(state, { implementation })
    const result: ScraperResult = await scraper.search(companyName)

    const duration = performance.now() - startTime

    // Calculate quality metrics
    const filings = result.filings || []
    const dataCompleteness = calculateDataCompleteness(filings)
    const hasValidDates = filings.every((f) => isValidDate(f.filingDate))
    const hasValidFilingNumbers = filings.every((f) => f.filingNumber && f.filingNumber.length > 0)

    // Estimate cost
    const estimatedCost = estimateCost(implementation)

    const implResult: ImplementationResult = {
      implementation,
      state,
      companyName,
      success: result.success,
      duration,
      filingsCount: filings.length,
      filings,
      error: result.error,
      retryCount: result.retryCount,
      dataCompleteness,
      hasValidDates,
      hasValidFilingNumbers,
      estimatedCost
    }

    if (result.success) {
      console.log(
        `  ✅ ${implementation.toUpperCase()}: ${filings.length} filings in ${Math.round(duration)}ms ($${estimatedCost.toFixed(4)})`
      )
    } else {
      console.log(`  ❌ ${implementation.toUpperCase()}: Failed - ${result.error}`)
    }

    return implResult
  } catch (error) {
    const duration = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.log(`  ❌ ${implementation.toUpperCase()}: Exception - ${errorMessage}`)

    return {
      implementation,
      state,
      companyName,
      success: false,
      duration,
      filingsCount: 0,
      filings: [],
      error: errorMessage,
      dataCompleteness: 0,
      hasValidDates: false,
      hasValidFilingNumbers: false,
      estimatedCost: estimateCost(implementation)
    }
  }
}

/**
 * Calculate data completeness score
 */
function calculateDataCompleteness(filings: UCCFiling[]): number {
  if (filings.length === 0) return 0

  const fields: Array<keyof UCCFiling> = [
    'filingNumber',
    'debtorName',
    'securedParty',
    'filingDate',
    'collateral',
    'status'
  ]

  let totalCompleteness = 0

  filings.forEach((filing) => {
    let filledFields = 0
    fields.forEach((field) => {
      const value = filing[field]
      if (value && value !== 'Not specified' && value !== 'Unknown' && value !== '') {
        filledFields++
      }
    })
    totalCompleteness += (filledFields / fields.length) * 100
  })

  return totalCompleteness / filings.length
}

/**
 * Validate date string
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr || dateStr === 'Not specified') return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100
}

/**
 * Estimate cost per query for each implementation
 */
function estimateCost(implementation: ScraperImplementation): number {
  switch (implementation) {
    case 'mock':
      return 0 // Free

    case 'puppeteer':
      // Estimate: Compute cost + IP rotation
      // AWS t3.small: $0.0208/hour = $0.00000578/second
      // Average query: 10 seconds = $0.0000578
      // Add proxy cost: $0.001 per request (if using residential proxies)
      return 0.001 + 0.00006

    case 'api':
      // Typical UCC API pricing: $0.50 - $2.00 per query
      // Assume volume pricing tier
      return 0.75

    default:
      return 0
  }
}

/**
 * Calculate data agreement score between implementations
 */
function calculateDataAgreement(results: ImplementationResult[]): number {
  const successfulResults = results.filter((r) => r.success)

  if (successfulResults.length < 2) {
    return 0 // Can't compare
  }

  // Compare filing counts
  const filingCounts = successfulResults.map((r) => r.filingsCount)
  const avgCount = filingCounts.reduce((a, b) => a + b, 0) / filingCounts.length
  const countVariance =
    filingCounts.reduce((sum, count) => sum + Math.abs(count - avgCount), 0) / filingCounts.length
  const countAgreement = Math.max(0, 100 - (countVariance / avgCount) * 100)

  // Compare filing numbers (check if same filings found)
  const allFilingNumbers = successfulResults.map(
    (r) => new Set(r.filings.map((f) => f.filingNumber))
  )

  if (allFilingNumbers.length < 2) {
    return countAgreement
  }

  // Calculate Jaccard similarity between first two sets
  const set1 = allFilingNumbers[0]
  const set2 = allFilingNumbers[1]
  const intersection = new Set([...set1].filter((x) => set2.has(x)))
  const union = new Set([...set1, ...set2])
  const jaccardSimilarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0

  // Average of count agreement and content agreement
  return (countAgreement + jaccardSimilarity) / 2
}

/**
 * Determine consensus filing count (most common)
 */
function getConsensusFilingCount(results: ImplementationResult[]): number {
  const successfulResults = results.filter((r) => r.success)

  if (successfulResults.length === 0) return 0

  const counts = successfulResults.map((r) => r.filingsCount)
  const countFrequency = new Map<number, number>()

  counts.forEach((count) => {
    countFrequency.set(count, (countFrequency.get(count) || 0) + 1)
  })

  let maxFrequency = 0
  let consensusCount = 0

  countFrequency.forEach((frequency, count) => {
    if (frequency > maxFrequency) {
      maxFrequency = frequency
      consensusCount = count
    }
  })

  return consensusCount
}

/**
 * Pick winners based on different criteria
 */
function determineWinners(results: ImplementationResult[]): ComparisonResult['winner'] {
  const successfulResults = results.filter((r) => r.success)

  if (successfulResults.length === 0) {
    return {
      fastest: 'mock',
      mostAccurate: 'mock',
      mostCostEffective: 'mock',
      recommended: 'mock'
    }
  }

  // Fastest
  const fastest = successfulResults.reduce((min, r) => (r.duration < min.duration ? r : min))

  // Most accurate (highest data completeness + most filings)
  const mostAccurate = successfulResults.reduce((best, r) => {
    const rScore = r.dataCompleteness + r.filingsCount * 10
    const bestScore = best.dataCompleteness + best.filingsCount * 10
    return rScore > bestScore ? r : best
  })

  // Most cost-effective (lowest cost with success)
  const mostCostEffective = successfulResults.reduce((min, r) =>
    r.estimatedCost < min.estimatedCost ? r : min
  )

  // Recommended (balanced score: speed + accuracy - cost)
  const recommended = successfulResults.reduce((best, r) => {
    // Normalize metrics to 0-100 scale
    const maxDuration = Math.max(...successfulResults.map((x) => x.duration))
    const maxCost = Math.max(...successfulResults.map((x) => x.estimatedCost))

    const speedScore = 100 - (r.duration / maxDuration) * 100
    const accuracyScore = r.dataCompleteness
    const costScore = 100 - (r.estimatedCost / maxCost) * 100

    const rScore = speedScore * 0.3 + accuracyScore * 0.5 + costScore * 0.2

    const maxBestDuration = Math.max(...successfulResults.map((x) => x.duration))
    const maxBestCost = Math.max(...successfulResults.map((x) => x.estimatedCost))
    const bestSpeedScore = 100 - (best.duration / maxBestDuration) * 100
    const bestAccuracyScore = best.dataCompleteness
    const bestCostScore = 100 - (best.estimatedCost / maxBestCost) * 100
    const bestScore = bestSpeedScore * 0.3 + bestAccuracyScore * 0.5 + bestCostScore * 0.2

    return rScore > bestScore ? r : best
  })

  return {
    fastest: fastest.implementation,
    mostAccurate: mostAccurate.implementation,
    mostCostEffective: mostCostEffective.implementation,
    recommended: recommended.implementation
  }
}

/**
 * Compare all implementations for a given query
 */
export async function compareImplementations(
  state: SupportedState,
  companyName: string,
  implementations: ScraperImplementation[] = ['mock', 'puppeteer', 'api']
): Promise<ComparisonResult> {
  console.log(`\n🌌 MULTIVERSE COMPARISON`)
  console.log(`State: ${state}`)
  console.log(`Company: ${companyName}`)
  console.log(`Testing ${implementations.length} implementations...\n`)

  const overallStart = performance.now()

  // Run all implementations in parallel
  const results = await Promise.all(
    implementations.map((impl) => runImplementation(state, impl, companyName))
  )

  const totalDuration = performance.now() - overallStart

  // Calculate summary statistics
  const successfulImplementations = results.filter((r) => r.success).length
  const failedImplementations = results.filter((r) => !r.success).length
  const averageFilingsPerImplementation =
    results.reduce((sum, r) => sum + r.filingsCount, 0) / results.length
  const consensusFilingCount = getConsensusFilingCount(results)
  const dataAgreementScore = calculateDataAgreement(results)

  // Determine winners
  const winner = determineWinners(results)

  const comparison: ComparisonResult = {
    query: {
      state,
      companyName,
      timestamp: new Date().toISOString()
    },
    results,
    winner,
    summary: {
      totalDuration,
      successfulImplementations,
      failedImplementations,
      averageFilingsPerImplementation,
      consensusFilingCount,
      dataAgreementScore
    }
  }

  printComparisonSummary(comparison)

  return comparison
}

/**
 * Print detailed comparison summary
 */
function printComparisonSummary(comparison: ComparisonResult): void {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📊 MULTIVERSE COMPARISON RESULTS`)
  console.log(`${'='.repeat(80)}\n`)

  console.log(`Query: ${comparison.query.companyName} (${comparison.query.state})`)
  console.log(`Timestamp: ${comparison.query.timestamp}`)
  console.log(`Total Duration: ${Math.round(comparison.summary.totalDuration)}ms\n`)

  // Results table
  console.log(`Results by Implementation:`)
  console.log(`${'─'.repeat(80)}`)
  console.log(`Implementation  | Success | Filings | Duration | Cost      | Quality`)
  console.log(`${'─'.repeat(80)}`)

  comparison.results.forEach((r) => {
    const impl = r.implementation.padEnd(15)
    const success = r.success ? '✅' : '❌'
    const filings = r.filingsCount.toString().padEnd(7)
    const duration = `${Math.round(r.duration)}ms`.padEnd(8)
    const cost = `$${r.estimatedCost.toFixed(4)}`.padEnd(9)
    const quality = `${Math.round(r.dataCompleteness)}%`.padEnd(7)

    console.log(`${impl} | ${success}     | ${filings} | ${duration} | ${cost} | ${quality}`)
  })

  console.log(`${'─'.repeat(80)}\n`)

  // Summary statistics
  console.log(`Summary:`)
  console.log(
    `  Successful: ${comparison.summary.successfulImplementations}/${comparison.results.length}`
  )
  console.log(`  Consensus Filing Count: ${comparison.summary.consensusFilingCount}`)
  console.log(`  Data Agreement Score: ${Math.round(comparison.summary.dataAgreementScore)}%`)
  console.log(
    `  Average Filings: ${comparison.summary.averageFilingsPerImplementation.toFixed(1)}\n`
  )

  // Winners
  console.log(`🏆 Winners:`)
  console.log(`  Fastest: ${comparison.winner.fastest.toUpperCase()}`)
  console.log(`  Most Accurate: ${comparison.winner.mostAccurate.toUpperCase()}`)
  console.log(`  Most Cost-Effective: ${comparison.winner.mostCostEffective.toUpperCase()}`)
  console.log(`  ⭐ Recommended: ${comparison.winner.recommended.toUpperCase()}`)

  console.log(`\n${'='.repeat(80)}\n`)
}

/**
 * Run comparison across multiple companies
 */
export async function runMultiCompanyComparison(
  state: SupportedState,
  companies: string[],
  implementations: ScraperImplementation[] = ['mock', 'puppeteer', 'api']
): Promise<ComparisonResult[]> {
  console.log(`\n🌌 MULTI-COMPANY MULTIVERSE COMPARISON`)
  console.log(`State: ${state}`)
  console.log(`Companies: ${companies.length}`)
  console.log(`Implementations: ${implementations.join(', ')}\n`)

  const results: ComparisonResult[] = []

  for (const company of companies) {
    const comparison = await compareImplementations(state, company, implementations)
    results.push(comparison)

    // Small delay between companies
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  printAggregateAnalysis(results)

  return results
}

/**
 * Print aggregate analysis across multiple comparisons
 */
function printAggregateAnalysis(comparisons: ComparisonResult[]): void {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📈 AGGREGATE MULTIVERSE ANALYSIS`)
  console.log(`${'='.repeat(80)}\n`)

  // Count how many times each implementation won each category
  const wins = {
    fastest: new Map<ScraperImplementation, number>(),
    mostAccurate: new Map<ScraperImplementation, number>(),
    mostCostEffective: new Map<ScraperImplementation, number>(),
    recommended: new Map<ScraperImplementation, number>()
  }

  comparisons.forEach((c) => {
    wins.fastest.set(c.winner.fastest, (wins.fastest.get(c.winner.fastest) || 0) + 1)
    wins.mostAccurate.set(
      c.winner.mostAccurate,
      (wins.mostAccurate.get(c.winner.mostAccurate) || 0) + 1
    )
    wins.mostCostEffective.set(
      c.winner.mostCostEffective,
      (wins.mostCostEffective.get(c.winner.mostCostEffective) || 0) + 1
    )
    wins.recommended.set(
      c.winner.recommended,
      (wins.recommended.get(c.winner.recommended) || 0) + 1
    )
  })

  console.log(`Win Rates Across ${comparisons.length} Comparisons:\n`)

  console.log(`Fastest:`)
  wins.fastest.forEach((count, impl) => {
    const percentage = ((count / comparisons.length) * 100).toFixed(1)
    console.log(`  ${impl.toUpperCase()}: ${count}/${comparisons.length} (${percentage}%)`)
  })

  console.log(`\nMost Accurate:`)
  wins.mostAccurate.forEach((count, impl) => {
    const percentage = ((count / comparisons.length) * 100).toFixed(1)
    console.log(`  ${impl.toUpperCase()}: ${count}/${comparisons.length} (${percentage}%)`)
  })

  console.log(`\nMost Cost-Effective:`)
  wins.mostCostEffective.forEach((count, impl) => {
    const percentage = ((count / comparisons.length) * 100).toFixed(1)
    console.log(`  ${impl.toUpperCase()}: ${count}/${comparisons.length} (${percentage}%)`)
  })

  console.log(`\n⭐ Recommended:`)
  wins.recommended.forEach((count, impl) => {
    const percentage = ((count / comparisons.length) * 100).toFixed(1)
    console.log(`  ${impl.toUpperCase()}: ${count}/${comparisons.length} (${percentage}%)`)
  })

  // Average data agreement
  const avgAgreement =
    comparisons.reduce((sum, c) => sum + c.summary.dataAgreementScore, 0) / comparisons.length
  console.log(`\nAverage Data Agreement: ${Math.round(avgAgreement)}%`)

  console.log(`\n${'='.repeat(80)}\n`)
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
Usage:
  tsx scripts/multiverse-compare.ts <state> <company>
  tsx scripts/multiverse-compare.ts <state> <company1> <company2> ...

Examples:
  tsx scripts/multiverse-compare.ts CA "Acme Restaurant Corp"
  tsx scripts/multiverse-compare.ts TX "Lone Star Steakhouse" "Houston Construction"

Available states: CA, TX, FL, NY, IL
Available implementations: mock, puppeteer, api
`)
    process.exit(1)
  }

  const state = args[0].toUpperCase() as SupportedState
  const companies = args.slice(1)

  if (!['CA', 'TX', 'FL', 'NY', 'IL'].includes(state)) {
    console.error(`❌ Invalid state: ${state}`)
    console.error(`Available states: CA, TX, FL, NY, IL`)
    process.exit(1)
  }

  if (companies.length === 0) {
    console.error(`❌ Please provide at least one company name`)
    process.exit(1)
  }

  try {
    // Connect to database (needed for some scrapers)
    await connectDatabase()

    if (companies.length === 1) {
      await compareImplementations(state, companies[0])
    } else {
      await runMultiCompanyComparison(state, companies)
    }
  } catch (error) {
    console.error(`❌ Error:`, error)
    process.exit(1)
  } finally {
    await closeDatabase()
  }
}

// Run if called directly
if (require.main === module) {
  main()
}
