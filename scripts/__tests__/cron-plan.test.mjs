import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scheduledTasks, PIPELINE_CRON } from '../../cloudflare/workers/api/src/cron-plan.ts'

test('one trigger preserves daily ingestion, six-hour enrichment and twelve-hour health schedules', () => {
  for (let day = 1; day <= 31; day++) {
    const counts = { ingestion: 0, enrichment: 0, health: 0 }
    for (let hour = 0; hour < 24; hour++) {
      const tasks = scheduledTasks(PIPELINE_CRON, Date.UTC(2026, 0, day, hour))
      assert.equal(tasks.includes('ingestion'), hour === 2)
      assert.equal(tasks.includes('enrichment'), hour % 6 === 0)
      assert.equal(tasks.includes('health'), hour % 12 === 0)
      for (const task of tasks) counts[task]++
    }
    assert.deepEqual(counts, { ingestion: 1, enrichment: 4, health: 2 })
  }
})

test('legacy event routing is preserved while unknown and malformed unified events fail closed', () => {
  assert.deepEqual(scheduledTasks('0 2 * * *', 0), ['ingestion'])
  assert.deepEqual(scheduledTasks('0 */6 * * *', 0), ['enrichment'])
  assert.deepEqual(scheduledTasks('0 */12 * * *', 0), ['health'])
  assert.deepEqual(scheduledTasks('unknown', 0), [])
  assert.throws(() => scheduledTasks(PIPELINE_CRON, NaN))
  assert.throws(() => scheduledTasks(PIPELINE_CRON, Date.UTC(2026, 0, 1, 2, 1)))
})
