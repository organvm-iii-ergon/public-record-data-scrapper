type DnsAnswer = { type?: number; data?: string }

function isPrivateIp(value: string): boolean {
  const normalized = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
  const ip = normalized.toLowerCase().split('%')[0] ?? ''
  if (ip.includes(':')) {
    return (
      ip === '::' ||
      ip === '::1' ||
      ip.startsWith('fc') ||
      ip.startsWith('fd') ||
      /^fe[89ab]/.test(ip) ||
      ip.startsWith('2001:db8:') ||
      ip.startsWith('::ffff:127.') ||
      ip.startsWith('::ffff:10.') ||
      ip.startsWith('::ffff:192.168.')
    )
  }
  const octets = ip.split('.').map(Number)
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true
  }
  const [a, b] = octets as [number, number, number, number]
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (octets[2] === 0 || octets[2] === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && octets[2] === 100) ||
    (a === 203 && b === 0 && octets[2] === 113) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

export async function isSecureWebhookUrl(
  value: string,
  resolver: typeof fetch = fetch
): Promise<boolean> {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    if (
      url.protocol !== 'https:' ||
      !hostname ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    )
      return false
    if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return !isPrivateIp(hostname)

    const lookups = await Promise.all(
      ['A', 'AAAA'].map(async (type) => {
        const response = await resolver(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
          {
            headers: { Accept: 'application/dns-json' },
            redirect: 'error',
            signal: AbortSignal.timeout(3000)
          }
        )
        if (!response.ok) throw new Error('DNS resolution failed')
        const payload = (await response.json()) as { Answer?: DnsAnswer[] }
        return (payload.Answer ?? []).filter((answer) => answer.type === 1 || answer.type === 28)
      })
    )
    const answers = lookups.flat()
    return (
      answers.length > 0 &&
      answers.every((answer) => typeof answer.data === 'string' && !isPrivateIp(answer.data))
    )
  } catch {
    return false
  }
}

const CREDENTIAL_PREFIX = 'enc:v1:'

function decodeKey(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytes.byteLength !== 32)
    throw new Error('CRM credential encryption key must contain 32 bytes')
  return bytes
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 =
    value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

export async function encryptCredential(
  plaintext: string,
  encodedKey: string | undefined
): Promise<string> {
  if (!encodedKey) throw new Error('CRM credential encryption is unavailable')
  const key = await crypto.subtle.importKey('raw', decodeKey(encodedKey), 'AES-GCM', false, [
    'encrypt'
  ])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  )
  return `${CREDENTIAL_PREFIX}${base64Url(iv)}:${base64Url(ciphertext)}`
}

export async function decryptCredential(
  envelope: string,
  encodedKey: string | undefined
): Promise<string> {
  if (!encodedKey || !envelope.startsWith(CREDENTIAL_PREFIX))
    throw new Error('CRM credential is unavailable; reconnect the integration')
  const [ivValue, ciphertextValue] = envelope.slice(CREDENTIAL_PREFIX.length).split(':')
  if (!ivValue || !ciphertextValue) throw new Error('CRM credential envelope is invalid')
  const key = await crypto.subtle.importKey('raw', decodeKey(encodedKey), 'AES-GCM', false, [
    'decrypt'
  ])
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivValue) },
    key,
    fromBase64Url(ciphertextValue)
  )
  return new TextDecoder().decode(plaintext)
}

function maskCredential(value: string, prefixLength: number): string {
  return value.length > 8 ? `${value.slice(0, prefixLength)}••••${value.slice(-4)}` : '••••••••'
}

export function publicWebhookEndpoint<T extends { secret: string; events: string }>(
  endpoint: T
): Omit<T, 'secret' | 'events'> & { events: unknown[]; secret_preview: string } {
  const { secret, events, ...publicEndpoint } = endpoint
  let parsedEvents: unknown[]
  try {
    const parsed = JSON.parse(events) as unknown
    parsedEvents = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    parsedEvents = [events]
  }

  return {
    ...publicEndpoint,
    events: parsedEvents,
    secret_preview: maskCredential(secret, 6)
  }
}

export function publicCrmIntegration<T extends { api_key: string; config: string | null }>(
  integration: T
): Omit<T, 'api_key' | 'config'> & { api_key_preview: string; config: Record<string, unknown> } {
  const { api_key: apiKey, config, ...publicIntegration } = integration
  let parsedConfig: Record<string, unknown> = {}
  try {
    const parsed = config ? (JSON.parse(config) as unknown) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsedConfig = parsed as Record<string, unknown>
    }
  } catch {
    // Malformed stored configuration remains private and is represented as empty.
  }

  return {
    ...publicIntegration,
    api_key_preview: apiKey.startsWith(CREDENTIAL_PREFIX)
      ? 'encrypted••••'
      : 'credential unavailable',
    config: parsedConfig
  }
}
