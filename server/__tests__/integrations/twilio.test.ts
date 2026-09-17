import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { TwilioClient } from '../../integrations/twilio/client'
import { TwilioSMS, createTwilioSMS } from '../../integrations/twilio/sms'
import { TwilioVoice, createTwilioVoice } from '../../integrations/twilio/voice'

const transport = vi.fn<typeof fetch>()
const settings = { accountSid: 'ACtest', authToken: 'test-only-token', phoneNumber: '+12025550100' }
const timestamp = 'Wed, 16 Sep 2026 12:00:00 +0000'
const client = (callbacks = false) =>
  new TwilioClient({
    ...settings,
    webhookBaseUrl: callbacks ? 'https://app.example.test' : undefined
  })
const respond = (data: unknown, status = 200) =>
  transport.mockResolvedValueOnce(
    new Response(data === undefined ? null : JSON.stringify(data), { status })
  )
const form = () => new URLSearchParams(String(transport.mock.calls.at(-1)?.[1]?.body))

beforeEach(() => {
  transport.mockReset()
  vi.stubGlobal('fetch', transport)
  for (const name of [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'TWILIO_WEBHOOK_BASE_URL'
  ])
    vi.stubEnv(name, undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Twilio transport', () => {
  it('requires credentials, and initialization never performs delivery', async () => {
    const c = new TwilioClient()
    await c.initialize()
    await c.initialize()
    expect(await c.request('GET', '/Messages.json')).toMatchObject({
      success: false,
      error: { code: 401 }
    })
    expect(transport).not.toHaveBeenCalled()
    const configured = client()
    await configured.initialize()
    expect(configured.getAccountSid()).toBe(settings.accountSid)
    expect(configured.getPhoneNumber()).toBe(settings.phoneNumber)
    expect(configured.getWebhookBaseUrl()).toBeUndefined()
  })
  it('encodes repeated values, retains zero, and omits missing values', async () => {
    respond({ sid: 'SMtest' })
    expect(
      await client().request('POST', '/Messages.json', {
        Body: 'a & b',
        MediaUrl: ['https://a.test', undefined, null, 'https://b.test'],
        Count: 0,
        Missing: undefined,
        Null: null
      })
    ).toEqual({ success: true, data: { sid: 'SMtest' } })
    expect(form().get('Body')).toBe('a & b')
    expect(form().getAll('MediaUrl')).toEqual(['https://a.test', 'https://b.test'])
    expect(form().get('Count')).toBe('0')
    expect(form().has('Missing')).toBe(false)
    expect(transport.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('ACtest:test-only-token').toString('base64')}`
    })
  })
  it('puts GET filters in the URL and keeps DELETE bodyless', async () => {
    respond({ messages: [] })
    respond(undefined, 204)
    await client().request('GET', '/Messages.json', { To: '+12025550101' })
    expect(new URL(String(transport.mock.calls[0][0])).searchParams.get('To')).toBe('+12025550101')
    expect(transport.mock.calls[0][1]?.body).toBeUndefined()
    expect(await client().request('DELETE', '/Messages/SMtest.json', { ignored: true })).toEqual({
      success: true,
      data: {}
    })
    expect(transport.mock.calls[1][1]?.body).toBeUndefined()
  })
  it.each([
    ['{"message":"Denied"}', 'Denied'],
    ['bad gateway', 'bad gateway'],
    ['', 'Twilio request failed with status 503']
  ])('preserves provider failure %s', async (body, message) => {
    transport.mockResolvedValueOnce(new Response(body, { status: 503 }))
    expect(await client().request('GET', '/Messages.json')).toEqual({
      success: false,
      error: { code: 503, message }
    })
  })
  it.each([
    ['(202) 555-0101', '+12025550101'],
    ['12025550101', '+12025550101'],
    ['442071234567', '+442071234567']
  ])('normalizes destination %s', (input, formatted) => {
    expect(client().validatePhoneNumber(input)).toEqual({ valid: true, formatted })
  })
  it('rejects short destinations', () =>
    expect(client().validatePhoneNumber('123')).toEqual({ valid: false, formatted: '123' }))
})

describe('SMS acknowledgements and control', () => {
  it('uses provider dates and forwards media, scheduling, and callbacks', async () => {
    respond({ sid: 'SMtest', status: 'scheduled', date_created: timestamp })
    const result = await createTwilioSMS(client(true)).send({
      to: '2025550101',
      from: '+12025550102',
      body: 'Test only',
      mediaUrls: ['https://files.example.test/file'],
      scheduleSendTime: new Date('2026-09-18T12:00:00Z'),
      statusCallback: 'https://app.example.test/custom'
    })
    expect(result).toEqual({ messageSid: 'SMtest', status: 'scheduled', dateCreated: timestamp })
    expect(form().get('SendAt')).toBe('2026-09-18T12:00:00.000Z')
    expect(form().get('ScheduleType')).toBe('fixed')
    expect(form().get('StatusCallback')).toBe('https://app.example.test/custom')
    expect(form().get('From')).toBe('+12025550102')
    expect(form().get('MediaUrl')).toBe('https://files.example.test/file')
  })
  it.each([false, true])(
    'sends a minimal message with configured callbacks=%s',
    async (callbacks) => {
      respond({ sid: 'SMtest', status: 'queued', date_created: timestamp })
      await new TwilioSMS(client(callbacks)).send({ to: '2025550101', body: 'Test only' })
      expect(form().get('From')).toBe(settings.phoneNumber)
      expect(form().has('StatusCallback')).toBe(callbacks)
      expect(form().has('SendAt')).toBe(false)
    }
  )
  it('rejects invalid destinations before transport', async () => {
    await expect(createTwilioSMS(client()).send({ to: 'bad', body: 'Test only' })).rejects.toThrow(
      'Invalid phone'
    )
    expect(transport).not.toHaveBeenCalled()
  })
  it('rejects provider errors and malformed success rather than inventing acknowledgements', async () => {
    respond({ message: 'Rejected' }, 400)
    respond({})
    const sms = createTwilioSMS(client())
    await expect(sms.send({ to: '2025550101', body: 'Test only' })).rejects.toThrow('Rejected')
    await expect(sms.send({ to: '2025550101', body: 'Test only' })).rejects.toThrow()
    await expect(createTwilioSMS().send({ to: '2025550101', body: 'Test only' })).rejects.toThrow(
      'not configured'
    )
  })
  it('returns cancellation acknowledgement and reports missing messages', async () => {
    respond({})
    respond({ message: 'missing' }, 404)
    const sms = createTwilioSMS(client())
    expect(await sms.cancelScheduledMessage('SMtest')).toBe(true)
    expect(form().get('Status')).toBe('canceled')
    expect(await sms.getMessage('SMmissing')).toBeNull()
  })
  it('escapes all XML delimiters and permits empty replies', () => {
    const sms = createTwilioSMS()
    expect(sms.generateTwiMLResponse()).toContain('<Response></Response>')
    expect(sms.generateTwiMLResponse(`<a x="'">&`)).toContain('&lt;a x=&quot;&apos;&quot;&gt;&amp;')
    expect(sms.parseWebhookPayload({ MessageSid: 'SMtest', MessageStatus: 'received' }).Body).toBe(
      ''
    )
    expect(sms.parseWebhookPayload({ Body: 'kept', MessageStatus: 'received' }).Body).toBe('kept')
  })
})

describe('voice acknowledgements and instructions', () => {
  it.each([undefined, 'https://app.example.test/twiml'])(
    'uses configured callbacks and explicit TwiML URL %s',
    async (twimlUrl) => {
      respond({ sid: 'CAtest', status: 'queued', date_created: timestamp })
      const result = await createTwilioVoice(client(true)).initiateCall({
        to: '2025550101',
        from: '+12025550102',
        twimlUrl,
        record: true,
        timeout: 45,
        machineDetection: 'Enable',
        statusCallback: 'https://app.example.test/status',
        recordingStatusCallback: 'https://app.example.test/recording'
      })
      expect(result).toEqual({ callSid: 'CAtest', status: 'queued', dateCreated: timestamp })
      expect(form().get('Url')).toBe(
        twimlUrl ?? 'https://app.example.test/api/webhooks/twilio/voice/twiml'
      )
      expect(form().get('Record')).toBe('true')
      expect(form().get('Timeout')).toBe('45')
      expect(form().get('MachineDetection')).toBe('Enable')
      expect(form().getAll('StatusCallbackEvent')).toEqual([
        'initiated',
        'ringing',
        'answered',
        'completed'
      ])
      expect(form().get('RecordingStatusCallback')).toBe('https://app.example.test/recording')
      expect(form().get('FallbackUrl')).toContain('/voice/fallback')
    }
  )
  it.each([undefined, 'A <script> & text'])(
    'uses inline instructions when no callback is configured',
    async (callScript) => {
      respond({ sid: 'CAtest', status: 'queued', date_created: timestamp })
      await createTwilioVoice(client()).initiateCall({ to: '2025550101', callScript, record: true })
      expect(form().get('Twiml')).toContain(
        callScript ? 'A &lt;script&gt; &amp; text' : 'Hello, this is an automated call.'
      )
      expect(form().has('RecordingStatusCallback')).toBe(false)
      expect(form().get('Timeout')).toBe('30')
    }
  )
  it('fails invalid destinations and failed or malformed provider results', async () => {
    const voice = createTwilioVoice(client())
    await expect(voice.initiateCall({ to: 'bad' })).rejects.toThrow('Invalid phone')
    respond({ message: 'Denied' }, 403)
    respond({})
    await expect(voice.initiateCall({ to: '2025550101' })).rejects.toThrow('Denied')
    await expect(voice.initiateCall({ to: '2025550101' })).rejects.toThrow()
  })
  it('forwards call updates and end requests; failed retrieval is not a call record', async () => {
    respond({})
    respond({})
    respond({ message: 'missing' }, 404)
    const voice = createTwilioVoice(client())
    expect(
      await voice.updateCall('CAtest', {
        twiml: '<Response/>',
        url: 'https://app.example.test/next'
      })
    ).toBe(true)
    expect(form().get('Twiml')).toBe('<Response/>')
    expect(form().get('Url')).toBe('https://app.example.test/next')
    expect(await voice.endCall('CAtest')).toBe(true)
    expect(form().get('Status')).toBe('completed')
    expect(await voice.getCall('missing')).toBeNull()
  })
  it('escapes every TwiML attribute and element body', () => {
    const voice = createTwilioVoice()
    const attack = `"><Injected a='&'>`
    const xml = voice.generateTwiML([
      { say: { text: attack, voice: attack, language: attack } },
      { play: { url: attack, loop: 2 } },
      {
        gather: {
          input: 'dtmf speech',
          action: attack,
          method: 'POST',
          timeout: 2,
          numDigits: 1,
          finishOnKey: attack,
          speechTimeout: 2,
          hints: attack
        }
      },
      {
        dial: {
          number: attack,
          callerId: attack,
          timeout: 4,
          action: attack,
          record: 'record-from-answer'
        }
      },
      {
        record: {
          action: attack,
          method: 'POST',
          timeout: 3,
          maxLength: 10,
          transcribe: false,
          transcribeCallback: attack,
          playBeep: false
        }
      },
      { pause: { length: 2 } },
      { redirect: { url: attack, method: 'GET' } },
      { hangup: true }
    ])
    expect(xml).not.toContain('<Injected')
    expect(xml).toContain('&quot;&gt;&lt;Injected a=&apos;&amp;&apos;&gt;')
    expect(xml).toContain('transcribe="false"')
    expect(xml).toContain('playBeep="false"')
    expect(xml).toContain('<Hangup/>')
    const minimal = voice.generateTwiML([
      {
        say: { text: 'test' },
        play: { url: 'https://audio.example.test' },
        gather: {},
        dial: { number: '+12025550101' },
        record: {},
        pause: {},
        redirect: { url: 'https://app.example.test' }
      }
    ])
    expect(minimal).toContain('<Pause length="1"/>')
    expect(minimal).toContain('<Gather></Gather>')
    expect(minimal).toContain('<Record/>')
    expect(
      voice.generateBrokerCallScript({
        greeting: 'test',
        companyName: attack,
        brokerName: attack,
        callbackNumber: '+12025550101'
      })
    ).not.toContain('<Injected')
    expect(
      voice.parseWebhookPayload({ CallSid: 'CAtest', CallStatus: 'completed' }).CallStatus
    ).toBe('completed')
  })
})

describe.each(['sms', 'voice'] as const)('%s signature validation', (kind) => {
  it('rejects missing credentials and signatures and binds the URL and sorted body', () => {
    const adapter = kind === 'sms' ? new TwilioSMS(client()) : new TwilioVoice(client())
    const empty = kind === 'sms' ? createTwilioSMS() : createTwilioVoice()
    const url = 'https://app.example.test/webhook'
    const params = { Z: 'last', A: 'first' }
    const signature = createHmac('sha1', settings.authToken)
      .update(url + 'AfirstZlast')
      .digest('base64')
    expect(adapter.validateWebhookSignature(signature, url, params)).toBe(true)
    expect(adapter.validateWebhookSignature(signature, url + '/forged', params)).toBe(false)
    expect(adapter.validateWebhookSignature(signature, url, { ...params, A: 'changed' })).toBe(
      false
    )
    expect(adapter.validateWebhookSignature('short', url, params)).toBe(false)
    expect(adapter.validateWebhookSignature('', url, params)).toBe(false)
    expect(empty.validateWebhookSignature(signature, url, params)).toBe(false)
  })
})
