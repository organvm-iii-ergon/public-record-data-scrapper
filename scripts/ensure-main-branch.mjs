#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()
const gitDirectory = join(repoRoot, '.git')

if (!existsSync(gitDirectory)) {
  process.exit(0)
}

function commandSucceeds(command) {
  try {
    execSync(command, { stdio: 'ignore' })
    return true
  } catch (error) {
    return false
  }
}

function runCommand(command) {
  try {
    execSync(command, { stdio: 'inherit' })
    return true
  } catch (error) {
    console.warn(`[ensure-main-branch] Command failed: ${command}`)
    return false
  }
}

const hasLocalMain = commandSucceeds('git rev-parse --verify main')

if (hasLocalMain) {
  process.exit(0)
}

const hasOrigin = commandSucceeds('git remote show origin')
if (!hasOrigin) {
  console.warn('[ensure-main-branch] Remote "origin" not found. Skipping fetch for main branch.')
  process.exit(0)
}

const remoteHasMain = commandSucceeds('git ls-remote --exit-code --heads origin main')
if (!remoteHasMain) {
  console.warn('[ensure-main-branch] Remote does not have a "main" branch. Skipping fetch.')
  process.exit(0)
}

console.log('[ensure-main-branch] Fetching missing main branch from origin...')

if (runCommand('git fetch origin main:main')) {
  process.exit(0)
}

console.log('[ensure-main-branch] Direct fetch failed. Attempting to fetch all branches and create local tracking branch...')

if (runCommand('git fetch origin')) {
  if (!commandSucceeds('git rev-parse --verify main')) {
    runCommand('git branch --track main origin/main')
  }
}

process.exit(0)
