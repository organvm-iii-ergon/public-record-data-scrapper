export function isSecureWebhookUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
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
    api_key_preview: maskCredential(apiKey, 4),
    config: parsedConfig
  }
}
