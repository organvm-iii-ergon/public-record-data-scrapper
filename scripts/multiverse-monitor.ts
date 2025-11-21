/**
 * Multiverse Monitoring Dashboard
 *
 * Real-time tracking of all scraper implementations across all states.
 * Automatically identifies best-performing variants and provides recommendations.
 *
 * This is mission control for the multiversal strategy.
 */

import { connectDatabase, closeDatabase, getPool } from '../src/lib/database/client'
import type { ScraperImplementation, SupportedState } from './scrapers/scraper-factory'
import { compareImplementations } from './multiverse-compare'

interface MultiverseMetrics {
  timestamp: string
  state: SupportedState
  implementation: ScraperImplementation

  // Performance
  successRate: number // 0-100%
  avgResponseTime: number // milliseconds
  dataAccuracy: number // 0-100%

  // Volume
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  totalFilingsFound: number

  // Cost
  estimatedCostPerQuery: number
  totalEstimatedCost: number

  // Quality
  dataCompleteness: number // 0-100%
  dataAgreementScore: number // 0-100% (how well it agrees with other implementations)
}

interface UniverseRanking {
  state: SupportedState
  rankings: {
    overall: ScraperImplementation[]
    fastest: ScraperImplementation[]
    mostAccurate: ScraperImplementation[]
    mostCostEffective: ScraperImplementation[]
  }
  recommendations: {
    production: ScraperImplementation
    development: ScraperImplementation
    budget: ScraperImplementation
  }
}

/**
 * Create metrics tracking table if it doesn't exist
 */
async function initMetricsTable(): Promise<void> {
  const pool = getPool()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS multiverse_metrics (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      state VARCHAR(2) NOT NULL,
      implementation VARCHAR(20) NOT NULL,

      -- Performance
      success_rate DECIMAL(5,2),
      avg_response_time INTEGER, -- milliseconds
      data_accuracy DECIMAL(5,2),

      -- Volume
      total_queries INTEGER DEFAULT 0,
      successful_queries INTEGER DEFAULT 0,
      failed_queries INTEGER DEFAULT 0,
      total_filings_found INTEGER DEFAULT 0,

      -- Cost
      estimated_cost_per_query DECIMAL(10,6),
      total_estimated_cost DECIMAL(10,2),

      -- Quality
      data_completeness DECIMAL(5,2),
      data_agreement_score DECIMAL(5,2),

      UNIQUE(state, implementation, DATE(timestamp))
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_multiverse_metrics_timestamp
    ON multiverse_metrics(timestamp DESC)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_multiverse_metrics_state_impl
    ON multiverse_metrics(state, implementation)
  `)
}

/**
 * Record metrics for an implementation
 */
async function recordMetrics(metrics: MultiverseMetrics): Promise<void> {
  const pool = getPool()

  await pool.query(`
    INSERT INTO multiverse_metrics (
      timestamp, state, implementation,
      success_rate, avg_response_time, data_accuracy,
      total_queries, successful_queries, failed_queries, total_filings_found,
      estimated_cost_per_query, total_estimated_cost,
      data_completeness, data_agreement_score
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    ON CONFLICT (state, implementation, DATE(timestamp))
    DO UPDATE SET
      success_rate = EXCLUDED.success_rate,
      avg_response_time = EXCLUDED.avg_response_time,
      data_accuracy = EXCLUDED.data_accuracy,
      total_queries = multiverse_metrics.total_queries + EXCLUDED.total_queries,
      successful_queries = multiverse_metrics.successful_queries + EXCLUDED.successful_queries,
      failed_queries = multiverse_metrics.failed_queries + EXCLUDED.failed_queries,
      total_filings_found = multiverse_metrics.total_filings_found + EXCLUDED.total_filings_found,
      total_estimated_cost = multiverse_metrics.total_estimated_cost + EXCLUDED.total_estimated_cost,
      data_completeness = EXCLUDED.data_completeness,
      data_agreement_score = EXCLUDED.data_agreement_score
  `, [
    metrics.timestamp,
    metrics.state,
    metrics.implementation,
    metrics.successRate,
    metrics.avgResponseTime,
    metrics.dataAccuracy,
    metrics.totalQueries,
    metrics.successfulQueries,
    metrics.failedQueries,
    metrics.totalFilingsFound,
    metrics.estimatedCostPerQuery,
    metrics.totalEstimatedCost,
    metrics.dataCompleteness,
    metrics.dataAgreementScore
  ])
}

/**
 * Get metrics for all implementations
 */
async function getAllMetrics(days: number = 30): Promise<MultiverseMetrics[]> {
  const pool = getPool()

  const result = await pool.query(`
    SELECT
      timestamp,
      state,
      implementation,
      success_rate as "successRate",
      avg_response_time as "avgResponseTime",
      data_accuracy as "dataAccuracy",
      total_queries as "totalQueries",
      successful_queries as "successfulQueries",
      failed_queries as "failedQueries",
      total_filings_found as "totalFilingsFound",
      estimated_cost_per_query as "estimatedCostPerQuery",
      total_estimated_cost as "totalEstimatedCost",
      data_completeness as "dataCompleteness",
      data_agreement_score as "dataAgreementScore"
    FROM multiverse_metrics
    WHERE timestamp >= NOW() - INTERVAL '${days} days'
    ORDER BY timestamp DESC
  `)

  return result.rows.map(row => ({
    ...row,
    timestamp: row.timestamp.toISOString()
  }))
}

/**
 * Calculate rankings for a state
 */
function calculateRankings(metrics: MultiverseMetrics[], state: SupportedState): UniverseRanking {
  const stateMetrics = metrics.filter(m => m.state === state)

  if (stateMetrics.length === 0) {
    return {
      state,
      rankings: {
        overall: ['mock'],
        fastest: ['mock'],
        mostAccurate: ['mock'],
        mostCostEffective: ['mock']
      },
      recommendations: {
        production: 'mock',
        development: 'mock',
        budget: 'mock'
      }
    }
  }

  // Group by implementation and aggregate
  const implStats = new Map<ScraperImplementation, {
    successRate: number
    avgResponseTime: number
    dataAccuracy: number
    estimatedCostPerQuery: number
    dataCompleteness: number
  }>()

  stateMetrics.forEach(m => {
    if (!implStats.has(m.implementation)) {
      implStats.set(m.implementation, {
        successRate: m.successRate,
        avgResponseTime: m.avgResponseTime,
        dataAccuracy: m.dataAccuracy,
        estimatedCostPerQuery: m.estimatedCostPerQuery,
        dataCompleteness: m.dataCompleteness
      })
    }
  })

  const implementations = Array.from(implStats.keys())

  // Rank by speed (fastest first)
  const fastest = [...implementations].sort((a, b) => {
    const aStats = implStats.get(a)!
    const bStats = implStats.get(b)!
    return aStats.avgResponseTime - bStats.avgResponseTime
  })

  // Rank by accuracy
  const mostAccurate = [...implementations].sort((a, b) => {
    const aStats = implStats.get(a)!
    const bStats = implStats.get(b)!
    const aScore = (aStats.dataAccuracy + aStats.dataCompleteness + aStats.successRate) / 3
    const bScore = (bStats.dataAccuracy + bStats.dataCompleteness + bStats.successRate) / 3
    return bScore - aScore
  })

  // Rank by cost-effectiveness
  const mostCostEffective = [...implementations].sort((a, b) => {
    const aStats = implStats.get(a)!
    const bStats = implStats.get(b)!
    return aStats.estimatedCostPerQuery - bStats.estimatedCostPerQuery
  })

  // Overall ranking (weighted combination)
  const overall = [...implementations].sort((a, b) => {
    const aStats = implStats.get(a)!
    const bStats = implStats.get(b)!

    // Normalize to 0-100 scale
    const maxSpeed = Math.max(...Array.from(implStats.values()).map(s => s.avgResponseTime))
    const maxCost = Math.max(...Array.from(implStats.values()).map(s => s.estimatedCostPerQuery))

    const aSpeed = 100 - (aStats.avgResponseTime / maxSpeed * 100)
    const bSpeed = 100 - (bStats.avgResponseTime / maxSpeed * 100)

    const aAccuracy = (aStats.dataAccuracy + aStats.dataCompleteness + aStats.successRate) / 3
    const bAccuracy = (bStats.dataAccuracy + bStats.dataCompleteness + bStats.successRate) / 3

    const aCost = 100 - (aStats.estimatedCostPerQuery / maxCost * 100)
    const bCost = 100 - (bStats.estimatedCostPerQuery / maxCost * 100)

    // Weighted score: 30% speed, 50% accuracy, 20% cost
    const aScore = (aSpeed * 0.3) + (aAccuracy * 0.5) + (aCost * 0.2)
    const bScore = (bSpeed * 0.3) + (bAccuracy * 0.5) + (bCost * 0.2)

    return bScore - aScore
  })

  return {
    state,
    rankings: {
      overall,
      fastest,
      mostAccurate,
      mostCostEffective
    },
    recommendations: {
      production: mostAccurate[0] || 'mock', // Prioritize accuracy for production
      development: fastest[0] || 'mock', // Prioritize speed for development
      budget: mostCostEffective[0] || 'mock' // Prioritize cost for budget-conscious
    }
  }
}

/**
 * Display monitoring dashboard
 */
async function displayDashboard(days: number = 7): Promise<void> {
  console.log(`\n${'='.repeat(100)}`)
  console.log(`🌌 MULTIVERSE MONITORING DASHBOARD`)
  console.log(`${'='.repeat(100)}\n`)

  const metrics = await getAllMetrics(days)

  if (metrics.length === 0) {
    console.log(`No metrics recorded yet. Run some comparisons first!`)
    console.log(`\nExample:`)
    console.log(`  tsx scripts/multiverse-compare.ts CA "Acme Corp"`)
    console.log(`\n${'='.repeat(100)}\n`)
    return
  }

  console.log(`Metrics from last ${days} days\n`)

  // Group metrics by state
  const states: SupportedState[] = ['CA', 'TX', 'FL', 'NY', 'IL']

  states.forEach(state => {
    const stateMetrics = metrics.filter(m => m.state === state)

    if (stateMetrics.length === 0) {
      console.log(`${state}: No data`)
      return
    }

    const rankings = calculateRankings(metrics, state)

    console.log(`${'─'.repeat(100)}`)
    console.log(`${state} - Rankings`)
    console.log(`${'─'.repeat(100)}`)

    console.log(`\nOverall: ${rankings.rankings.overall.map(i => i.toUpperCase()).join(' > ')}`)
    console.log(`Fastest: ${rankings.rankings.fastest.map(i => i.toUpperCase()).join(' > ')}`)
    console.log(`Most Accurate: ${rankings.rankings.mostAccurate.map(i => i.toUpperCase()).join(' > ')}`)
    console.log(`Most Cost-Effective: ${rankings.rankings.mostCostEffective.map(i => i.toUpperCase()).join(' > ')}`)

    console.log(`\n📌 Recommendations:`)
    console.log(`  Production: ${rankings.recommendations.production.toUpperCase()}`)
    console.log(`  Development: ${rankings.recommendations.development.toUpperCase()}`)
    console.log(`  Budget: ${rankings.recommendations.budget.toUpperCase()}\n`)

    // Detailed metrics table
    console.log(`Implementation Stats:`)
    console.log(`${'─'.repeat(100)}`)
    console.log(`Impl       | Queries | Success | Avg Time | Accuracy | Completeness | Cost/Query | Total Cost`)
    console.log(`${'─'.repeat(100)}`)

    const implGroups = new Map<ScraperImplementation, MultiverseMetrics[]>()
    stateMetrics.forEach(m => {
      if (!implGroups.has(m.implementation)) {
        implGroups.set(m.implementation, [])
      }
      implGroups.get(m.implementation)!.push(m)
    })

    implGroups.forEach((ms, impl) => {
      const totalQueries = ms.reduce((sum, m) => sum + m.totalQueries, 0)
      const successfulQueries = ms.reduce((sum, m) => sum + m.successfulQueries, 0)
      const avgTime = ms.reduce((sum, m) => sum + m.avgResponseTime, 0) / ms.length
      const avgAccuracy = ms.reduce((sum, m) => sum + m.dataAccuracy, 0) / ms.length
      const avgCompleteness = ms.reduce((sum, m) => sum + m.dataCompleteness, 0) / ms.length
      const avgCostPerQuery = ms.reduce((sum, m) => sum + m.estimatedCostPerQuery, 0) / ms.length
      const totalCost = ms.reduce((sum, m) => sum + m.totalEstimatedCost, 0)

      const successRate = totalQueries > 0 ? (successfulQueries / totalQueries * 100).toFixed(1) : '0.0'

      console.log(
        `${impl.padEnd(10)} | ` +
        `${totalQueries.toString().padEnd(7)} | ` +
        `${successRate}%${' '.repeat(Math.max(0, 3 - successRate.length))} | ` +
        `${Math.round(avgTime)}ms${' '.repeat(Math.max(0, 6 - Math.round(avgTime).toString().length))} | ` +
        `${Math.round(avgAccuracy)}%${' '.repeat(Math.max(0, 6 - Math.round(avgAccuracy).toString().length))} | ` +
        `${Math.round(avgCompleteness)}%${' '.repeat(Math.max(0, 10 - Math.round(avgCompleteness).toString().length))} | ` +
        `$${avgCostPerQuery.toFixed(4)}${' '.repeat(Math.max(0, 8 - avgCostPerQuery.toFixed(4).length))} | ` +
        `$${totalCost.toFixed(2)}`
      )
    })

    console.log(`\n`)
  })

  console.log(`${'='.repeat(100)}\n`)

  // Global recommendations
  console.log(`🎯 GLOBAL MULTIVERSE RECOMMENDATIONS\n`)

  const allRankings = states.map(state => calculateRankings(metrics, state))

  // Count how many times each implementation is recommended
  const productionVotes = new Map<ScraperImplementation, number>()
  allRankings.forEach(r => {
    productionVotes.set(r.recommendations.production, (productionVotes.get(r.recommendations.production) || 0) + 1)
  })

  const topProductionChoice = Array.from(productionVotes.entries())
    .sort((a, b) => b[1] - a[1])[0]

  if (topProductionChoice) {
    console.log(`✨ Recommended for Production: ${topProductionChoice[0].toUpperCase()}`)
    console.log(`   (Recommended in ${topProductionChoice[1]}/${states.length} states)\n`)
  }

  console.log(`${'='.repeat(100)}\n`)
}

/**
 * Run automated benchmarks
 */
async function runBenchmarks(): Promise<void> {
  console.log(`\n🔬 Running Automated Multiverse Benchmarks...\n`)

  const testCompanies = {
    CA: ['Acme Restaurant Corp', 'Bay Area Tech Inc'],
    TX: ['Lone Star Steakhouse', 'Houston Construction'],
    FL: ['Miami Beach Resort LLC', 'Orlando Retail Group'],
    NY: ['Brooklyn Manufacturing Co', 'Manhattan Consulting LLC'],
    IL: ['Chicago Food Services', 'Illinois Construction Partners']
  }

  const states: SupportedState[] = ['CA', 'TX', 'FL', 'NY', 'IL']

  for (const state of states) {
    const companies = testCompanies[state]

    for (const company of companies) {
      console.log(`Testing ${state}: ${company}`)

      const comparison = await compareImplementations(state, company, ['mock', 'puppeteer', 'api'])

      // Record metrics for each implementation
      comparison.results.forEach(async (r) => {
        const metrics: MultiverseMetrics = {
          timestamp: new Date().toISOString(),
          state: r.state,
          implementation: r.implementation,
          successRate: r.success ? 100 : 0,
          avgResponseTime: r.duration,
          dataAccuracy: r.dataCompleteness,
          totalQueries: 1,
          successfulQueries: r.success ? 1 : 0,
          failedQueries: r.success ? 0 : 1,
          totalFilingsFound: r.filingsCount,
          estimatedCostPerQuery: r.estimatedCost,
          totalEstimatedCost: r.estimatedCost,
          dataCompleteness: r.dataCompleteness,
          dataAgreementScore: comparison.summary.dataAgreementScore
        }

        await recordMetrics(metrics)
      })

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log(`\n✅ Benchmarks complete!`)
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'dashboard'

  try {
    await connectDatabase()
    await initMetricsTable()

    switch (command) {
      case 'dashboard':
        const days = parseInt(args[1]) || 7
        await displayDashboard(days)
        break

      case 'benchmark':
        await runBenchmarks()
        await displayDashboard(7)
        break

      case 'compare':
        if (args.length < 3) {
          console.error(`Usage: tsx scripts/multiverse-monitor.ts compare <state> <company>`)
          process.exit(1)
        }
        const state = args[1].toUpperCase() as SupportedState
        const company = args[2]
        const comparison = await compareImplementations(state, company)

        // Record metrics
        comparison.results.forEach(async (r) => {
          const metrics: MultiverseMetrics = {
            timestamp: new Date().toISOString(),
            state: r.state,
            implementation: r.implementation,
            successRate: r.success ? 100 : 0,
            avgResponseTime: r.duration,
            dataAccuracy: r.dataCompleteness,
            totalQueries: 1,
            successfulQueries: r.success ? 1 : 0,
            failedQueries: r.success ? 0 : 1,
            totalFilingsFound: r.filingsCount,
            estimatedCostPerQuery: r.estimatedCost,
            totalEstimatedCost: r.estimatedCost,
            dataCompleteness: r.dataCompleteness,
            dataAgreementScore: comparison.summary.dataAgreementScore
          }

          await recordMetrics(metrics)
        })
        break

      default:
        console.log(`
🌌 Multiverse Monitoring Dashboard

Commands:
  dashboard [days]       Show monitoring dashboard (default: 7 days)
  benchmark              Run automated benchmarks across all states
  compare <state> <co>   Compare implementations for a company

Examples:
  tsx scripts/multiverse-monitor.ts dashboard 30
  tsx scripts/multiverse-monitor.ts benchmark
  tsx scripts/multiverse-monitor.ts compare CA "Acme Corp"
`)
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
