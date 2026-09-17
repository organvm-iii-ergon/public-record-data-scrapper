import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaidClient, createPlaidClient, isPlaidError } from '../../integrations/plaid/client'
import { PlaidLinkManager, createPlaidLinkManager } from '../../integrations/plaid/link'
import {
  PlaidTransactionsManager,
  createPlaidTransactionsManager,
  type PlaidTransaction,
  type TransactionsWebhookType
} from '../../integrations/plaid/transactions'

const transport = vi.fn<typeof fetch>()
const client = () =>
  createPlaidClient({ clientId: 'test-client', secret: 'test-secret', environment: 'sandbox' })
const respond = (data: object, status = 200) =>
  transport.mockResolvedValueOnce(
    new Response(JSON.stringify({ request_id: 'provider-receipt', ...data }), { status })
  )
const sent = () => JSON.parse(String(transport.mock.calls.at(-1)?.[1]?.body))
const account = {
  account_id: 'account-1',
  name: 'Checking',
  type: 'depository',
  balances: { current: 123, available: 100, iso_currency_code: 'USD' }
}
const raw = {
  transaction_id: 'tx-1',
  account_id: 'account-1',
  amount: -500,
  date: '2026-09-01',
  name: 'Deposit',
  pending: false,
  payment_channel: 'other'
}
const token = { link_token: 'test-link', expiration: '2026-09-17T12:00:00Z' }
beforeEach(() => {
  transport.mockReset()
  vi.stubGlobal('fetch', transport)
  for (const key of ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV']) vi.stubEnv(key, undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('Plaid authenticated transport', () => {
  it('fails missing configuration without making a request or inventing a receipt', async () => {
    const c = new PlaidClient()
    expect(c.isConfigured()).toBe(false)
    expect(c.getEnvironment()).toBe('sandbox')
    expect(c.getBaseUrl()).toBe('https://sandbox.plaid.com')
    await expect(c.makeRequest('/item/get', {})).rejects.toMatchObject({
      errorCode: 'MISSING_CREDENTIALS',
      requestId: undefined
    })
    expect(transport).not.toHaveBeenCalled()
    expect(isPlaidError(null)).toBe(false)
    expect(isPlaidError('error')).toBe(false)
    expect(isPlaidError({ errorType: 'API_ERROR' })).toBe(false)
    expect(
      isPlaidError({ errorType: 'API_ERROR', errorCode: 'DENIED', errorMessage: 'denied' })
    ).toBe(true)
  })
  it('uses environment configuration and preserves only the provider receipt', async () => {
    vi.stubEnv('PLAID_CLIENT_ID', 'environment-client')
    vi.stubEnv('PLAID_SECRET', 'environment-secret')
    vi.stubEnv('PLAID_ENV', 'production')
    respond({ value: 42 })
    expect(
      await new PlaidClient().makeRequest('/item/get', { access_token: 'test-access' })
    ).toEqual({
      data: { value: 42, request_id: 'provider-receipt' },
      requestId: 'provider-receipt'
    })
    expect(transport.mock.calls[0][0]).toBe('https://production.plaid.com/item/get')
    expect(transport.mock.calls[0][1]?.headers).toMatchObject({
      'PLAID-CLIENT-ID': 'environment-client',
      'PLAID-SECRET': 'environment-secret'
    })
    expect(sent()).toEqual({ access_token: 'test-access' })
  })
  it('preserves structured provider errors and handles non-JSON failures', async () => {
    respond(
      {
        error_type: 'ITEM_ERROR',
        error_code: 'ITEM_LOGIN_REQUIRED',
        error_message: 'Reauthenticate'
      },
      400
    )
    await expect(client().makeRequest('/item/get', {})).rejects.toEqual({
      errorType: 'ITEM_ERROR',
      errorCode: 'ITEM_LOGIN_REQUIRED',
      errorMessage: 'Reauthenticate',
      requestId: 'provider-receipt'
    })
    transport.mockResolvedValueOnce(new Response('upstream unavailable', { status: 503 }))
    await expect(client().makeRequest('/item/get', {})).rejects.toMatchObject({
      errorType: 'API_ERROR',
      errorCode: 'PLAID_REQUEST_FAILED',
      requestId: undefined
    })
  })
  it.each(['{}', 'null', '[]', 'malformed', '{"request_id":""}'])(
    'rejects a malformed success %s',
    async (payload) => {
      transport.mockResolvedValueOnce(new Response(payload))
      await expect(client().makeRequest('/item/get', {})).rejects.toMatchObject({
        errorCode: 'INVALID_RESPONSE',
        requestId: undefined
      })
    }
  )
  it('fetches a verification key by its identifier', async () => {
    respond({ key: { kty: 'EC', kid: 'key-1' } })
    expect(await client().webhookVerificationKeyGet('key-1')).toMatchObject({
      key: { kid: 'key-1' }
    })
    expect(sent()).toEqual({ key_id: 'key-1' })
  })
})

describe('Link configuration and token lifecycle', () => {
  it('sends default products and explicit options without changing token receipts', async () => {
    respond(token)
    respond(token)
    const manager = createPlaidLinkManager(client())
    expect(await manager.createLinkToken({ clientUserId: 'user-1' })).toEqual({
      linkToken: 'test-link',
      expiration: token.expiration,
      requestId: 'provider-receipt'
    })
    expect(sent()).toMatchObject({
      user: { client_user_id: 'user-1' },
      client_name: 'MCA Platform',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en'
    })
    await manager.createLinkToken({
      clientUserId: 'user-1',
      clientName: 'Custom',
      products: ['auth'],
      countryCodes: ['CA'],
      language: 'fr',
      webhook: 'https://app.example.test/hook',
      redirectUri: 'https://app.example.test/return',
      accountFilters: { depository: { account_subtypes: ['checking'] } },
      accessToken: 'test-access',
      linkCustomizationName: 'custom'
    })
    expect(sent()).toMatchObject({
      client_name: 'Custom',
      products: ['auth'],
      country_codes: ['CA'],
      language: 'fr',
      account_filters: { depository: { account_subtypes: ['checking'] } },
      access_token: 'test-access',
      link_customization_name: 'custom'
    })
  })
  it('uses an object account filter for underwriting and keeps update mode tied to its access token', async () => {
    respond(token)
    respond(token)
    const manager = new PlaidLinkManager(client())
    await manager.createUnderwritingLinkToken('user-1')
    expect(sent().account_filters).toEqual({
      depository: { account_subtypes: ['checking', 'savings'] }
    })
    expect(sent().products).toEqual(['transactions', 'auth'])
    await manager.createUpdateLinkToken('existing-access', 'user-1')
    expect(sent().access_token).toBe('existing-access')
  })
  it('exchanges tokens and maps item error information and removal acknowledgement', async () => {
    respond({ access_token: 'test-access', item_id: 'item-1' })
    const manager = new PlaidLinkManager(client())
    expect(await manager.exchangePublicToken('test-public')).toEqual({
      accessToken: 'test-access',
      itemId: 'item-1',
      requestId: 'provider-receipt'
    })
    expect(sent()).toEqual({ public_token: 'test-public' })
    for (const error of [
      undefined,
      { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'login' }
    ]) {
      respond({
        item: {
          item_id: 'item-1',
          available_products: ['auth'],
          billed_products: ['transactions'],
          error
        }
      })
      const item = await manager.getItemInfo('test-access')
      expect(item.itemId).toBe('item-1')
      expect(item.error?.errorCode).toBe(error?.error_code)
    }
    respond({ removed: true })
    expect(await manager.removeItem('test-access')).toEqual({
      removed: true,
      requestId: 'provider-receipt'
    })
    respond({ removed: false })
    expect((await manager.removeItem('test-access')).removed).toBe(false)
    expect(new PlaidLinkManager()).toBeInstanceOf(PlaidLinkManager)
  })
})

describe('transaction history and categorization', () => {
  it('maps provider fields, locations and account balances without fabricating entries', async () => {
    respond({
      accounts: [account],
      transactions: [
        raw,
        {
          ...raw,
          transaction_id: 'tx-2',
          location: { postal_code: '10001', store_number: '3' },
          personal_finance_category: { primary: 'INCOME', detailed: 'INCOME_WAGES' }
        }
      ],
      total_transactions: 2
    })
    const manager = createPlaidTransactionsManager(client())
    const result = await manager.fetchTransactions({
      accessToken: 'test-access',
      startDate: '2026-09-01',
      endDate: '2026-09-16',
      accountIds: ['account-1'],
      count: 25,
      offset: 50,
      includePersonalFinanceCategory: false
    })
    expect(result.accounts[0]).toMatchObject({
      accountId: 'account-1',
      balances: { current: 123, available: 100, isoCurrencyCode: 'USD' }
    })
    expect(result.transactions[0]).toMatchObject({
      transactionId: 'tx-1',
      amount: -500,
      location: undefined
    })
    expect(result.transactions[1].location).toMatchObject({ postalCode: '10001', storeNumber: '3' })
    expect(sent().options).toEqual({
      count: 25,
      offset: 50,
      account_ids: ['account-1'],
      include_personal_finance_category: false
    })
  })
  it('reads all pages and sends the requested historical date window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T12:00:00Z'))
    respond({
      accounts: [account],
      transactions: Array.from({ length: 500 }, (_, i) => ({ ...raw, transaction_id: `tx-${i}` })),
      total_transactions: 501
    })
    respond({
      accounts: [account],
      transactions: [{ ...raw, transaction_id: 'tx-500' }],
      total_transactions: 501
    })
    const result = await new PlaidTransactionsManager(client()).fetch24MonthHistory('test-access', [
      'account-1'
    ])
    expect(result.transactions).toHaveLength(501)
    expect(result.totalTransactions).toBe(501)
    expect(sent()).toMatchObject({
      start_date: '2024-09-16',
      end_date: '2026-09-16',
      options: { offset: 500 }
    })
  })
  it('maps sync additions, modifications, deletions, cursor and current balances', async () => {
    const manager = new PlaidTransactionsManager(client())
    respond({
      added: [raw],
      modified: [{ ...raw, amount: -600 }],
      removed: [{ transaction_id: 'deleted' }],
      next_cursor: 'cursor-2',
      has_more: false,
      accounts: [account]
    })
    const sync = await manager.syncTransactions('test-access')
    expect(sync).toMatchObject({
      nextCursor: 'cursor-2',
      hasMore: false,
      removed: [{ transactionId: 'deleted' }],
      modified: [{ amount: -600 }]
    })
    expect(sent().cursor).toBe('')
    for (const ids of [undefined, ['account-1']]) {
      respond({ accounts: [account] })
      expect((await manager.getBalances('test-access', ids)).accounts[0].balances.current).toBe(123)
      expect(sent().options?.account_ids).toEqual(ids)
    }
  })
  it.each([
    { amount: -100, name: 'Deposit', expected: 'isRevenue' },
    { amount: 100, name: 'Purchase', expected: 'isExpense', merchantName: 'Store' },
    { amount: 100, name: 'NSF FEE', expected: 'isNsfFee' },
    { amount: 100, name: 'bank', merchantName: 'OVERDRAFT', expected: 'isNsfFee' },
    { amount: 100, name: 'Payment', category: ['Loan'], expected: 'isLenderPayment' },
    { amount: 100, name: 'Payment', category: ['Loan Payments'], expected: 'isLenderPayment' },
    {
      amount: 100,
      name: 'Payment',
      personalFinanceCategory: { primary: 'LOAN_PAYMENTS', detailed: 'BUSINESS' },
      expected: 'isLenderPayment'
    },
    ...['TRANSFER', 'XFER', 'ACH CREDIT', 'ACH DEBIT'].map((name) => ({
      amount: -100,
      name,
      expected: 'isTransfer'
    })),
    { amount: -100, name: '', category: ['Transfer'], expected: 'isTransfer' },
    ...['TRANSFER_IN', 'TRANSFER_OUT'].map((primary) => ({
      amount: -100,
      name: '',
      personalFinanceCategory: { primary, detailed: 'INTERNAL' },
      expected: 'isTransfer'
    }))
  ])('classifies $name as $expected', ({ expected, ...input }) => {
    const tx: PlaidTransaction = {
      transactionId: 'test',
      accountId: 'test',
      date: '2026-09-01',
      pending: false,
      paymentChannel: 'other',
      ...input
    }
    const result = new PlaidTransactionsManager().parseTransactionCategory(tx)
    expect(result[expected as keyof typeof result]).toBe(true)
    if (expected === 'isTransfer' || expected === 'isLenderPayment')
      expect(result.isRevenue).toBe(false)
  })
  it.each([
    'INITIAL_UPDATE',
    'HISTORICAL_UPDATE',
    'DEFAULT_UPDATE',
    'TRANSACTIONS_REMOVED',
    'SYNC_UPDATES_AVAILABLE'
  ] as TransactionsWebhookType[])(
    'requests sync for %s without claiming completion',
    async (webhookCode) => {
      const manager = new PlaidTransactionsManager()
      for (const extras of [{}, { newTransactions: 2, removedTransactions: ['removed'] }]) {
        expect(
          (
            await manager.handleWebhook({
              webhookType: 'TRANSACTIONS',
              webhookCode,
              itemId: 'test-item',
              ...extras
            })
          ).shouldSync
        ).toBe(true)
      }
    }
  )
})
