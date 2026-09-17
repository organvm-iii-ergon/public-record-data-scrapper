import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Check if ioredis is available
let ioredisAvailable = false
try {
  require.resolve('ioredis')
  ioredisAvailable = true
} catch {
  ioredisAvailable = false
}

// Skip all tests if ioredis is not installed
const describeConditional = ioredisAvailable ? describe : describe.skip

// Create mock functions
const mockRedisOn = vi.fn()
const mockRedisQuit = vi.fn().mockResolvedValue('OK')

// Mock Redis class properly
class MockRedis {
  options: Record<string, unknown>

  constructor(options: Record<string, unknown>) {
    this.options = options
    // Store constructor calls for verification
    MockRedis.constructorCalls.push(options)
  }

  on = mockRedisOn
  quit = mockRedisQuit

  static constructorCalls: Array<Record<string, unknown>> = []
  static reset() {
    MockRedis.constructorCalls = []
  }
}

vi.mock('ioredis', () => ({
  Redis: MockRedis
}))

// Mock config
vi.mock('../../config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'test-password'
    }
  }
}))

describeConditional('RedisConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockRedis.reset()
    // Reset the module to get a fresh singleton
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('connect', () => {
    it('should create Redis client and subscriber on first connect', async () => {
      const { redisConnection } = await import('../../queue/connection')

      const result = redisConnection.connect()

      expect(MockRedis.constructorCalls.length).toBe(2) // client + subscriber
      expect(result).toHaveProperty('client')
      expect(result).toHaveProperty('subscriber')
    })

    it('should return cached connections on subsequent calls', async () => {
      const { redisConnection } = await import('../../queue/connection')

      const first = redisConnection.connect()
      MockRedis.reset() // Clear constructor calls
      const second = redisConnection.connect()

      expect(MockRedis.constructorCalls.length).toBe(0) // No new instances
      expect(first.client).toBe(second.client)
      expect(first.subscriber).toBe(second.subscriber)
    })

    it('should configure retry strategy with exponential backoff', async () => {
      const { redisConnection } = await import('../../queue/connection')
      redisConnection.connect()

      const constructorCall = MockRedis.constructorCalls[0]
      expect(constructorCall).toHaveProperty('retryStrategy')

      // Test retry strategy function
      const retryStrategy = constructorCall.retryStrategy as (times: number) => number
      expect(retryStrategy(1)).toBe(50)
      expect(retryStrategy(10)).toBe(500)
      expect(retryStrategy(100)).toBe(2000) // Max 2000ms
    })

    it('should configure reconnectOnError for READONLY errors', async () => {
      const { redisConnection } = await import('../../queue/connection')
      redisConnection.connect()

      const constructorCall = MockRedis.constructorCalls[0]
      const reconnectOnError = constructorCall.reconnectOnError as (err: Error) => boolean

      expect(reconnectOnError(new Error('READONLY You cannot write'))).toBe(true)
      expect(reconnectOnError(new Error('Connection refused'))).toBe(false)
    })

    it('should register error event handlers on client and subscriber', async () => {
      const { redisConnection } = await import('../../queue/connection')
      redisConnection.connect()

      // Should register error handler for client
      expect(mockRedisOn).toHaveBeenCalledWith('error', expect.any(Function))
      // Should register connect handler for client
      expect(mockRedisOn).toHaveBeenCalledWith('connect', expect.any(Function))
    })

    it('should use config values for Redis connection', async () => {
      const { redisConnection } = await import('../../queue/connection')
      redisConnection.connect()

      const constructorCall = MockRedis.constructorCalls[0]
      expect(constructorCall).toMatchObject({
        host: 'localhost',
        port: 6379,
        password: 'test-password'
      })
    })
  })

  describe('disconnect', () => {
    it('should close both client and subscriber connections', async () => {
      const { redisConnection } = await import('../../queue/connection')

      redisConnection.connect()
      await redisConnection.disconnect()

      expect(mockRedisQuit).toHaveBeenCalledTimes(2)
    })

    it('should handle disconnect when not connected', async () => {
      const { redisConnection } = await import('../../queue/connection')

      // Should not throw when not connected
      await expect(redisConnection.disconnect()).resolves.not.toThrow()
    })

    it('should allow reconnection after disconnect', async () => {
      const { redisConnection } = await import('../../queue/connection')

      redisConnection.connect()
      await redisConnection.disconnect()

      // Reset mock counts
      MockRedis.reset()

      // Should be able to connect again
      redisConnection.connect()
      expect(MockRedis.constructorCalls.length).toBe(2)
    })
  })

  describe('getClient', () => {
    it('should return client when initialized', async () => {
      const { redisConnection } = await import('../../queue/connection')

      redisConnection.connect()
      const client = redisConnection.getClient()

      expect(client).toBeDefined()
    })

    it('should throw error when client not initialized', async () => {
      const { redisConnection } = await import('../../queue/connection')

      expect(() => redisConnection.getClient()).toThrow(
        'Redis client not initialized. Call connect() first.'
      )
    })
  })

  describe('getSubscriber', () => {
    it('should return subscriber when initialized', async () => {
      const { redisConnection } = await import('../../queue/connection')

      redisConnection.connect()
      const subscriber = redisConnection.getSubscriber()

      expect(subscriber).toBeDefined()
    })

    it('should throw error when subscriber not initialized', async () => {
      const { redisConnection } = await import('../../queue/connection')

      expect(() => redisConnection.getSubscriber()).toThrow(
        'Redis subscriber not initialized. Call connect() first.'
      )
    })
  })

  describe('error handling', () => {
    it('should log error when client emits error event', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { redisConnection } = await import('../../queue/connection')

      redisConnection.connect()

      // Find the error handler that was registered
      const errorHandler = mockRedisOn.mock.calls.find((call) => call[0] === 'error')?.[1]
      expect(errorHandler).toBeDefined()

      // Simulate error
      const testError = new Error('Connection lost')
      errorHandler(testError)

      expect(consoleSpy).toHaveBeenCalledWith('Redis client error:', testError)
      consoleSpy.mockRestore()
    })

    it('should log connection success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const { redisConnection } = await import('../../queue/connection')

      redisConnection.connect()

      // Find the connect handler
      const connectHandler = mockRedisOn.mock.calls.find((call) => call[0] === 'connect')?.[1]
      expect(connectHandler).toBeDefined()

      // Simulate successful connection
      connectHandler()

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Redis client connected'))
      consoleSpy.mockRestore()
    })
  })
})

// Add a single test that always runs to indicate the skip reason
describe('Redis Connection Tests - Dependency Check', () => {
  it.skipIf(!ioredisAvailable)('should skip tests when ioredis is not installed', () => {
    expect(true).toBe(true)
  })

  it.skipIf(ioredisAvailable)('skips tests because ioredis is not installed', () => {
    console.log('Redis connection tests skipped: ioredis package not installed')
    expect(true).toBe(true)
  })
})
