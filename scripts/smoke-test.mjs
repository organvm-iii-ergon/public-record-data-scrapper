#!/usr/bin/env node
/**
 * Production smoke test.
 *
 * Polls the API health endpoint until it returns HTTP 200 and a healthy or
 * degraded status, then exits 0. Exits non-zero if the server never becomes
 * healthy within the timeout.
 *
 * Usage:
 *   npm run smoke
 *   SMOKE_URL=https://api.example.com npm run smoke
 *   node scripts/smoke-test.mjs https://api.example.com/api/health
 */

const arg = process.argv[2]
const rawUrl = arg || process.env.SMOKE_URL || 'http://localhost:3000'
const healthUrl = /\/api\/health\b/.test(rawUrl)
  ? rawUrl
  : `${rawUrl.replace(/\/+$/, '')}/api/health`

const timeoutSec = Number(process.env.SMOKE_TIMEOUT || 30)
const intervalSec = Number(process.env.SMOKE_INTERVAL || 2)
const deadline = Date.now() + timeoutSec * 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function attempt() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(healthUrl, { signal: controller.signal })
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` }
    }
    const body = await response.json().catch(() => ({}))
    if (body.status === 'ok' || body.status === 'degraded') {
      return { ok: true, body }
    }
    return { ok: false, reason: `unexpected body: ${JSON.stringify(body)}` }
  } catch (error) {
    return {
      ok: false,
      reason: error.name === 'AbortError' ? 'request timed out' : error.message
    }
  } finally {
    clearTimeout(timeout)
  }
}

console.log(`[smoke] checking ${healthUrl} (timeout ${timeoutSec}s)`)

let lastReason = 'no attempts made'
while (Date.now() < deadline) {
  const result = await attempt()
  if (result.ok) {
    console.log(
      `[smoke] healthy: status=${result.body.status} uptime=${result.body.uptime ?? 'n/a'}s`
    )
    process.exit(0)
  }
  lastReason = result.reason
  console.log(`[smoke] not ready (${lastReason}); retrying in ${intervalSec}s`)
  await sleep(intervalSec * 1000)
}

console.error(`[smoke] failed after ${timeoutSec}s; last error: ${lastReason}`)
process.exit(1)
