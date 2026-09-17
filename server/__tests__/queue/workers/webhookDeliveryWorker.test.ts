import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentOrgId } from '../../../middleware/orgContext'
import {
  processWebhookDeliveryJob,
  type WebhookDeliveryJobData
} from '../../../queue/workers/webhookDeliveryWorker'

const mocks = vi.hoisted(() => ({ deliver: vi.fn() }))

vi.mock('../../../database/connection', () => ({ database: {} }))
vi.mock('../../../queue/connection', () => ({ redisConnection: {} }))
vi.mock('../../../services/OutboundWebhookService', () => ({
  MAX_DELIVERY_ATTEMPTS: 5,
  OutboundWebhookService: class {
    deliver = mocks.deliver
  }
}))

const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const job = (orgId: string): WebhookDeliveryJobData => ({
  orgId,
  deliveryId: orgId,
  event: 'webhook.test',
  attemptsMade: 0
})

beforeEach(() => {
  mocks.deliver.mockReset()
})

describe('webhook worker tenant context', () => {
  it('retains distinct organization contexts across concurrent jobs and async queries', async () => {
    mocks.deliver.mockImplementation(async (deliveryId: string) => {
      expect(getCurrentOrgId()).toBe(deliveryId)
      await new Promise((resolve) => setTimeout(resolve, 1))
      expect(getCurrentOrgId()).toBe(deliveryId)
      return { success: true, responseStatus: 200 }
    })

    const results = await Promise.all([
      processWebhookDeliveryJob(job(orgA)),
      processWebhookDeliveryJob(job(orgB))
    ])

    expect(results.map((result) => result.newStatus)).toEqual(['delivered', 'delivered'])
    expect(getCurrentOrgId()).toBeUndefined()
  })

  it.each([undefined, '', 'not-a-uuid'])('rejects an absent or malformed tenant: %s', async (orgId) => {
    await expect(processWebhookDeliveryJob(job(orgId as string))).rejects.toThrow(
      'organization UUID'
    )
    expect(mocks.deliver).not.toHaveBeenCalled()
    expect(getCurrentOrgId()).toBeUndefined()
  })

  it('restores context after a failed database operation', async () => {
    mocks.deliver.mockImplementation(async () => {
      expect(getCurrentOrgId()).toBe(orgA)
      throw new Error('database unavailable')
    })
    await expect(processWebhookDeliveryJob(job(orgA))).rejects.toThrow('database unavailable')
    expect(getCurrentOrgId()).toBeUndefined()
  })

  it('keeps durable retry outcomes inside the tenant context', async () => {
    mocks.deliver.mockImplementation(async () => {
      expect(getCurrentOrgId()).toBe(orgA)
      return { success: false, responseStatus: 503 }
    })
    await expect(processWebhookDeliveryJob(job(orgA))).resolves.toMatchObject({
      success: false,
      newStatus: 'failed'
    })
    expect(getCurrentOrgId()).toBeUndefined()
  })
})
