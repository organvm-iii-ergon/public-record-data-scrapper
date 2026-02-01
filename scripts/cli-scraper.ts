#!/usr/bin/env node
/**
 * CLI Data Scraper
 *
 * Standalone terminal script for scraping UCC filing data and enriching company information
 * No GUI required - designed for solo individual use and field data collection
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ScraperAgent } from '../apps/web/src/lib/agentic/agents/ScraperAgent'
import { DataNormalizationAgent } from '../apps/web/src/lib/agentic/agents/DataNormalizationAgent'
import { EnrichmentOrchestratorAgent } from '../apps/web/src/lib/agentic/agents/EnrichmentOrchestratorAgent'
import { UCCFiling } from './scrapers/base-scraper'

const program = new Command()

// Configure CLI
program
  .name('ucc-scraper')
  .description('UCC filing and company data scraper - Terminal-based data collection tool')
  .version('1.0.0')

// Scrape UCC filings command
program
  .command('scrape-ucc')
  .description('Scrape UCC filings for a company in a specific state')
  .requiredOption('-c, --company <name>', 'Company name to search')
  .requiredOption('-s, --state <code>', 'State code (CA, TX, FL)')
  .option('-o, --output <file>', 'Output file path (JSON)', './output.json')
  .option('--csv', 'Export as CSV instead of JSON')
  .action(async (options) => {
    const spinner = ora('Initializing scraper...').start()

    try {
      spinner.text = `Searching UCC filings for ${options.company} in ${options.state}...`

      const scraperAgent = new ScraperAgent()
      const result = await scraperAgent.executeTask({
        type: 'scrape-ucc',
        payload: {
          companyName: options.company,
          state: options.state.toUpperCase()
        }
      })

      if (!result.success) {
        spinner.fail(chalk.red('Scraping failed'))
        console.error(chalk.red('Error:'), result.error)

        if (result.data?.searchUrl) {
          console.log(chalk.yellow('\nManual search URL:'), result.data.searchUrl)
        }

        process.exit(1)
      }

      spinner.succeed(chalk.green('Scraping completed'))

      // Display results
      console.log(chalk.cyan('\n=== Results ==='))
      console.log(chalk.white(`Company: ${options.company}`))
      console.log(chalk.white(`State: ${result.data.state}`))
      console.log(chalk.white(`Filings found: ${result.data.filingCount}`))

      if (result.data?.retryCount && result.data.retryCount > 0) {
        console.log(chalk.yellow(`Retries: ${result.data.retryCount}`))
      }

      if (result.data?.parsingErrors && result.data.parsingErrors.length > 0) {
        console.log(chalk.yellow(`\n⚠ Parsing warnings (${result.data.parsingErrors.length}):`))
        result.data.parsingErrors.slice(0, 5).forEach((err: string) => {
          console.log(chalk.gray(`  • ${err}`))
        })
        if (result.data.parsingErrors.length > 5) {
          console.log(chalk.gray(`  ... and ${result.data.parsingErrors.length - 5} more`))
        }
      }

      if (result.data?.filingCount > 0) {
        console.log(chalk.cyan('\n--- Filings ---'))
        result.data.filings.forEach((filing: UCCFiling, idx: number) => {
          console.log(chalk.white(`\n${idx + 1}. Filing #${filing.filingNumber}`))
          console.log(chalk.gray(`   Debtor: ${filing.debtorName}`))
          console.log(chalk.gray(`   Secured Party: ${filing.securedParty}`))
          console.log(chalk.gray(`   Date: ${filing.filingDate}`))
          console.log(chalk.gray(`   Status: ${filing.status}`))
        })
      }

      // Save to file
      const outputPath = path.resolve(options.output)
      let fileContent: string

      if (options.csv) {
        // Convert to CSV
        fileContent = convertToCSV(result.data)
      } else {
        // Save as JSON
        fileContent = JSON.stringify(result.data, null, 2)
      }

      await fs.writeFile(outputPath, fileContent, 'utf-8')
      console.log(chalk.green(`\n✓ Results saved to: ${outputPath}`))

      if (result.data.searchUrl) {
        console.log(chalk.blue(`\nManual verification URL: ${result.data.searchUrl}`))
      }
    } catch (error) {
      spinner.fail(chalk.red('Operation failed'))
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Enrich company data command
program
  .command('enrich')
  .description('Enrich company data from multiple public sources')
  .requiredOption('-c, --company <name>', 'Company name')
  .requiredOption('-s, --state <code>', 'State code')
  .option('-o, --output <file>', 'Output file path', './enriched-data.json')
  .option('--tier <level>', 'Subscription tier (free, starter, professional)', 'free')
  .option('--csv', 'Export as CSV instead of JSON')
  .action(async (options) => {
    const spinner = ora('Initializing enrichment pipeline...').start()

    try {
      spinner.text = `Enriching data for ${options.company}...`

      const orchestrator = new EnrichmentOrchestratorAgent()
      const userId = `cli-user-${Date.now()}`

      const result = await orchestrator.executeTask({
        type: 'enrich-prospect',
        payload: {
          companyName: options.company,
          state: options.state.toUpperCase(),
          tier: options.tier,
          userId
        }
      })

      if (!result.success) {
        spinner.fail(chalk.red('Enrichment failed'))
        console.error(chalk.red('Error:'), result.error)
        process.exit(1)
      }

      spinner.succeed(chalk.green('Enrichment completed'))

      // Display results
      console.log(chalk.cyan('\n=== Enrichment Results ==='))
      console.log(chalk.white(`Company: ${options.company}`))
      console.log(chalk.white(`Sources used: ${result.data?.sources?.length || 0}`))
      console.log(chalk.white(`Total cost: $${result.data?.cost || 0}`))
      console.log(chalk.white(`Response time: ${result.data?.responseTime || 0}ms`))

      if (result.data?.enrichedData) {
        console.log(chalk.cyan('\n--- Enriched Data Summary ---'))
        const data = result.data.enrichedData

        if (data.sec) {
          console.log(chalk.white(`\nSEC EDGAR:`))
          console.log(chalk.gray(`  CIK: ${data.sec.cik || 'N/A'}`))
          console.log(chalk.gray(`  SIC: ${data.sec.sicCode || 'N/A'}`))
        }

        if (data.osha) {
          console.log(chalk.white(`\nOSHA:`))
          console.log(chalk.gray(`  Violations: ${data.osha.violations || 0}`))
          console.log(chalk.gray(`  Penalties: $${data.osha.totalPenalties || 0}`))
        }

        if (data.uspto) {
          console.log(chalk.white(`\nUSPTO:`))
          console.log(chalk.gray(`  Trademarks: ${data.uspto.trademarkCount || 0}`))
        }

        if (data.samGov) {
          console.log(chalk.white(`\nSAM.gov:`))
          console.log(chalk.gray(`  Registered: ${data.samGov.isRegistered ? 'Yes' : 'No'}`))
          console.log(chalk.gray(`  Contracts: ${data.samGov.contractCount || 0}`))
        }
      }

      // Save to file
      const outputPath = path.resolve(options.output)
      let fileContent: string

      if (options.csv) {
        fileContent = convertEnrichmentToCSV(result.data)
      } else {
        fileContent = JSON.stringify(result.data, null, 2)
      }

      await fs.writeFile(outputPath, fileContent, 'utf-8')
      console.log(chalk.green(`\n✓ Results saved to: ${outputPath}`))
    } catch (error) {
      spinner.fail(chalk.red('Operation failed'))
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Normalize company name
program
  .command('normalize')
  .description('Normalize and standardize company name')
  .requiredOption('-n, --name <name>', 'Company name to normalize')
  .action(async (options) => {
    const spinner = ora('Normalizing company name...').start()

    try {
      const normAgent = new DataNormalizationAgent()
      const result = await normAgent.executeTask({
        type: 'normalize-company-name',
        payload: { name: options.name }
      })

      if (result.success) {
        spinner.succeed(chalk.green('Normalization completed'))
        console.log(chalk.cyan('\nOriginal:'), chalk.white(result.data.original))
        console.log(chalk.cyan('Normalized:'), chalk.white(result.data.normalized))
      } else {
        spinner.fail(chalk.red('Normalization failed'))
        console.error(chalk.red('Error:'), result.error)
        process.exit(1)
      }
    } catch (error) {
      spinner.fail(chalk.red('Operation failed'))
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// List available states
program
  .command('list-states')
  .description('List all states with available UCC scrapers')
  .action(async () => {
    const spinner = ora('Checking available scrapers...').start()

    try {
      const scraperAgent = new ScraperAgent()
      const result = await scraperAgent.executeTask({
        type: 'list-available-states',
        payload: {}
      })

      spinner.succeed(chalk.green('Available scrapers'))

      console.log(chalk.cyan('\n=== Supported States ==='))
      result.data.states.forEach((state: string) => {
        console.log(chalk.white(`  ✓ ${state}`))
      })
      console.log(chalk.gray(`\nTotal: ${result.data.count} states\n`))
    } catch (error) {
      spinner.fail(chalk.red('Operation failed'))
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Batch processing command
program
  .command('batch')
  .description('Process multiple companies from a file')
  .requiredOption('-i, --input <file>', 'Input CSV file (company,state)')
  .option('-o, --output <dir>', 'Output directory', './batch-results')
  .option('--enrich', 'Also enrich data for each company')
  .action(async (options) => {
    const spinner = ora('Reading input file...').start()

    try {
      // Read input file
      const inputPath = path.resolve(options.input)
      const inputContent = await fs.readFile(inputPath, 'utf-8')
      const lines = inputContent
        .trim()
        .split('\n')
        .filter((line) => line.trim() !== '')

      if (lines.length < 2) {
        spinner.fail(chalk.red('Input file must contain header and at least one data row'))
        process.exit(1)
      }

      const companies = lines
        .slice(1)
        .map((line, idx) => {
          // Simple CSV parsing - handles quoted fields
          const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || []
          const company = (fields[0] || '').replace(/^"|"$/g, '').trim()
          const state = (fields[1] || '').replace(/^"|"$/g, '').trim()

          if (!company || !state) {
            console.log(chalk.yellow(`⚠ Skipping invalid line ${idx + 2}: ${line}`))
            return null
          }

          return { company, state }
        })
        .filter(Boolean) as { company: string; state: string }[]

      spinner.succeed(chalk.green(`Found ${companies.length} companies to process`))

      // Create output directory
      const outputDir = path.resolve(options.output)
      await fs.mkdir(outputDir, { recursive: true })

      // Process each company
      const results = []

      for (let i = 0; i < companies.length; i++) {
        const { company, state } = companies[i]
        console.log(
          chalk.cyan(`\n[${i + 1}/${companies.length}] Processing ${company} (${state})...`)
        )

        const scraperAgent = new ScraperAgent()
        const result = await scraperAgent.executeTask({
          type: 'scrape-ucc',
          payload: { companyName: company, state: state.toUpperCase() }
        })

        if (result.success) {
          console.log(chalk.green(`  ✓ Found ${result.data.filingCount} filings`))
          results.push({ company, state, ...result.data })

          // Save individual result with timestamp to avoid collisions
          const timestamp = Date.now()
          const sanitized = company.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50)
          const filename = `${sanitized}-${state}-${timestamp}.json`
          await fs.writeFile(
            path.join(outputDir, filename),
            JSON.stringify(result.data, null, 2),
            'utf-8'
          )
        } else {
          console.log(chalk.yellow(`  ⚠ Failed: ${result.error}`))
          results.push({ company, state, error: result.error })
        }

        // Rate limiting
        if (i < companies.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 15000)) // 15 second delay
        }
      }

      // Save summary
      const summaryPath = path.join(outputDir, 'summary.json')
      await fs.writeFile(summaryPath, JSON.stringify(results, null, 2), 'utf-8')

      console.log(chalk.green(`\n✓ Batch processing completed`))
      console.log(chalk.white(`Results saved to: ${outputDir}`))
    } catch (error) {
      spinner.fail(chalk.red('Batch processing failed'))
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Helper function to convert data to CSV
function convertToCSV(data: { filings?: UCCFiling[] }): string {
  if (!data.filings || data.filings.length === 0) {
    return 'No filings found'
  }

  const headers = [
    'Filing Number',
    'Debtor Name',
    'Secured Party',
    'Filing Date',
    'Status',
    'Collateral',
    'Type'
  ]
  const rows = data.filings.map((filing: UCCFiling) => [
    filing.filingNumber,
    filing.debtorName,
    filing.securedParty,
    filing.filingDate,
    filing.status,
    filing.collateral || '',
    filing.filingType || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row: string[]) => row.map(escapeCSV).join(','))
  ].join('\n')

  return csvContent
}

function convertEnrichmentToCSV(data: Record<string, unknown>): string {
  const headers = ['Field', 'Value']
  const rows: string[][] = []

  rows.push(['Company Name', String(data.companyName || '')])
  rows.push(['State', String(data.state || '')])
  rows.push(['Sources Used', Array.isArray(data.sources) ? data.sources.join(', ') : ''])
  rows.push(['Total Cost', `$${data.cost || 0}`])

  if (data.enrichedData && typeof data.enrichedData === 'object') {
    const enriched = data.enrichedData as Record<string, Record<string, unknown>>
    if (enriched.sec) {
      rows.push(['SEC CIK', enriched.sec.cik || ''])
      rows.push(['SEC SIC Code', enriched.sec.sicCode || ''])
    }
    if (enriched.osha) {
      rows.push(['OSHA Violations', enriched.osha.violations || '0'])
      rows.push(['OSHA Penalties', `$${enriched.osha.totalPenalties || 0}`])
    }
    if (enriched.uspto) {
      rows.push(['USPTO Trademarks', enriched.uspto.trademarkCount || '0'])
    }
    if (enriched.samGov) {
      rows.push(['SAM.gov Registered', enriched.samGov.isRegistered ? 'Yes' : 'No'])
      rows.push(['SAM.gov Contracts', enriched.samGov.contractCount || '0'])
    }
  }

  return [headers.join(','), ...rows.map((row) => row.map(escapeCSV).join(','))].join('\n')
}

function escapeCSV(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Parse and execute
program.parse()
