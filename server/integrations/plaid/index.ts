/**
 * Plaid Integration Module
 *
 * Exports all Plaid integration functionality for the MCA Platform.
 *
 * @module server/integrations/plaid
 */

// Client
export {
  PlaidClient,
  plaidClient,
  createPlaidClient,
  type PlaidEnvironment,
  type PlaidClientConfig,
  type PlaidApiResponse,
  type PlaidError,
  isPlaidError
} from './client'

// Link Token Management
export {
  PlaidLinkManager,
  plaidLinkManager,
  createPlaidLinkManager,
  type LinkTokenCreateRequest,
  type LinkTokenResponse,
  type TokenExchangeResponse,
  type PlaidAccessToken,
  type PlaidProduct,
  type AccountFilter
} from './link'

// Transactions
export {
  PlaidTransactionsManager,
  plaidTransactionsManager,
  createPlaidTransactionsManager,
  type PlaidAccount,
  type PlaidAccountType,
  type PlaidAccountSubtype,
  type PlaidTransaction,
  type TransactionsFetchOptions,
  type TransactionsResponse,
  type TransactionsSyncResponse,
  type TransactionsWebhook,
  type TransactionsWebhookType,
  type ParsedTransactionCategory
} from './transactions'
