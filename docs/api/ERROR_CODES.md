# API Error Codes

All API errors follow a consistent JSON structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "statusCode": 400,
  "details": { ... }
}
```

## Error Code Reference

### Client Errors (4xx)

#### `VALIDATION_ERROR` (400 Bad Request)

Request validation failed. Check the `details.fields` object for specific field errors.

**Response:**

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "statusCode": 400,
  "details": {
    "fields": {
      "email": ["Invalid email format"],
      "page": ["Must be a positive integer"]
    }
  }
}
```

**Common Causes:**

- Missing required fields
- Invalid field formats (UUID, email, date)
- Values outside allowed ranges
- Invalid enum values

---

#### `UNAUTHORIZED` (401 Unauthorized)

Authentication is required but was not provided or is invalid.

**Response:**

```json
{
  "error": "UNAUTHORIZED",
  "message": "Authentication required",
  "statusCode": 401
}
```

**Common Causes:**

- Missing `Authorization` header
- Invalid or expired JWT token
- Malformed Bearer token

**Resolution:**
Include a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

#### `FORBIDDEN` (403 Forbidden)

User is authenticated but lacks permission for the requested action.

**Response:**

```json
{
  "error": "FORBIDDEN",
  "message": "Permission denied",
  "statusCode": 403
}
```

**Common Causes:**

- Insufficient role/permissions
- Attempting to access another user's resources
- Action requires admin privileges

---

#### `NOT_FOUND` (404 Not Found)

The requested resource does not exist.

**Response:**

```json
{
  "error": "NOT_FOUND",
  "message": "Prospect with id '123e4567-e89b-12d3-a456-426614174000' not found",
  "statusCode": 404,
  "details": {
    "resource": "Prospect",
    "id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

**Common Causes:**

- Invalid resource ID
- Resource was deleted
- Typo in endpoint path

---

#### `CONFLICT` (409 Conflict)

The request conflicts with existing data.

**Response:**

```json
{
  "error": "CONFLICT",
  "message": "A prospect with this company name already exists",
  "statusCode": 409,
  "details": {
    "resource": "Prospect"
  }
}
```

**Common Causes:**

- Duplicate unique constraint violation
- Concurrent modification conflict
- State transition not allowed

---

#### `RATE_LIMIT_EXCEEDED` (429 Too Many Requests)

Rate limit has been exceeded. Wait before retrying.

**Response:**

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded",
  "statusCode": 429,
  "details": {
    "retryAfter": 60
  }
}
```

**Headers:**

```
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
```

**Resolution:**
Wait for the time specified in `Retry-After` header or `details.retryAfter` before making another request.

---

### Server Errors (5xx)

#### `SERVICE_ERROR` (500 Internal Server Error)

Generic server error. Check server logs for details.

**Response:**

```json
{
  "error": "SERVICE_ERROR",
  "message": "An unexpected error occurred",
  "statusCode": 500
}
```

**Note:** In development, the response may include a `stack` property with the error stack trace.

---

#### `DATABASE_ERROR` (500 Internal Server Error)

Database operation failed.

**Response:**

```json
{
  "error": "DATABASE_ERROR",
  "message": "Database operation failed",
  "statusCode": 500,
  "details": {
    "originalMessage": "Connection timeout"
  }
}
```

**Common Causes:**

- Database connection issues
- Query timeout
- Constraint violations
- Transaction failures

---

#### `EXTERNAL_SERVICE_ERROR` (502 Bad Gateway)

An external service dependency failed.

**Response:**

```json
{
  "error": "EXTERNAL_SERVICE_ERROR",
  "message": "External service 'NewsAPI' failed",
  "statusCode": 502,
  "details": {
    "service": "NewsAPI"
  }
}
```

**Common Causes:**

- Third-party API unavailable
- Network timeout to external service
- External API rate limiting
- Invalid API credentials

---

## Error Handling Best Practices

### Client-Side

1. **Always check for error responses:**

   ```typescript
   if (response.error) {
     switch (response.error) {
       case 'VALIDATION_ERROR':
         displayFieldErrors(response.details.fields)
         break
       case 'UNAUTHORIZED':
         redirectToLogin()
         break
       case 'RATE_LIMIT_EXCEEDED':
         retryAfter(response.details.retryAfter)
         break
       default:
         showGenericError(response.message)
     }
   }
   ```

2. **Handle network errors separately:**

   ```typescript
   try {
     const response = await fetch('/api/prospects')
     // Handle API errors
   } catch (networkError) {
     // Handle network/connection errors
   }
   ```

3. **Implement exponential backoff for 429 errors:**
   ```typescript
   async function fetchWithRetry(url, options, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       const response = await fetch(url, options)
       if (response.status === 429) {
         const retryAfter = response.headers.get('Retry-After') || Math.pow(2, i)
         await sleep(retryAfter * 1000)
         continue
       }
       return response
     }
     throw new Error('Max retries exceeded')
   }
   ```

### Server-Side Error Creation

Use the typed error classes for consistent error responses:

```typescript
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError
} from '../errors'

// Resource not found
throw new NotFoundError('Prospect', prospectId)

// Validation failed
throw new ValidationError('Invalid input', {
  email: ['Invalid format'],
  age: ['Must be positive']
})

// Authentication required
throw new UnauthorizedError('Token expired')

// Permission denied
throw new ForbiddenError('Admin access required')

// Conflict with existing data
throw new ConflictError('Email already registered', 'User')

// Rate limit exceeded
throw new RateLimitError(60) // retry after 60 seconds

// Database failure
throw new DatabaseError('Query timeout', originalError)

// External service failure
throw new ExternalServiceError('PaymentGateway', 'Connection refused')
```

## HTTP Status Code Summary

| Status | Code                   | Description                 |
| ------ | ---------------------- | --------------------------- |
| 400    | VALIDATION_ERROR       | Invalid request parameters  |
| 401    | UNAUTHORIZED           | Authentication required     |
| 403    | FORBIDDEN              | Permission denied           |
| 404    | NOT_FOUND              | Resource not found          |
| 409    | CONFLICT               | Conflict with existing data |
| 429    | RATE_LIMIT_EXCEEDED    | Rate limit exceeded         |
| 500    | SERVICE_ERROR          | Generic server error        |
| 500    | DATABASE_ERROR         | Database operation failed   |
| 502    | EXTERNAL_SERVICE_ERROR | External service failed     |
