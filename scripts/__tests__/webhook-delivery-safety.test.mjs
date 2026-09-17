import assert from 'node:assert/strict'
import test from 'node:test'

import {
  drainWebhookDeliveries,
  readBoundedResponseBody,
  replayWebhookDelivery
} from '../../cloudflare/workers/api/src/webhooks.ts'

function createEnv({ firstResult = null, allResults = [] } = {}) {
  const calls = []
  const DB = {
    prepare(sql) {
      const call = { sql, params: [], operation: null }
      calls.push(call)
      return {
        bind(...params) {
          call.params = params
          return {
            async all() {
              call.operation = 'all'
              return { results: allResults }
            },
            async first() {
              call.operation = 'first'
              return firstResult
            },
            async run() {
              call.operation = 'run'
              return { success: true }
            }
          }
        }
      }
    }
  }

  return { env: { DB }, calls }
}

test('bounded response reader cancels after the byte limit', async () => {
  let cancelled = false
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600).fill(97))
      controller.enqueue(new Uint8Array(600).fill(98))
    },
    cancel() {
      cancelled = true
    }
  })

  const body = await readBoundedResponseBody(new Response(stream), 1000)

  assert.equal(new TextEncoder().encode(body).byteLength, 1000)
  assert.equal(body.slice(0, 600), 'a'.repeat(600))
  assert.equal(body.slice(600), 'b'.repeat(400))
  assert.equal(cancelled, true)
})

test('pending drain excludes paused endpoints and normalizes ISO retry timestamps', async () => {
  const { env, calls } = createEnv()

  assert.equal(await drainWebhookDeliveries(env, 17), 0)
  assert.equal(calls.length, 1)
  assert.match(calls[0].sql, /INNER JOIN webhook_endpoints e/)
  assert.match(calls[0].sql, /e\.status = 'active'/)
  assert.match(calls[0].sql, /datetime\(d\.next_retry_at\) <= datetime\('now'\)/)
  assert.deepEqual(calls[0].params, [17])
})

test('manual replay selects only failed or dead-letter deliveries', async () => {
  const { env, calls } = createEnv({ firstResult: null })

  assert.equal(await replayWebhookDelivery(env, 'org-1', 'delivery-1'), false)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].operation, 'first')
  assert.match(calls[0].sql, /status IN \('failed', 'dead_letter'\)/)
  assert.deepEqual(calls[0].params, ['delivery-1', 'org-1'])
})
