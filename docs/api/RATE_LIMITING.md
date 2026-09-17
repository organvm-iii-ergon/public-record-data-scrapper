# Rate Limiting

This document describes the rate limiting system used by the UCC-MCA Intelligence Platform API.

## Overview

The API implements sliding window rate limiting to protect against abuse and ensure fair usage. Rate limits are enforced per IP address.

## Default Limits

| Setting      | Value        |
| ------------ | ------------ |
| Window       | 15 minutes   |
| Max Requests | 100 requests |

## Rate Limit Headers

All responses include rate limit headers:

| Header                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed in window          |
| `X-RateLimit-Remaining` | Requests remaining in current window        |
| `X-RateLimit-Reset`     | Timestamp when the window resets (ISO 8601) |

### Example Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-15T10:30:00.000Z
```

## Rate Limit Exceeded Response

When the rate limit is exceeded, the API returns:

**Status Code:** `429 Too Many Requests`

**Headers:**

```
Retry-After: 300
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-15T10:30:00.000Z
```

**Body:**

```json
{
  "error": {
    "message": "Too many requests. Please try again later.",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429,
    "retryAfter": 300
  }
}
```

## Implementation Details

### Development Mode

In development, rate limiting uses an in-memory store:

- Simple and fast
- Resets on server restart
- Suitable for local development

### Production Mode

In production, rate limiting uses Redis:

- Distributed across server instances
- Persists across restarts
- Accurate sliding window algorithm

### IP Detection

The rate limiter detects client IP in this order:

1. `X-Forwarded-For` header (first IP in chain)
2. `X-Real-IP` header
3. `req.ip` (direct connection)

This ensures correct IP detection when behind reverse proxies (Nginx, AWS ALB, etc.).

## Configuration

### Environment Variables

```bash
# Rate limit window in milliseconds (default: 15 minutes)
RATE_LIMIT_WINDOW_MS=900000

# Maximum requests per window (default: 100)
RATE_LIMIT_MAX=100

# Force Redis rate limiting in development
USE_REDIS_RATE_LIMIT=true
```

### Programmatic Configuration

```typescript
// server/config/index.ts
rateLimit: {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // requests per window
}
```

## Exempt Endpoints

The following endpoints are NOT rate limited:

| Endpoint        | Reason                            |
| --------------- | --------------------------------- |
| `/api/health`   | Health checks must always respond |
| `/api/health/*` | Kubernetes probes                 |

## Best Practices for Clients

### 1. Handle 429 Responses

```typescript
async function fetchWithRetry(url: string, options: RequestInit) {
  const response = await fetch(url, options)

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
    await sleep(retryAfter * 1000)
    return fetchWithRetry(url, options)
  }

  return response
}
```

### 2. Monitor Rate Limit Headers

```typescript
function checkRateLimit(response: Response) {
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0')

  if (remaining < 10) {
    console.warn(`Rate limit warning: ${remaining} requests remaining`)
  }
}
```

### 3. Implement Exponential Backoff

```typescript
async function fetchWithBackoff(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url)

    if (response.status !== 429) {
      return response
    }

    const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
    await sleep(delay)
  }

  throw new Error('Max retries exceeded')
}
```

### 4. Batch Requests

Instead of making many individual requests, use batch endpoints:

```typescript
// Bad: Many individual requests
for (const id of prospectIds) {
  await fetch(`/api/prospects/${id}`)
}

// Good: Single batch request
await fetch('/api/prospects/batch', {
  method: 'POST',
  body: JSON.stringify({ ids: prospectIds })
})
```

## Troubleshooting

### Rate Limit Not Working Behind Proxy

Ensure your proxy forwards the correct headers:

**Nginx:**

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

**AWS ALB:**

- Automatically adds `X-Forwarded-For` header

### Rate Limits Not Distributed

Ensure Redis is configured and accessible:

- Check `REDIS_URL` environment variable
- Verify Redis connectivity
- Check for `[RateLimiter] Using Redis-based rate limiting` in startup logs

### Rate Limits Too Restrictive

Adjust limits based on your needs:

```bash
RATE_LIMIT_WINDOW_MS=60000  # 1 minute window
RATE_LIMIT_MAX=1000         # 1000 requests per minute
```

## Monitoring

### Metrics to Track

1. **429 Response Rate** - Percentage of rate-limited requests
2. **Remaining Requests** - Average remaining requests per client
3. **Top Clients** - Clients approaching rate limits

### Logging

Rate limit events are logged:

```
[RateLimiter] Rate limit exceeded for IP 192.168.1.1
```
