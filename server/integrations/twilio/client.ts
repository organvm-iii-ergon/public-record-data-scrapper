/**
 * Twilio Client
 *
 * Base client for Twilio API authentication and configuration.
 * Provides the foundation for SMS and Voice integrations.
 *
 * Environment variables required:
 * - TWILIO_ACCOUNT_SID: Twilio account SID
 * - TWILIO_AUTH_TOKEN: Twilio auth token
 * - TWILIO_PHONE_NUMBER: Default outbound phone number
 */

import { config } from '../../config'

export interface TwilioConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  webhookBaseUrl?: string
}

export interface TwilioResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: number
    message: string
  }
}

/**
 * TwilioClient provides authenticated access to Twilio APIs.
 *
 * This is a stub implementation that returns mock responses.
 * In production, this would use the official Twilio SDK:
 * import twilio from 'twilio'
 */
export class TwilioClient {
  private config: TwilioConfig
  private initialized: boolean = false

  constructor(customConfig?: Partial<TwilioConfig>) {
    this.config = {
      accountSid: customConfig?.accountSid || process.env.TWILIO_ACCOUNT_SID || '',
      authToken: customConfig?.authToken || process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: customConfig?.phoneNumber || process.env.TWILIO_PHONE_NUMBER || '',
      webhookBaseUrl: customConfig?.webhookBaseUrl || process.env.TWILIO_WEBHOOK_BASE_URL
    }
  }

  /**
   * Initialize the Twilio client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Validate configuration
    if (!this.config.accountSid || !this.config.authToken) {
      console.warn('[TwilioClient] Missing credentials - running in stub mode')
    }

    this.initialized = true
    console.log('[TwilioClient] Initialized')
  }

  /**
   * Check if client is configured with valid credentials
   */
  isConfigured(): boolean {
    return !!(this.config.accountSid && this.config.authToken && this.config.phoneNumber)
  }

  /**
   * Get the configured outbound phone number
   */
  getPhoneNumber(): string {
    return this.config.phoneNumber
  }

  /**
   * Get the webhook base URL
   */
  getWebhookBaseUrl(): string | undefined {
    return this.config.webhookBaseUrl
  }

  /**
   * Get account SID (for API calls)
   */
  getAccountSid(): string {
    return this.config.accountSid
  }

  /**
   * Make an authenticated request to Twilio API
   *
   * STUB: This method simulates API calls. In production, use the Twilio SDK.
   */
  async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<TwilioResponse<T>> {
    if (!this.isConfigured()) {
      // Return stub response when not configured
      console.log(`[TwilioClient] STUB ${method} ${endpoint}`, data)

      return {
        success: true,
        data: this.generateStubResponse<T>(endpoint, data)
      }
    }

    // In production, this would make actual API calls:
    /*
    const client = twilio(this.config.accountSid, this.config.authToken)
    // ... make actual API call
    */

    // For now, return stub response
    console.log(`[TwilioClient] ${method} ${endpoint}`, data)

    return {
      success: true,
      data: this.generateStubResponse<T>(endpoint, data)
    }
  }

  /**
   * Generate stub responses for testing/development
   */
  private generateStubResponse<T>(endpoint: string, data?: Record<string, unknown>): T {
    const sid = this.generateSid()

    if (endpoint.includes('Messages')) {
      return {
        sid,
        accountSid: this.config.accountSid,
        to: data?.to,
        from: this.config.phoneNumber,
        body: data?.body,
        status: 'queued',
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
        direction: 'outbound-api',
        errorCode: null,
        errorMessage: null,
        numSegments: '1',
        price: null,
        priceUnit: 'USD'
      } as T
    }

    if (endpoint.includes('Calls')) {
      return {
        sid,
        accountSid: this.config.accountSid,
        to: data?.to,
        from: this.config.phoneNumber,
        status: 'queued',
        dateCreated: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
        direction: 'outbound-api',
        duration: null,
        startTime: null,
        endTime: null,
        answeredBy: null,
        forwardedFrom: null
      } as T
    }

    // Default stub response
    return { sid } as T
  }

  /**
   * Generate a Twilio-style SID
   */
  private generateSid(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let sid = 'SM' // Message SID prefix
    for (let i = 0; i < 32; i++) {
      sid += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return sid
  }

  /**
   * Validate a phone number format
   */
  validatePhoneNumber(phone: string): { valid: boolean; formatted: string } {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')

    // Check for valid US phone number (10 or 11 digits)
    if (digits.length === 10) {
      return {
        valid: true,
        formatted: `+1${digits}`
      }
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return {
        valid: true,
        formatted: `+${digits}`
      }
    }

    // International format (assume E.164)
    if (digits.length > 10) {
      return {
        valid: true,
        formatted: `+${digits}`
      }
    }

    return {
      valid: false,
      formatted: phone
    }
  }

  /**
   * Generate webhook URLs for callbacks
   */
  generateWebhookUrls(type: 'sms' | 'voice'): {
    statusCallback?: string
    voiceUrl?: string
    fallbackUrl?: string
  } {
    const baseUrl = this.config.webhookBaseUrl
    if (!baseUrl) return {}

    if (type === 'sms') {
      return {
        statusCallback: `${baseUrl}/api/webhooks/twilio/sms/status`
      }
    }

    if (type === 'voice') {
      return {
        voiceUrl: `${baseUrl}/api/webhooks/twilio/voice/twiml`,
        statusCallback: `${baseUrl}/api/webhooks/twilio/voice/status`,
        fallbackUrl: `${baseUrl}/api/webhooks/twilio/voice/fallback`
      }
    }

    return {}
  }
}

// Export singleton instance
export const twilioClient = new TwilioClient()
