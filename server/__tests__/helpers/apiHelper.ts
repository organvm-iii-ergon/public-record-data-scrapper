import request from 'supertest'
import { Express } from 'express'
import Server from '../../index'

/**
 * Helper for testing API endpoints
 */
export class ApiTestHelper {
  private app: Express
  private server: Server

  constructor() {
    this.server = new Server()
    this.app = this.server.getApp()
  }

  /**
   * Make a GET request to an endpoint
   */
  async get(path: string, headers: Record<string, string> = {}) {
    return request(this.app).get(path).set(headers)
  }

  /**
   * Make a POST request to an endpoint
   */
  async post(path: string, body: unknown, headers: Record<string, string> = {}) {
    return request(this.app).post(path).send(body).set(headers)
  }

  /**
   * Make a PATCH request to an endpoint
   */
  async patch(path: string, body: unknown, headers: Record<string, string> = {}) {
    return request(this.app).patch(path).send(body).set(headers)
  }

  /**
   * Make a DELETE request to an endpoint
   */
  async delete(path: string, headers: Record<string, string> = {}) {
    return request(this.app).delete(path).set(headers)
  }

  /**
   * Assert successful response (2xx status code)
   */
  assertSuccess(response: request.Response) {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Expected success status, got ${response.status}: ${JSON.stringify(response.body)}`
      )
    }
  }

  /**
   * Assert error response with specific status code
   */
  assertError(response: request.Response, expectedStatus: number) {
    if (response.status !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, got ${response.status}: ${JSON.stringify(response.body)}`
      )
    }
  }

  /**
   * Assert response has required fields
   */
  assertHasFields(obj: unknown, fields: string[]) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Expected object for field assertions')
    }

    const record = obj as Record<string, unknown>
    for (const field of fields) {
      if (!(field in record)) {
        throw new Error(`Expected object to have field '${field}', but it was missing`)
      }
    }
  }

  /**
   * Assert pagination structure
   */
  assertPagination(response: request.Response) {
    this.assertSuccess(response)
    this.assertHasFields(response.body, ['page', 'limit', 'total'])

    if (typeof response.body.page !== 'number') {
      throw new Error('page must be a number')
    }
    if (typeof response.body.limit !== 'number') {
      throw new Error('limit must be a number')
    }
    if (typeof response.body.total !== 'number') {
      throw new Error('total must be a number')
    }
  }

  /**
   * Get the Express app for advanced testing
   */
  getApp(): Express {
    return this.app
  }
}
