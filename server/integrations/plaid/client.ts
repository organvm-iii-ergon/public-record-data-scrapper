/**
 * Plaid API Client
 *
 * Base client for Plaid integration with environment configuration.
 * Supports sandbox, development, and production environments.
 *
 * Note: This is a stub implementation. Replace with actual Plaid SDK
 * calls when integrating with the Plaid API.
 *
 * @see https://plaid.com/docs/
 * @module server/integrations/plaid/client
 */

import { config } from '../../config'

/**
 * Plaid environment types
 */
export type PlaidEnvironment = 'sandbox' | 'development' | 'production'

/**
 * Plaid client configuration
 */
export interface PlaidClientConfig {
  clientId: string
  secret: string
  environment: PlaidEnvironment
}

/**
 * Plaid API base URLs by environment
 */
const PLAID_BASE_URLS: Record<PlaidEnvironment, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com'
}

/**
 * Generic Plaid API response structure
 */
export interface PlaidApiResponse<T> {
  data: T
  requestId: string
}

/**
 * Plaid error structure
 */
export interface PlaidError {
  errorType: string
  errorCode: string
  errorMessage: string
  displayMessage?: string
  requestId?: string
}

/**
 * Check if an error is a Plaid error
 */
export function isPlaidError(error: unknown): error is PlaidError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errorType' in error &&
    'errorCode' in error &&
    'errorMessage' in error
  )
}

/**
 * Plaid client for API interactions.
 *
 * Provides authenticated access to Plaid API endpoints with proper
 * environment configuration and error handling.
 *
 * @example
 * ```typescript
 * const client = new PlaidClient({
 *   clientId: 'your-client-id',
 *   secret: 'your-secret',
 *   environment: 'sandbox'
 * })
 *
 * const response = await client.makeRequest('/link/token/create', {
 *   user: { client_user_id: 'user-123' },
 *   client_name: 'MCA Platform',
 *   products: ['transactions'],
 *   country_codes: ['US'],
 *   language: 'en'
 * })
 * ```
 */
export class PlaidClient {
  private readonly clientId: string
  private readonly secret: string
  private readonly environment: PlaidEnvironment
  private readonly baseUrl: string

  constructor(clientConfig?: Partial<PlaidClientConfig>) {
    // Get config from environment variables or provided config
    this.clientId = clientConfig?.clientId || process.env.PLAID_CLIENT_ID || ''
    this.secret = clientConfig?.secret || process.env.PLAID_SECRET || ''
    this.environment = (clientConfig?.environment ||
      process.env.PLAID_ENV ||
      'sandbox') as PlaidEnvironment
    this.baseUrl = PLAID_BASE_URLS[this.environment]
  }

  /**
   * Get the current environment
   */
  getEnvironment(): PlaidEnvironment {
    return this.environment
  }

  /**
   * Get the base URL for the current environment
   */
  getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Check if the client is configured with credentials
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.secret)
  }

  /**
   * Make an authenticated request to the Plaid API.
   *
   * @param endpoint - The API endpoint (e.g., '/link/token/create')
   * @param body - Request body
   * @returns API response
   * @throws {PlaidError} If the API returns an error
   *
   * @remarks
   * This is a stub implementation. In production, this would make actual
   * HTTP requests to the Plaid API.
   */
  async makeRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<PlaidApiResponse<T>> {
    // Validate configuration
    if (!this.isConfigured()) {
      throw this.createError(
        'INVALID_CONFIGURATION',
        'MISSING_CREDENTIALS',
        'Plaid client is not configured with credentials'
      )
    }

    // In production, this would be an actual HTTP request:
    // const response = await fetch(`${this.baseUrl}${endpoint}`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'PLAID-CLIENT-ID': this.clientId,
    //     'PLAID-SECRET': this.secret
    //   },
    //   body: JSON.stringify(body)
    // })

    // Stub implementation - return mock response based on endpoint
    const mockResponse = this.getMockResponse<T>(endpoint, body)
    return mockResponse
  }

  /**
   * Create a Plaid error object
   */
  private createError(errorType: string, errorCode: string, errorMessage: string): PlaidError {
    return {
      errorType,
      errorCode,
      errorMessage,
      requestId: `stub-${Date.now()}`
    }
  }

  /**
   * Get mock response for stub implementation.
   *
   * This method simulates Plaid API responses for development and testing.
   * Replace with actual API calls in production.
   */
  private getMockResponse<T>(endpoint: string, body: Record<string, unknown>): PlaidApiResponse<T> {
    const requestId = `stub-request-${Date.now()}`

    // Mock responses based on endpoint
    switch (endpoint) {
      case '/link/token/create':
        return {
          data: {
            link_token: `link-sandbox-${Date.now()}`,
            expiration: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            request_id: requestId
          } as unknown as T,
          requestId
        }

      case '/item/public_token/exchange':
        return {
          data: {
            access_token: `access-sandbox-${Date.now()}`,
            item_id: `item-sandbox-${Date.now()}`,
            request_id: requestId
          } as unknown as T,
          requestId
        }

      case '/transactions/get':
        return {
          data: {
            accounts: [],
            transactions: [],
            item: {},
            total_transactions: 0,
            request_id: requestId
          } as unknown as T,
          requestId
        }

      case '/transactions/sync':
        return {
          data: {
            added: [],
            modified: [],
            removed: [],
            next_cursor: '',
            has_more: false,
            request_id: requestId
          } as unknown as T,
          requestId
        }

      case '/accounts/get':
        return {
          data: {
            accounts: [],
            item: {},
            request_id: requestId
          } as unknown as T,
          requestId
        }

      case '/accounts/balance/get':
        return {
          data: {
            accounts: [],
            item: {},
            request_id: requestId
          } as unknown as T,
          requestId
        }

      default:
        return {
          data: { request_id: requestId } as unknown as T,
          requestId
        }
    }
  }
}

/**
 * Default Plaid client instance using environment configuration
 */
export const plaidClient = new PlaidClient()

/**
 * Create a new Plaid client with custom configuration
 */
export function createPlaidClient(clientConfig: PlaidClientConfig): PlaidClient {
  return new PlaidClient(clientConfig)
}
