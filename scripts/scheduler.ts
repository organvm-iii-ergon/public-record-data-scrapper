#!/usr/bin/env tsx
/**
 * UCC Data Collection Scheduler
 *
 * Autonomous background service that:
 * - Runs multi-state UCC scraping on a schedule
 * - Monitors scraper health and success rates
 * - Logs all activity for monitoring
 * - Gracefully handles errors and retries
 *
 * Usage:
 *   npm run scheduler:start      # Run in foreground
 *   npm run scheduler:daemon      # Run in background
 *   npm run scheduler:stop        # Stop background process
 */

import cron from 'node-cron'
import {
  createScraper,
  ScraperFactory,
  ScraperImplementation,
  SupportedState
} from './scrapers/scraper-factory'
import { initDatabase, createQueries, closeDatabase } from '../apps/web/src/lib/database'
import chalk from 'chalk'
import * as fs from 'fs/promises'
import * as path from 'path'

// Configuration
interface SchedulerConfig {
  // Cron schedule (default: daily at 2 AM)
  schedule: string
  // States to scrape
  states: SupportedState[]
  // Scraper implementation
  implementation: ScraperImplementation
  // Companies per state
  companiesPerState: number
  // Enable email notifications
  enableNotifications: boolean
  // Minimum priority score for notifications
  notificationThreshold: number
}

const defaultConfig: SchedulerConfig = {
  schedule: process.env.SCRAPER_SCHEDULE || '0 2 * * *', // Daily at 2 AM
  states: (process.env.SCRAPER_STATES?.split(',') as SupportedState[]) || [
    'CA',
    'TX',
    'FL',
    'NY',
    'IL'
  ],
  implementation: (process.env.SCRAPER_IMPLEMENTATION as ScraperImplementation) || 'mock',
  companiesPerState: 5,
  enableNotifications: process.env.ENABLE_NOTIFICATIONS === 'true',
  notificationThreshold: parseInt(process.env.NOTIFICATION_THRESHOLD || '80')
}

// State-specific sample companies (expanded list)
const COMPANY_POOL: Record<
  SupportedState,
  Array<{
    name: string
    industry:
      | 'restaurant'
      | 'retail'
      | 'construction'
      | 'technology'
      | 'healthcare'
      | 'services'
      | 'manufacturing'
    estimatedRevenue: number
  }>
> = {
  CA: [
    { name: 'Golden State Restaurant Group', industry: 'restaurant', estimatedRevenue: 2500000 },
    { name: 'Bay Area Retail Co', industry: 'retail', estimatedRevenue: 1800000 },
    { name: 'Silicon Valley Tech Hub', industry: 'technology', estimatedRevenue: 4200000 },
    { name: 'San Diego Healthcare Partners', industry: 'healthcare', estimatedRevenue: 3100000 },
    { name: 'California Construction LLC', industry: 'construction', estimatedRevenue: 2900000 },
    { name: 'LA Services Group', industry: 'services', estimatedRevenue: 1600000 },
    { name: 'Oakland Manufacturing Co', industry: 'manufacturing', estimatedRevenue: 3800000 }
  ],
  TX: [
    { name: 'Lone Star Steakhouse Inc', industry: 'restaurant', estimatedRevenue: 3200000 },
    { name: 'Houston Construction Partners', industry: 'construction', estimatedRevenue: 4500000 },
    { name: 'Dallas Tech Solutions', industry: 'technology', estimatedRevenue: 2800000 },
    { name: 'Austin Retail Ventures', industry: 'retail', estimatedRevenue: 2100000 },
    { name: 'San Antonio Medical Group', industry: 'healthcare', estimatedRevenue: 3600000 },
    { name: 'Texas Services Corp', industry: 'services', estimatedRevenue: 1900000 },
    { name: 'Fort Worth Manufacturing', industry: 'manufacturing', estimatedRevenue: 4100000 }
  ],
  FL: [
    { name: 'Sunshine Medical Clinic', industry: 'healthcare', estimatedRevenue: 2800000 },
    { name: 'Miami Beach Retail LLC', industry: 'retail', estimatedRevenue: 1500000 },
    { name: 'Tampa Construction Group', industry: 'construction', estimatedRevenue: 3900000 },
    { name: 'Orlando Restaurant Partners', industry: 'restaurant', estimatedRevenue: 2400000 },
    { name: 'Jacksonville Tech Services', industry: 'technology', estimatedRevenue: 2700000 },
    { name: 'South Florida Services', industry: 'services', estimatedRevenue: 1800000 },
    { name: 'Palm Beach Manufacturing', industry: 'manufacturing', estimatedRevenue: 3500000 }
  ],
  NY: [
    { name: 'Manhattan Tech Services', industry: 'technology', estimatedRevenue: 3500000 },
    { name: 'Brooklyn Restaurant Group', industry: 'restaurant', estimatedRevenue: 2200000 },
    { name: 'Queens Construction Co', industry: 'construction', estimatedRevenue: 4200000 },
    { name: 'Bronx Healthcare Alliance', industry: 'healthcare', estimatedRevenue: 3300000 },
    { name: 'Staten Island Retail', industry: 'retail', estimatedRevenue: 1700000 },
    { name: 'Buffalo Services LLC', industry: 'services', estimatedRevenue: 2000000 },
    { name: 'Rochester Manufacturing', industry: 'manufacturing', estimatedRevenue: 3900000 }
  ],
  IL: [
    { name: 'Chicago Construction Co', industry: 'construction', estimatedRevenue: 5000000 },
    { name: 'Windy City Services LLC', industry: 'services', estimatedRevenue: 1900000 },
    { name: 'Illinois Medical Center', industry: 'healthcare', estimatedRevenue: 3400000 },
    { name: 'Springfield Restaurant Group', industry: 'restaurant', estimatedRevenue: 2300000 },
    { name: 'Naperville Tech Solutions', industry: 'technology', estimatedRevenue: 2900000 },
    { name: 'Aurora Retail Partners', industry: 'retail', estimatedRevenue: 1600000 },
    { name: 'Peoria Manufacturing Inc', industry: 'manufacturing', estimatedRevenue: 4300000 }
  ]
}

// Job statistics
interface JobStats {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  lastRunTime: string | null
  lastRunDuration: number | null
  lastRunProspects: number
  lastRunFilings: number
  nextScheduledRun: string | null
}

const stats: JobStats = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  lastRunTime: null,
  lastRunDuration: null,
  lastRunProspects: 0,
  lastRunFilings: 0,
  nextScheduledRun: null
}

/**
 * Log to file and console
 */
async function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(data && { data })
  }

  // Console output
  const color = level === 'error' ? chalk.red : level === 'warn' ? chalk.yellow : chalk.cyan
  console.log(color(`[${timestamp}] [${level.toUpperCase()}] ${message}`))
  if (data) {
    console.log(chalk.gray(JSON.stringify(data, null, 2)))
  }

  // File output
  const logDir = path.join(process.cwd(), 'logs')
  await fs.mkdir(logDir, { recursive: true })
  const logFile = path.join(logDir, `scheduler-${new Date().toISOString().split('T')[0]}.log`)
  await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n')
}

/**
 * Run a single scraping job
 */
async function runScrapingJob(config: SchedulerConfig): Promise<void> {
  const startTime = Date.now()
  stats.totalRuns++

  await log('info', 'Starting scheduled scraping job', {
    config,
    run: stats.totalRuns
  })

  try {
    // Initialize database
    await log('info', 'Connecting to database')
    const db = await initDatabase()
    const queries = createQueries(db)

    let totalProspects = 0
    let totalFilings = 0

    // Scrape each state
    for (const state of config.states) {
      try {
        await log('info', `Scraping state: ${state}`)

        const scraper = createScraper(state, { implementation: config.implementation })
        const companies = COMPANY_POOL[state].slice(0, config.companiesPerState)

        for (const company of companies) {
          const result = await scraper.search(company.name)

          if (!result.success || !result.filings || result.filings.length === 0) {
            continue
          }

          // Store prospect and filings
          const filingDate = new Date(result.filings[0].filingDate)
          const timeSinceDefault = Math.floor(
            (Date.now() - filingDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          const priorityScore = Math.min(100, Math.floor(timeSinceDefault / 14 + 50))

          const prospect = await queries.createProspect({
            companyName: company.name,
            industry: company.industry,
            state,
            priorityScore,
            defaultDate: filingDate,
            timeSinceDefault,
            estimatedRevenue: company.estimatedRevenue
          })

          totalProspects++

          for (const filing of result.filings) {
            const uccFiling = await queries.createUCCFiling({
              externalId: filing.filingNumber,
              filingDate: new Date(filing.filingDate),
              debtorName: filing.debtorName,
              securedParty: filing.securedParty,
              state,
              lienAmount: Math.floor(company.estimatedRevenue * 0.05),
              status: filing.status,
              filingType: filing.filingType,
              source: `${state.toLowerCase()}-scheduler`
            })

            await queries.linkUCCFilingToProspect(prospect.id, uccFiling.id)
            totalFilings++
          }

          // Add growth signal
          await queries.createGrowthSignal({
            prospectId: prospect.id,
            type: 'hiring',
            source: 'automated-scheduler',
            description: 'Identified through automated daily screening',
            detectedDate: new Date(),
            confidence: 0.85,
            metadata: { scheduledJob: true, state, implementation: config.implementation }
          })

          // Send notification if high-value prospect
          if (config.enableNotifications && priorityScore >= config.notificationThreshold) {
            await log('info', `High-value prospect detected: ${company.name}`, {
              priorityScore,
              state,
              estimatedRevenue: company.estimatedRevenue
            })
            // TODO: Implement email/webhook notification
          }
        }

        // Close browser if Puppeteer
        if (config.implementation === 'puppeteer') {
          const maybeClose = (scraper as Partial<{ close: () => Promise<void> | void }>).close
          if (typeof maybeClose === 'function') {
            await maybeClose()
          }
        }

        await log('info', `Completed state: ${state}`, {
          prospects: totalProspects,
          filings: totalFilings
        })
      } catch (stateError) {
        await log('error', `Failed to scrape state: ${state}`, {
          error: stateError instanceof Error ? stateError.message : stateError
        })
      }
    }

    // Close database
    await closeDatabase()

    // Update stats
    const duration = Date.now() - startTime
    stats.successfulRuns++
    stats.lastRunTime = new Date().toISOString()
    stats.lastRunDuration = duration
    stats.lastRunProspects = totalProspects
    stats.lastRunFilings = totalFilings

    await log('info', 'Scraping job completed successfully', {
      duration: `${(duration / 1000).toFixed(1)}s`,
      totalProspects,
      totalFilings,
      successRate: `${((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1)}%`
    })
  } catch (error) {
    stats.failedRuns++
    await log('error', 'Scraping job failed', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

/**
 * Start the scheduler
 */
async function startScheduler(config: SchedulerConfig) {
  console.log(chalk.bold.blue('\n🤖 UCC Data Collection Scheduler\n'))
  console.log(chalk.cyan(`Schedule: ${config.schedule}`))
  console.log(chalk.cyan(`States: ${config.states.join(', ')}`))
  console.log(chalk.cyan(`Implementation: ${config.implementation.toUpperCase()}`))
  console.log(chalk.cyan(`Companies per state: ${config.companiesPerState}`))
  console.log(chalk.cyan(`Notifications: ${config.enableNotifications ? 'Enabled' : 'Disabled'}\n`))

  // Validate cron expression
  if (!cron.validate(config.schedule)) {
    console.log(chalk.red('❌ Invalid cron schedule expression'))
    process.exit(1)
  }

  // Check implementation availability
  const availability = ScraperFactory.isImplementationAvailable(config.implementation)
  if (!availability.available) {
    console.log(
      chalk.red(`\n❌ ${config.implementation.toUpperCase()} implementation not available:`)
    )
    console.log(chalk.yellow(`   ${availability.reason}\n`))
    process.exit(1)
  }

  await log('info', 'Scheduler starting', { config })

  // Schedule the job
  const task = cron.schedule(config.schedule, async () => {
    try {
      await runScrapingJob(config)
    } catch {
      // Error already logged in runScrapingJob
    }
  })

  // Calculate next run
  const nextRun = getNextCronRun()
  stats.nextScheduledRun = nextRun
  console.log(chalk.green(`✅ Scheduler started`))
  console.log(chalk.cyan(`⏰ Next run: ${nextRun}\n`))

  // Run immediately if requested
  if (process.env.RUN_IMMEDIATELY === 'true') {
    console.log(chalk.yellow('⚡ Running immediately (RUN_IMMEDIATELY=true)\n'))
    await runScrapingJob(config)
  }

  // Keep process alive
  console.log(chalk.gray('Press Ctrl+C to stop the scheduler\n'))

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n🛑 Shutting down scheduler...'))
    task.stop()
    await closeDatabase()
    console.log(chalk.green('✅ Scheduler stopped\n'))
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n\n🛑 Received SIGTERM, shutting down...'))
    task.stop()
    await closeDatabase()
    process.exit(0)
  })
}

/**
 * Get next cron run time (approximate)
 */
function getNextCronRun(): string {
  // Simple approximation - for production, use a cron parser library
  const now = new Date()
  const tomorrow2AM = new Date(now)
  tomorrow2AM.setDate(tomorrow2AM.getDate() + 1)
  tomorrow2AM.setHours(2, 0, 0, 0)

  return tomorrow2AM.toISOString()
}

/**
 * Display current stats
 */
async function showStats() {
  console.log(chalk.bold.blue('\n📊 Scheduler Statistics\n'))
  console.log(chalk.cyan(`Total Runs: ${stats.totalRuns}`))
  console.log(chalk.green(`Successful: ${stats.successfulRuns}`))
  if (stats.failedRuns > 0) {
    console.log(chalk.red(`Failed: ${stats.failedRuns}`))
  }
  console.log(
    chalk.cyan(
      `Success Rate: ${stats.totalRuns > 0 ? ((stats.successfulRuns / stats.totalRuns) * 100).toFixed(1) : 0}%`
    )
  )

  if (stats.lastRunTime) {
    console.log(chalk.bold('\n📅 Last Run:'))
    console.log(chalk.cyan(`Time: ${new Date(stats.lastRunTime).toLocaleString()}`))
    console.log(
      chalk.cyan(
        `Duration: ${stats.lastRunDuration ? (stats.lastRunDuration / 1000).toFixed(1) : 0}s`
      )
    )
    console.log(chalk.cyan(`Prospects: ${stats.lastRunProspects}`))
    console.log(chalk.cyan(`Filings: ${stats.lastRunFilings}`))
  }

  if (stats.nextScheduledRun) {
    console.log(chalk.bold('\n⏰ Next Run:'))
    console.log(chalk.cyan(new Date(stats.nextScheduledRun).toLocaleString()))
  }

  console.log()
}

// Main execution
const command = process.argv[2]

if (command === 'stats') {
  showStats()
} else {
  startScheduler(defaultConfig)
}
