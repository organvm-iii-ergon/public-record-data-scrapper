import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SendGridClient } from '../../integrations/sendgrid/client'
import { createSendGridSend } from '../../integrations/sendgrid/send'

const transport = vi.fn<typeof fetch>()
const sender = (sandboxMode = false) =>
  createSendGridSend(
    new SendGridClient({
      apiKey: 'test-key',
      fromEmail: 'sender@example.test',
      fromName: 'Sender',
      sandboxMode
    })
  )
const accept = () =>
  transport.mockResolvedValueOnce(
    new Response(null, { status: 202, headers: { 'x-message-id': 'provider-id' } })
  )
const sent = () => JSON.parse(String(transport.mock.calls.at(-1)?.[1]?.body))
beforeEach(() => {
  transport.mockReset()
  vi.stubGlobal('fetch', transport)
  vi.stubEnv('SENDGRID_API_KEY', '')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('SendGrid message contracts', () => {
  it.each([
    'recipient@example.test',
    ['recipient@example.test'],
    { email: 'recipient@example.test', name: 'Recipient' },
    [{ email: 'recipient@example.test', name: 'Recipient' }]
  ])('normalizes supported recipient form %j', async (to) => {
    accept()
    expect(await sender().sendTransactional({ to, subject: 'test', text: 'plain' })).toEqual({
      messageId: 'provider-id',
      status: 'accepted'
    })
    expect(sent().personalizations[0].to[0].email).toBe('recipient@example.test')
    expect(sent().content).toEqual([{ type: 'text/plain', value: 'plain' }])
  })
  it('forwards multipart content, attachments, scheduling and explicit tracking settings', async () => {
    accept()
    await sender(true).sendTransactional({
      to: 'r@example.test',
      cc: 'cc@example.test',
      bcc: [{ email: 'bcc@example.test' }],
      from: { email: 'f@example.test', name: 'From' },
      replyTo: { email: 'reply@example.test' },
      subject: 'test',
      text: 'plain',
      html: '<p>html</p>',
      sendAt: new Date('2026-09-17T12:00:00Z'),
      categories: ['test'],
      customArgs: { tenant: 'test-tenant' },
      trackingSettings: { clickTracking: false, openTracking: false, subscriptionTracking: true },
      attachments: [
        { name: 'test.txt', content: 'dGVzdA==', mimeType: 'text/plain' },
        { name: 'second.txt', content: 'dHdv', type: 'text/plain' },
        { name: 'empty.txt' }
      ]
    })
    const data = sent()
    expect(data.personalizations[0].cc).toEqual([{ email: 'cc@example.test' }])
    expect(data.personalizations[0].bcc).toEqual([{ email: 'bcc@example.test' }])
    expect(data.content).toHaveLength(2)
    expect(data.attachments).toEqual([
      { content: 'dGVzdA==', filename: 'test.txt', type: 'text/plain', disposition: 'attachment' },
      { content: 'dHdv', filename: 'second.txt', type: 'text/plain', disposition: 'attachment' }
    ])
    expect(data.tracking_settings).toEqual({
      click_tracking: { enable: false },
      open_tracking: { enable: false },
      subscription_tracking: { enable: true }
    })
    expect(data.mail_settings).toEqual({ sandbox_mode: { enable: true } })
    expect(data.send_at).toBe(Math.floor(new Date('2026-09-17T12:00:00Z').getTime() / 1000))
  })
  it('honors HTML-only content and enabled tracking without subscription tracking', async () => {
    accept()
    await sender().sendTransactional({
      to: 'r@example.test',
      subject: 'test',
      html: '<b>hello</b>',
      trackingSettings: {}
    })
    expect(sent().content).toEqual([{ type: 'text/html', value: '<b>hello</b>' }])
    expect(sent().tracking_settings).toEqual({
      click_tracking: { enable: true },
      open_tracking: { enable: true }
    })
  })
  it('rejects missing recipients and content before contacting the provider', async () => {
    await expect(
      sender().sendTransactional({ to: [], subject: 'test', text: 'test' })
    ).rejects.toThrow('recipient')
    await expect(
      sender().sendTransactional({ to: 'r@example.test', subject: 'test' })
    ).rejects.toThrow('content')
    await expect(sender().sendTemplate({ to: [], templateId: 'd-test' })).rejects.toThrow(
      'recipient'
    )
    await expect(sender().sendBulk({ personalizations: [] })).rejects.toThrow('personalization')
    await expect(
      sender().sendBulk({
        personalizations: Array.from({ length: 1001 }, () => ({
          to: [{ email: 'r@example.test' }]
        }))
      })
    ).rejects.toThrow('1000')
    expect(transport).not.toHaveBeenCalled()
  })
  it.each([false, true])(
    'sends templates with sandbox=%s and explicit personalization',
    async (sandbox) => {
      accept()
      await sender(sandbox).sendTemplate({
        to: ['r@example.test'],
        templateId: 'd-test',
        ...(sandbox
          ? {
              cc: ['cc@example.test'],
              bcc: 'bcc@example.test',
              attachments: [{ name: 'x', content: 'eA==' }],
              sendAt: new Date('2026-09-17T12:00:00Z')
            }
          : {}),
        dynamicTemplateData: { value: 5 }
      })
      expect(sent().template_id).toBe('d-test')
      expect(sent().personalizations[0].dynamic_template_data).toEqual({ value: 5 })
      expect(Boolean(sent().mail_settings)).toBe(sandbox)
    }
  )
  it.each([false, true])('sends bulk mail with template=%s', async (template) => {
    accept()
    await sender(template).sendBulk({
      personalizations: [{ to: [{ email: 'r@example.test' }], subject: 'specific' }],
      ...(template ? { templateId: 'd-test' } : { text: 'plain', html: '<p>test</p>' })
    })
    expect(sent().personalizations[0].subject).toBe('specific')
    expect(Boolean(sent().content)).toBe(!template)
    expect(Boolean(sent().template_id)).toBe(template)
  })
  it.each(['transactional', 'template', 'bulk'] as const)(
    'reports provider rejection for %s',
    async (type) => {
      transport.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ message: 'Denied' }] }), { status: 403 })
      )
      const s = sender()
      const result =
        type === 'transactional'
          ? await s.sendTransactional({ to: 'r@example.test', subject: 'test', text: 'test' })
          : type === 'template'
            ? await s.sendTemplate({ to: 'r@example.test', templateId: 'd-test' })
            : await s.sendBulk({
                personalizations: [{ to: [{ email: 'r@example.test' }] }],
                text: 'test'
              })
      expect(result).toEqual({ messageId: '', status: 'failed', errors: ['Denied'] })
    }
  )
  it('rejects unimplemented adapter signature verification, never claiming authenticity', () => {
    expect(createSendGridSend().validateWebhookSignature('signature', 'time', '{}', 'key')).toBe(
      false
    )
    expect(sender().parseWebhookEvents({})).toEqual([])
    expect(
      sender().parseWebhookEvents([
        {
          email: 'r@example.test',
          timestamp: 123,
          event: 'delivered',
          sg_event_id: 'event',
          sg_message_id: 'message'
        }
      ])
    ).toEqual([expect.objectContaining({ event: 'delivered', sg_event_id: 'event' })])
  })
})
