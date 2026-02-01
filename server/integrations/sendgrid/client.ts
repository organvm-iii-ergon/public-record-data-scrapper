/**
 * SendGrid Client
 *
 * Base client for SendGrid API authentication and configuration.
 * Provides the foundation for email sending operations.
 *
 * Environment variables required:
 * - SENDGRID_API_KEY: SendGrid API key
 * - SENDGRID_FROM_EMAIL: Default sender email address
 * - SENDGRID_FROM_NAME: Default sender name
 */

export interface SendGridConfig {
  apiKey: string
  fromEmail: string
  fromName: string
  webhookBaseUrl?: string
  sandboxMode?: boolean
}

export interface SendGridResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: number
    message: string
    errors?: Array<{ message: string; field?: string }>
  }
}

/**
 * SendGridClient provides authenticated access to SendGrid APIs.
 *
 * This is a stub implementation that returns mock responses.
 * In production, this would use the official SendGrid SDK:
 * import sgMail from '@sendgrid/mail'
 */
export class SendGridClient {
  private config: SendGridConfig
  private initialized: boolean = false

  constructor(customConfig?: Partial<SendGridConfig>) {
    this.config = {
      apiKey: customConfig?.apiKey || process.env.SENDGRID_API_KEY || '',
      fromEmail: customConfig?.fromEmail || process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
      fromName: customConfig?.fromName || process.env.SENDGRID_FROM_NAME || 'MCA Platform',
      webhookBaseUrl: customConfig?.webhookBaseUrl || process.env.SENDGRID_WEBHOOK_BASE_URL,
      sandboxMode: customConfig?.sandboxMode ?? (process.env.NODE_ENV !== 'production')
    }
  }

  /**
   * Initialize the SendGrid client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Validate configuration
    if (!this.config.apiKey) {
      console.warn('[SendGridClient] Missing API key - running in stub mode')
    }

    this.initialized = true
    console.log('[SendGridClient] Initialized', {
      fromEmail: this.config.fromEmail,
      sandboxMode: this.config.sandboxMode
    })
  }

  /**
   * Check if client is configured with valid credentials
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.fromEmail)
  }

  /**
   * Get the default sender email
   */
  getFromEmail(): string {
    return this.config.fromEmail
  }

  /**
   * Get the default sender name
   */
  getFromName(): string {
    return this.config.fromName
  }

  /**
   * Check if running in sandbox mode
   */
  isSandboxMode(): boolean {
    return this.config.sandboxMode ?? false
  }

  /**
   * Get webhook base URL
   */
  getWebhookBaseUrl(): string | undefined {
    return this.config.webhookBaseUrl
  }

  /**
   * Make an authenticated request to SendGrid API
   *
   * STUB: This method simulates API calls. In production, use the SendGrid SDK.
   */
  async request<T>(
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<SendGridResponse<T>> {
    if (!this.isConfigured()) {
      // Return stub response when not configured
      console.log(`[SendGridClient] STUB ${method} ${endpoint}`, data)

      return {
        success: true,
        data: this.generateStubResponse<T>(endpoint, data)
      }
    }

    // In production, this would make actual API calls:
    /*
    const client = require('@sendgrid/client')
    client.setApiKey(this.config.apiKey)
    // ... make actual API call
    */

    // For now, return stub response
    console.log(`[SendGridClient] ${method} ${endpoint}`, data)

    return {
      success: true,
      data: this.generateStubResponse<T>(endpoint, data)
    }
  }

  /**
   * Generate stub responses for testing/development
   */
  private generateStubResponse<T>(endpoint: string, data?: Record<string, unknown>): T {
    const messageId = this.generateMessageId()

    if (endpoint.includes('/mail/send')) {
      return {
        messageId,
        status: 'accepted'
      } as T
    }

    if (endpoint.includes('/templates')) {
      return {
        id: `d-${this.generateId()}`,
        name: data?.name || 'Template',
        generation: 'dynamic',
        versions: []
      } as T
    }

    if (endpoint.includes('/suppression')) {
      return {
        suppressed: false
      } as T
    }

    // Default stub response
    return { messageId } as T
  }

  /**
   * Generate a SendGrid-style message ID
   */
  private generateMessageId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = ''
    for (let i = 0; i < 22; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `${id}@sendgrid.net`
  }

  /**
   * Generate a random ID
   */
  private generateId(): string {
    const chars = 'abcdef0123456789'
    let id = ''
    for (let i = 0; i < 36; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
  }

  /**
   * Validate an email address format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Build sender information
   */
  buildSender(from?: { email?: string; name?: string }): { email: string; name: string } {
    return {
      email: from?.email || this.config.fromEmail,
      name: from?.name || this.config.fromName
    }
  }

  /**
   * Generate webhook event URLs
   */
  generateWebhookUrls(): {
    eventWebhook?: string
    bounceWebhook?: string
    unsubscribeWebhook?: string
  } {
    const baseUrl = this.config.webhookBaseUrl
    if (!baseUrl) return {}

    return {
      eventWebhook: `${baseUrl}/api/webhooks/sendgrid/events`,
      bounceWebhook: `${baseUrl}/api/webhooks/sendgrid/bounce`,
      unsubscribeWebhook: `${baseUrl}/api/webhooks/sendgrid/unsubscribe`
    }
  }
}

// Export singleton instance
export const sendgridClient = new SendGridClient()
