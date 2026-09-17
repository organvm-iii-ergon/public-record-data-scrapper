import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SendGridClient } from '../../integrations/sendgrid/client'

const fetchRequest = vi.fn<typeof fetch>()
function client() {
  return new SendGridClient({
    apiKey: 'test-only-key',
    fromEmail: 'sender@example.test',
    fromName: 'Test sender',
    sandboxMode: false,
    webhookBaseUrl: 'https://app.example.test'
  })
}
beforeEach(() => {
  fetchRequest.mockReset()
  vi.stubGlobal('fetch', fetchRequest)
  vi.stubEnv('SENDGRID_API_KEY', '')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('SendGrid transport contract', () => {
  it('does not send a request without credentials', async () => {
    const result = await new SendGridClient().request('POST', '/v3/mail/send', {})
    expect(result).toMatchObject({ success: false, error: { code: 401 } })
    expect(fetchRequest).not.toHaveBeenCalled()
  })
  it('returns the provider acknowledgement and sends the encoded payload', async () => {
    fetchRequest.mockResolvedValueOnce(
      new Response(null, { status: 202, headers: { 'x-message-id': 'provider-receipt' } })
    )
    const result = await client().request('POST', '/v3/mail/send', { subject: 'Transport test' })
    expect(result).toEqual({
      success: true,
      data: { messageId: 'provider-receipt', status: 'accepted' }
    })
    expect(fetchRequest).toHaveBeenCalledWith(
      new URL('https://api.sendgrid.com/v3/mail/send'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ subject: 'Transport test' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer test-only-key',
          'Content-Type': 'application/json'
        })
      })
    )
  })
  it('encodes query parameters and omits missing values', async () => {
    fetchRequest.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [] }), { status: 200 })
    )
    expect(
      await client().request('GET', '/v3/messages', {
        query: 'a & b',
        limit: 0,
        missing: undefined,
        empty: null
      })
    ).toEqual({ success: true, data: { result: [] } })
    const url = new URL(String(fetchRequest.mock.calls[0][0]))
    expect([...url.searchParams.entries()]).toEqual([
      ['query', 'a & b'],
      ['limit', '0']
    ])
    expect(fetchRequest.mock.calls[0][1]?.body).toBeUndefined()
  })
  it.each([
    [JSON.stringify({ errors: [{ message: 'Denied' }, {}] }), 'Denied'],
    ['upstream outage', 'upstream outage'],
    ['', 'SendGrid request failed with status 503']
  ])('reports provider failure for %s', async (payload, message) => {
    fetchRequest.mockResolvedValueOnce(new Response(payload, { status: 503 }))
    const result = await client().request('PATCH', '/v3/marketing/contacts', {})
    expect(result).toMatchObject({ success: false, error: { code: 503, message } })
    if (payload.startsWith('{'))
      expect(result.error?.errors).toEqual([
        { message: 'Denied' },
        { message: 'Provider returned an unspecified error' }
      ])
  })
  it('does not fabricate success on transport rejection', async () => {
    fetchRequest.mockRejectedValueOnce(new Error('network unavailable'))
    await expect(client().request('GET', '/v3/messages')).rejects.toThrow('network unavailable')
  })
  it('handles an empty DELETE acknowledgement without a request body', async () => {
    fetchRequest.mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await client().request('DELETE', '/v3/marketing/contacts', { ignored: true })).toEqual({
      success: true,
      data: {}
    })
    expect(fetchRequest.mock.calls[0][1]?.body).toBeUndefined()
  })
  it('uses configured sender details and validates address format', async () => {
    const c = client()
    await c.initialize()
    await c.initialize()
    expect(c.getFromEmail()).toBe('sender@example.test')
    expect(c.getFromName()).toBe('Test sender')
    expect(c.isSandboxMode()).toBe(false)
    expect(c.getWebhookBaseUrl()).toBe('https://app.example.test')
    expect(c.buildSender()).toEqual({ email: 'sender@example.test', name: 'Test sender' })
    expect(c.buildSender({ email: 'other@example.test', name: 'Other' })).toEqual({
      email: 'other@example.test',
      name: 'Other'
    })
    expect(c.validateEmail('broken')).toBe(false)
    expect(c.validateEmail('sender@example.test')).toBe(true)
    expect(c.generateWebhookUrls().eventWebhook).toBe(
      'https://app.example.test/api/webhooks/sendgrid/events'
    )
    expect(new SendGridClient().generateWebhookUrls()).toEqual({})
  })
})
