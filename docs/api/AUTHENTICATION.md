# API Authentication

This document describes the authentication system used by the UCC-MCA Intelligence Platform API.

## Overview

The API uses JWT (JSON Web Token) based authentication. All protected endpoints require a valid JWT token in the Authorization header.

## Authentication Flow

1. Client obtains JWT token (via login or external auth provider)
2. Client includes token in `Authorization` header
3. Server validates token on each request
4. Server extracts user claims from token

## Token Format

```
Authorization: Bearer <jwt-token>
```

### JWT Claims

| Claim   | Description                   | Required                |
| ------- | ----------------------------- | ----------------------- |
| `sub`   | User ID                       | Yes                     |
| `email` | User email                    | Yes                     |
| `role`  | User role (admin/user/viewer) | No (defaults to 'user') |
| `iat`   | Issued at timestamp           | Yes                     |
| `exp`   | Expiration timestamp          | Yes                     |

### Token Expiration

- **Access tokens**: 1 hour
- **Refresh tokens**: 7 days

## Public Endpoints

The following endpoints do not require authentication:

| Endpoint                   | Description            |
| -------------------------- | ---------------------- |
| `GET /api/health`          | Basic health check     |
| `GET /api/health/live`     | Liveness probe         |
| `GET /api/health/ready`    | Readiness probe        |
| `GET /api/health/detailed` | Detailed health status |

## Protected Endpoints

All other endpoints require authentication:

| Resource    | Endpoints            |
| ----------- | -------------------- |
| Prospects   | `/api/prospects/*`   |
| Competitors | `/api/competitors/*` |
| Portfolio   | `/api/portfolio/*`   |
| Enrichment  | `/api/enrichment/*`  |
| Jobs        | `/api/jobs/*`        |

## Role-Based Access Control

### Roles

| Role     | Description      | Permissions           |
| -------- | ---------------- | --------------------- |
| `admin`  | Full access      | All operations        |
| `user`   | Standard access  | CRUD on own resources |
| `viewer` | Read-only access | Read operations only  |

### Role Hierarchy

```
admin > user > viewer
```

A role includes all permissions of lower roles.

## Error Responses

### 401 Unauthorized

Returned when:

- No Authorization header provided
- Invalid token format
- Token expired
- Token signature invalid

```json
{
  "error": {
    "message": "Invalid or expired token",
    "code": "UNAUTHORIZED",
    "statusCode": 401
  }
}
```

### 403 Forbidden

Returned when:

- User lacks required role
- User lacks permission for resource

```json
{
  "error": {
    "message": "Insufficient permissions",
    "code": "FORBIDDEN",
    "statusCode": 403
  }
}
```

## Implementation Details

### Token Validation

```typescript
// server/middleware/authMiddleware.ts
const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload
req.user = {
  id: decoded.sub,
  email: decoded.email,
  role: decoded.role || 'user'
}
```

### Optional Authentication

Some endpoints support optional authentication using `optionalAuthMiddleware`:

```typescript
router.get('/public-with-user', optionalAuthMiddleware, handler)
// req.user will be set if token provided, undefined otherwise
```

### Role Requirement

```typescript
router.delete('/admin-only', authMiddleware, requireRole('admin'), handler)
// Only users with 'admin' role can access
```

## Best Practices

1. **Store tokens securely** - Use httpOnly cookies or secure storage
2. **Implement token refresh** - Don't force users to re-authenticate frequently
3. **Handle token expiration** - Refresh tokens before they expire
4. **Log out properly** - Clear tokens from storage on logout

## Example: Making Authenticated Requests

### JavaScript/TypeScript

```typescript
const response = await fetch('/api/prospects', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
})
```

### cURL

```bash
curl -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     https://api.example.com/api/prospects
```

## Security Considerations

1. **HTTPS Required** - Always use HTTPS in production
2. **Token Storage** - Never store tokens in localStorage in production
3. **CORS** - Configure CORS to restrict token usage to your domains
4. **Token Rotation** - Consider implementing token rotation for long sessions
