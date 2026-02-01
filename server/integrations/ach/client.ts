/**
 * ACH Client
 *
 * Stub for Actum/ACH Works integration providing ACH payment processing.
 * Supports debit/credit transactions, status checking, and account validation.
 *
 * Environment variables required:
 * - ACH_API_KEY: API key for ACH provider
 * - ACH_MERCHANT_ID: Merchant identifier
 * - ACH_ENVIRONMENT: 'sandbox' or 'production'
 */

export interface ACHConfig {
  apiKey: string
  merchantId: string
  environment: 'sandbox' | 'production'
  webhookBaseUrl?: string
}

export type ACHStatus = 'pending' | 'processing' | 'completed' | 'returned' | 'failed'

export interface ACHResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface ACHTransaction {
  transactionId: string
  type: 'debit' | 'credit'
  amount: number
  accountId: string
  status: ACHStatus
  createdAt: string
  updatedAt: string
}

/**
 * ACHClient provides access to ACH payment processing APIs.
 *
 * This is a stub implementation that returns mock responses.
 * In production, this would integrate with Actum, ACH Works, or similar provider.
 */
export class ACHClient {
  private config: ACHConfig
  private initialized: boolean = false

  constructor(customConfig?: Partial<ACHConfig>) {
    this.config = {
      apiKey: customConfig?.apiKey || process.env.ACH_API_KEY || '',
      merchantId: customConfig?.merchantId || process.env.ACH_MERCHANT_ID || '',
      environment: (customConfig?.environment || process.env.ACH_ENVIRONMENT || 'sandbox') as
        | 'sandbox'
        | 'production',
      webhookBaseUrl: customConfig?.webhookBaseUrl || process.env.ACH_WEBHOOK_BASE_URL
    }
  }

  /**
   * Initialize the ACH client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (!this.config.apiKey || !this.config.merchantId) {
      console.warn('[ACHClient] Missing credentials - running in stub mode')
    }

    this.initialized = true
    console.log('[ACHClient] Initialized', {
      environment: this.config.environment,
      merchantId: this.config.merchantId ? '***' : 'not set'
    })
  }

  /**
   * Check if client is configured with valid credentials
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.merchantId)
  }

  /**
   * Get the current environment
   */
  getEnvironment(): 'sandbox' | 'production' {
    return this.config.environment
  }

  /**
   * Get the merchant ID
   */
  getMerchantId(): string {
    return this.config.merchantId
  }

  /**
   * Get webhook base URL
   */
  getWebhookBaseUrl(): string | undefined {
    return this.config.webhookBaseUrl
  }

  /**
   * Initiate an ACH debit (pull funds from account)
   *
   * @param amount - Amount in cents
   * @param accountId - Bank account identifier
   * @returns Transaction ID
   */
  async initiateDebit(amount: number, accountId: string): Promise<string> {
    const transactionId = this.generateTransactionId('DBT')

    if (!this.isConfigured()) {
      console.log(`[ACHClient] STUB initiateDebit`, { amount, accountId, transactionId })
      return transactionId
    }

    // In production, this would make actual API calls:
    /*
    const response = await fetch(`${this.baseUrl}/transactions/debit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ amount, accountId, merchantId: this.config.merchantId })
    })
    */

    console.log(`[ACHClient] initiateDebit`, { amount, accountId, transactionId })
    return transactionId
  }

  /**
   * Initiate an ACH credit (push funds to account)
   *
   * @param amount - Amount in cents
   * @param accountId - Bank account identifier
   * @returns Transaction ID
   */
  async initiateCredit(amount: number, accountId: string): Promise<string> {
    const transactionId = this.generateTransactionId('CRD')

    if (!this.isConfigured()) {
      console.log(`[ACHClient] STUB initiateCredit`, { amount, accountId, transactionId })
      return transactionId
    }

    // In production, this would make actual API calls
    console.log(`[ACHClient] initiateCredit`, { amount, accountId, transactionId })
    return transactionId
  }

  /**
   * Check the status of an ACH transaction
   *
   * @param transactionId - Transaction identifier
   * @returns Current transaction status
   */
  async checkStatus(transactionId: string): Promise<ACHStatus> {
    if (!this.isConfigured()) {
      console.log(`[ACHClient] STUB checkStatus`, { transactionId })
      // Return a realistic progression for stub mode
      return 'pending'
    }

    // In production, this would query the actual transaction status
    console.log(`[ACHClient] checkStatus`, { transactionId })
    return 'pending'
  }

  /**
   * Cancel a pending ACH transaction
   *
   * @param transactionId - Transaction identifier
   * @throws Error if transaction cannot be cancelled
   */
  async cancelTransaction(transactionId: string): Promise<void> {
    if (!this.isConfigured()) {
      console.log(`[ACHClient] STUB cancelTransaction`, { transactionId })
      return
    }

    // In production, this would attempt to cancel the transaction
    // Note: ACH transactions can only be cancelled before processing
    console.log(`[ACHClient] cancelTransaction`, { transactionId })
  }

  /**
   * Validate a bank account using routing and account numbers
   *
   * @param routingNumber - 9-digit ABA routing number
   * @param accountNumber - Bank account number
   * @returns Whether the account appears valid
   */
  async validateAccount(routingNumber: string, accountNumber: string): Promise<boolean> {
    // Basic validation even in stub mode
    if (!this.validateRoutingNumber(routingNumber)) {
      console.log(`[ACHClient] validateAccount - invalid routing number`, { routingNumber })
      return false
    }

    if (!accountNumber || accountNumber.length < 4 || accountNumber.length > 17) {
      console.log(`[ACHClient] validateAccount - invalid account number length`)
      return false
    }

    if (!this.isConfigured()) {
      console.log(`[ACHClient] STUB validateAccount`, {
        routingNumber: `${routingNumber.slice(0, 4)}***`,
        accountNumberLength: accountNumber.length
      })
      return true
    }

    // In production, this would use a micro-deposit or instant verification service
    console.log(`[ACHClient] validateAccount`, {
      routingNumber: `${routingNumber.slice(0, 4)}***`,
      accountNumberLength: accountNumber.length
    })
    return true
  }

  /**
   * Generate webhook URLs for ACH callbacks
   */
  generateWebhookUrls(): {
    statusWebhook?: string
    returnWebhook?: string
  } {
    const baseUrl = this.config.webhookBaseUrl
    if (!baseUrl) return {}

    return {
      statusWebhook: `${baseUrl}/api/webhooks/ach/status`,
      returnWebhook: `${baseUrl}/api/webhooks/ach/return`
    }
  }

  /**
   * Get transaction history for an account
   *
   * @param accountId - Bank account identifier
   * @param options - Optional filters for the transaction history
   * @returns Array of transactions for the account
   */
  async getTransactionHistory(
    accountId: string,
    options?: {
      startDate?: string
      endDate?: string
      status?: ACHStatus
      limit?: number
    }
  ): Promise<ACHTransaction[]> {
    const { startDate, endDate, status, limit = 100 } = options || {}

    if (!this.isConfigured()) {
      console.log(`[ACHClient] STUB getTransactionHistory`, {
        accountId,
        startDate,
        endDate,
        status,
        limit
      })
      // Return mock transaction history for stub mode
      const now = new Date()
      return [
        {
          transactionId: this.generateTransactionId('DBT'),
          type: 'debit',
          amount: 50000, // $500.00 in cents
          accountId,
          status: 'completed',
          createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          transactionId: this.generateTransactionId('DBT'),
          type: 'debit',
          amount: 50000,
          accountId,
          status: 'completed',
          createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }

    // In production, this would query the ACH provider's transaction history API
    console.log(`[ACHClient] getTransactionHistory`, {
      accountId,
      startDate,
      endDate,
      status,
      limit
    })
    return []
  }

  /**
   * Generate an ACH-style transaction ID
   */
  private generateTransactionId(prefix: string = 'ACH'): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 10).toUpperCase()
    return `${prefix}-${timestamp}-${random}`
  }

  /**
   * Validate ABA routing number using checksum algorithm
   */
  private validateRoutingNumber(routing: string): boolean {
    // Must be exactly 9 digits
    if (!/^\d{9}$/.test(routing)) {
      return false
    }

    // ABA routing number checksum validation
    // Formula: 3(d1 + d4 + d7) + 7(d2 + d5 + d8) + (d3 + d6 + d9) mod 10 = 0
    const digits = routing.split('').map(Number)
    const checksum =
      3 * (digits[0] + digits[3] + digits[6]) +
      7 * (digits[1] + digits[4] + digits[7]) +
      (digits[2] + digits[5] + digits[8])

    return checksum % 10 === 0
  }
}

// Export singleton instance
export const achClient = new ACHClient()
