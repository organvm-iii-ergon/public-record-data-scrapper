import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACHClient } from '../../integrations/ach/client'
import { S3Client } from '../../integrations/aws/s3'

beforeEach(() => {
  for (const name of [
    'ACH_API_KEY',
    'ACH_MERCHANT_ID',
    'ACH_ENVIRONMENT',
    'ACH_WEBHOOK_BASE_URL',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'S3_BUCKET_NAME',
    'S3_ENDPOINT'
  ])
    vi.stubEnv(name, undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe('unwired adapters never fabricate provider results', () => {
  it.each([false, true])('ACH rejects operations with configured=%s', async (configured) => {
    const c = new ACHClient(
      configured
        ? {
            apiKey: 'test-only',
            merchantId: 'test-merchant',
            environment: 'production',
            webhookBaseUrl: 'https://app.example.test'
          }
        : undefined
    )
    await c.initialize()
    await c.initialize()
    expect(c.isConfigured()).toBe(configured)
    expect(c.getEnvironment()).toBe(configured ? 'production' : 'sandbox')
    expect(c.getMerchantId()).toBe(configured ? 'test-merchant' : '')
    expect(c.getWebhookBaseUrl()).toBe(configured ? 'https://app.example.test' : undefined)
    expect(c.generateWebhookUrls()).toEqual(
      configured
        ? {
            statusWebhook: 'https://app.example.test/api/webhooks/ach/status',
            returnWebhook: 'https://app.example.test/api/webhooks/ach/return'
          }
        : {}
    )
    const expected = configured ? /not wired/ : /not configured/
    for (const operation of [
      () => c.initiateDebit(100, 'test-account'),
      () => c.initiateCredit(100, 'test-account'),
      () => c.checkStatus('test-tx'),
      () => c.cancelTransaction('test-tx'),
      () => c.getTransactionHistory('test-account'),
      () => c.validateAccount('021000021', '12345678')
    ])
      await expect(operation()).rejects.toThrow(expected)
  })
  it.each([
    ['bad', '12345678'],
    ['021000022', '12345678'],
    ['021000021', ''],
    ['021000021', '123'],
    ['021000021', '123456789012345678']
  ])(
    'rejects invalid account input without claiming provider verification',
    async (routing, account) => {
      expect(await new ACHClient().validateAccount(routing, account)).toBe(false)
    }
  )
  it.each([false, true])(
    'S3 rejects every storage operation with configured=%s',
    async (configured) => {
      const c = new S3Client(
        configured
          ? {
              accessKeyId: 'test-key',
              secretAccessKey: 'test-secret',
              bucketName: 'test-bucket',
              region: 'us-west-2',
              endpoint: 'https://storage.example.test'
            }
          : undefined
      )
      await c.initialize()
      await c.initialize()
      expect(c.isConfigured()).toBe(configured)
      expect(c.getBucketName()).toBe(configured ? 'test-bucket' : 'mca-documents')
      expect(c.getRegion()).toBe(configured ? 'us-west-2' : 'us-east-1')
      expect(c.getS3Url('document')).toBe(
        configured
          ? 'https://storage.example.test/test-bucket/document'
          : 'https://mca-documents.s3.us-east-1.amazonaws.com/document'
      )
      const expected = configured ? /not wired/ : /not configured/
      for (const operation of [
        () => c.uploadDocument('test-prospect', Buffer.from('test'), 'application/pdf'),
        () => c.uploadDocument('test-prospect', Buffer.from('test'), 'application/unknown'),
        () => c.upload('key', Buffer.from('test'), 'text/plain'),
        () => c.getPresignedUrl('key'),
        () => c.getPresignedUrl('key', 120),
        () => c.getPresignedUrlWithExpiry('key'),
        () => c.getPresignedUrlWithExpiry('key', 120),
        () => c.getPresignedUploadUrl('key', 'text/plain'),
        () => c.getPresignedUploadUrl('key', 'text/plain', 120),
        () => c.deleteDocument('key'),
        () => c.deleteDocuments(['key']),
        () => c.documentExists('key'),
        () => c.listDocuments('prefix'),
        () => c.listDocuments('prefix', 20),
        () => c.copyDocument('source', 'dest')
      ])
        await expect(operation()).rejects.toThrow(expected)
    }
  )
  it('generates unique storage keys without claiming they exist', () => {
    const c = new S3Client()
    const first = c.generateDocumentKey('test-prospect', 'Tax Report.pdf', 'tax')
    const second = c.generateDocumentKey('test-prospect', 'Tax Report.pdf', 'tax')
    expect(first).toMatch(/^prospects\/test-prospect\/tax\/[a-f0-9-]+-tax-report.pdf$/)
    expect(second).not.toBe(first)
    expect(c.generateDocumentKey('test-prospect', 'No Extension')).toMatch(/-no-extension$/)
  })
})
