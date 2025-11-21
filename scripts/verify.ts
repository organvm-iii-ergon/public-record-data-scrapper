#!/usr/bin/env tsx
/**
 * System Verification Script
 *
 * Verifies that all system components are working correctly
 * Run this after installation to ensure everything is set up properly
 */

import chalk from 'chalk'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface Check {
  name: string
  check: () => Promise<{ success: boolean; message: string }>
}

const checks: Check[] = [
  {
    name: 'Node.js Version',
    check: async () => {
      const nodeVersion = process.version
      const major = parseInt(nodeVersion.slice(1).split('.')[0])
      return {
        success: major >= 18,
        message: major >= 18 ? `✅ ${nodeVersion}` : `❌ ${nodeVersion} (need 18+)`
      }
    }
  },
  {
    name: 'PostgreSQL Installation',
    check: async () => {
      try {
        await execAsync('pg_isready')
        return {
          success: true,
          message: '✅ PostgreSQL is running'
        }
      } catch {
        return {
          success: false,
          message: '❌ PostgreSQL not running or not installed'
        }
      }
    }
  },
  {
    name: 'Dependencies Installed',
    check: async () => {
      const hasNodeModules = existsSync('./node_modules')
      return {
        success: hasNodeModules,
        message: hasNodeModules ? '✅ node_modules exists' : '❌ Run npm install'
      }
    }
  },
  {
    name: 'Environment Configuration',
    check: async () => {
      const hasEnv = existsSync('./.env')
      return {
        success: hasEnv,
        message: hasEnv ? '✅ .env file exists' : '⚠️  .env not found (optional)'
      }
    }
  },
  {
    name: 'Database Tables',
    check: async () => {
      try {
        // Try to import database module
        const { getDatabase } = await import('../src/lib/database/index.js')
        const db = getDatabase()

        // Quick connection test
        await db.query('SELECT 1')

        return {
          success: true,
          message: '✅ Database connection successful'
        }
      } catch (error) {
        return {
          success: false,
          message: `❌ Database error: ${error instanceof Error ? error.message : 'Unknown'}`
        }
      }
    }
  },
  {
    name: 'TypeScript Build',
    check: async () => {
      try {
        await execAsync('npm run build')
        return {
          success: true,
          message: '✅ TypeScript builds successfully'
        }
      } catch {
        return {
          success: false,
          message: '❌ TypeScript build failed'
        }
      }
    }
  },
  {
    name: 'Tests',
    check: async () => {
      try {
        const { stdout } = await execAsync('npm test -- --run')
        const passing = stdout.includes('512') || stdout.includes('passing')
        return {
          success: passing,
          message: passing ? '✅ Tests passing' : '❌ Tests failing'
        }
      } catch {
        return {
          success: false,
          message: '❌ Tests failed to run'
        }
      }
    }
  }
]

async function runChecks() {
  console.log(chalk.bold.blue('\n🔍 UCC Intelligence Platform - System Verification\n'))

  let passedChecks = 0
  let totalChecks = checks.length

  for (const check of checks) {
    process.stdout.write(chalk.cyan(`Checking ${check.name}... `))

    try {
      const result = await check.check()
      console.log(result.message)
      if (result.success) passedChecks++
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error instanceof Error ? error.message : error}`))
    }
  }

  console.log(chalk.bold.blue('\n\n📊 Verification Summary\n'))
  console.log(chalk.cyan(`Checks Passed: ${passedChecks}/${totalChecks}`))

  if (passedChecks === totalChecks) {
    console.log(chalk.green('\n✅ All checks passed! System is ready to use.\n'))
    console.log(chalk.bold('Next Steps:'))
    console.log(chalk.cyan('  1. npm run db:setup      # Set up database with sample data'))
    console.log(chalk.cyan('  2. npm run dev           # Start UI dashboard'))
    console.log(chalk.cyan('  3. npm run scheduler     # Start autonomous scheduler\n'))
    process.exit(0)
  } else {
    console.log(chalk.yellow(`\n⚠️  ${totalChecks - passedChecks} check(s) failed.\n`))
    console.log(chalk.bold('Troubleshooting:'))
    console.log(chalk.cyan('  - PostgreSQL: brew install postgresql@16 && brew services start postgresql@16'))
    console.log(chalk.cyan('  - Dependencies: npm install'))
    console.log(chalk.cyan('  - Environment: cp .env.example .env'))
    console.log(chalk.cyan('  - Database: npm run db:init\n'))
    process.exit(1)
  }
}

runChecks()
