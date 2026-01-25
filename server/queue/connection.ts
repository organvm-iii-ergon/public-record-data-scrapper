import { Redis } from 'ioredis'
import { config } from '../config'

class RedisConnection {
  private client: Redis | null = null
  private subscriber: Redis | null = null

  connect(): { client: Redis; subscriber: Redis } {
    if (this.client && this.subscriber) {
      return { client: this.client, subscriber: this.subscriber }
    }

    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY'
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true
        }
        return false
      }
    }

    this.client = new Redis(redisConfig)
    this.subscriber = new Redis(redisConfig)

    this.client.on('error', (error) => {
      console.error('Redis client error:', error)
    })

    this.client.on('connect', () => {
      console.log('✓ Redis client connected')
    })

    this.subscriber.on('error', (error) => {
      console.error('Redis subscriber error:', error)
    })

    return { client: this.client, subscriber: this.subscriber }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit()
      this.client = null
    }
    if (this.subscriber) {
      await this.subscriber.quit()
      this.subscriber = null
    }
    console.log('✓ Redis connections closed')
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.')
    }
    return this.client
  }

  getSubscriber(): Redis {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not initialized. Call connect() first.')
    }
    return this.subscriber
  }
}

export const redisConnection = new RedisConnection()
