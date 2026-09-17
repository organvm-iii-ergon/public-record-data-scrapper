/**
 * OpenAPI 3.1 Specification Provider for ucc-mca-edge v1 API.
 */
import { Hono } from 'hono'
import type { AppBindings } from '../types'

export const openapiRoute = new Hono<AppBindings>()

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'UCC-MCA Intelligence Platform Edge API',
    version: '1.0.0',
    description:
      'Edge-native versioned REST API for multi-tenant UCC prospect ingestion, background job processing, enrichment, and API key auth.'
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment Edge Worker'
    }
  ],
  security: [{ apiKeyAuth: [] }, { bearerAuth: [] }, { cfAccessAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Public Health Check',
        security: [],
        responses: {
          '200': {
            description: 'Liveness probe healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    env: { type: 'string' },
                    revision: { type: 'string' }
                  },
                  required: ['ok', 'env']
                }
              }
            }
          }
        }
      }
    },
    '/v1/prospects': {
      get: {
        summary: 'List org prospects',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'min_priority', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Paginated list of prospects' },
          '401': { description: 'Unauthorized' }
        }
      },
      post: {
        summary: 'Ingest new prospect',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  company_name: { type: 'string' },
                  priority_score: { type: 'integer', minimum: 0, maximum: 100 },
                  status: { type: 'string' },
                  enrichment_confidence: { type: 'number', minimum: 0, maximum: 1 },
                  raw_data: { type: 'object' }
                },
                required: ['company_name']
              }
            }
          }
        },
        responses: {
          '201': { description: 'Prospect created' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/v1/prospects/{id}': {
      get: {
        summary: 'Get single prospect by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Prospect retrieved' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Not found' }
        }
      }
    },
    '/v1/jobs': {
      get: {
        summary: 'List background jobs',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          { name: 'status', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'List of jobs' },
          '401': { description: 'Unauthorized' }
        }
      },
      post: {
        summary: 'Enqueue a background job',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  payload: { type: 'object' }
                },
                required: ['type']
              }
            }
          }
        },
        responses: {
          '202': { description: 'Job enqueued' },
          '400': { description: 'Bad request' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/v1/jobs/{id}': {
      get: {
        summary: 'Get background job by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Job status retrieved' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Job not found' }
        }
      }
    },
    '/v1/enrichment/prospect': {
      post: {
        summary: 'Trigger single prospect enrichment',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { prospect_id: { type: 'string' } },
                required: ['prospect_id']
              }
            }
          }
        },
        responses: {
          '202': { description: 'Enrichment job enqueued' },
          '404': { description: 'Prospect not found' }
        }
      }
    },
    '/v1/enrichment/batch': {
      post: {
        summary: 'Batch prospect enrichment (Requires Growth Tier)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  prospect_ids: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 1,
                    maxItems: 100
                  }
                },
                required: ['prospect_ids']
              }
            }
          }
        },
        responses: {
          '202': { description: 'Batch job enqueued' },
          '403': { description: 'Tier upgrade required' }
        }
      }
    },
    '/v1/enrichment/status': {
      get: {
        summary: 'Get enrichment pipeline metrics',
        responses: {
          '200': { description: 'Pipeline metrics' }
        }
      }
    },
    '/v1/keys': {
      get: {
        summary: 'List API keys',
        responses: {
          '200': { description: 'Active API keys' }
        }
      },
      post: {
        summary: 'Mint new API key',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
                  expires_at: { type: 'string', format: 'date-time' }
                },
                required: ['name']
              }
            }
          }
        },
        responses: {
          '201': { description: 'Key created and plaintext returned once' }
        }
      }
    },
    '/v1/keys/{id}': {
      delete: {
        summary: 'Revoke an API key',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Key revoked' },
          '404': { description: 'Key not found' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Tenant API key prefixed with prk_ (e.g. prk_...)'
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API key sent as Authorization: Bearer prk_...'
      },
      cfAccessAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'Cf-Access-Jwt-Assertion',
        description: 'Cloudflare Zero Trust Access JWT assertion'
      }
    }
  }
}

openapiRoute.get('/openapi.json', (c) => {
  return c.json(openApiSpec)
})
