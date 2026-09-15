# Phase 4: Security & Authentication - Detailed Task Breakdown

**Duration**: 4 weeks (Weeks 13-16)
**Goal**: Production-grade security
**Priority**: CRITICAL
**Dependencies**: Phases 1-3 complete

---

## Week 13-14: Authentication & Authorization

### Task 4.1: OAuth2 + JWT Authentication

**Assignee**: TBD
**Effort**: 4 days
**Priority**: CRITICAL

#### Subtask 4.1.1: Auth0 Integration

**Time**: 2 days

**Setup Auth0:**

```bash
# Install dependencies
npm install auth0 express-jwt jwks-rsa
npm install -D @types/auth0
```

**Auth0 Configuration:**

```typescript
// server/auth/auth0.config.ts
export const auth0Config = {
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  audience: process.env.AUTH0_AUDIENCE!,
  scope: 'openid profile email',
  callbackURL: `${process.env.API_URL}/auth/callback`
}
```

**Authentication Middleware:**

```typescript
// server/middleware/authenticate.ts
import { expressjwt as jwt } from 'express-jwt'
import jwksRsa from 'jwks-rsa'
import { auth0Config } from '../auth/auth0.config'

export const authenticate = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`
  }),
  audience: auth0Config.audience,
  issuer: `https://${auth0Config.domain}/`,
  algorithms: ['RS256']
})
```

**Login Route:**

```typescript
// server/routes/auth.ts
import { Router } from 'express'
import { ManagementClient, AuthenticationClient } from 'auth0'

const router = Router()
const authClient = new AuthenticationClient({
  domain: auth0Config.domain,
  clientId: auth0Config.clientId,
  clientSecret: auth0Config.clientSecret
})

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const result = await authClient.oauth.passwordGrant({
      username: email,
      password,
      audience: auth0Config.audience,
      scope: auth0Config.scope
    })

    res.json({
      access_token: result.data.access_token,
      refresh_token: result.data.refresh_token,
      expires_in: result.data.expires_in
    })
  } catch (error) {
    res.status(401).json({ error: 'Invalid credentials' })
  }
})

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body

    const result = await authClient.oauth.refreshTokenGrant({
      refresh_token
    })

    res.json({
      access_token: result.data.access_token,
      expires_in: result.data.expires_in
    })
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// POST /auth/logout
router.post('/logout', authenticate, async (req, res) => {
  // Revoke token (implementation depends on token storage strategy)
  res.json({ message: 'Logged out successfully' })
})

export default router
```

**Frontend Integration:**

```typescript
// src/lib/auth/AuthService.ts
export class AuthService {
  private accessToken: string | null = null
  private refreshToken: string | null = null

  async login(email: string, password: string): Promise<void> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    if (!response.ok) {
      throw new Error('Login failed')
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token

    // Store in secure storage
    localStorage.setItem('access_token', this.accessToken)
    localStorage.setItem('refresh_token', this.refreshToken)
  }

  async refreshAccessToken(): Promise<void> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.refreshToken })
    })

    if (!response.ok) {
      // Refresh token invalid, logout user
      this.logout()
      throw new Error('Session expired')
    }

    const data = await response.json()
    this.accessToken = data.access_token
    localStorage.setItem('access_token', this.accessToken)
  }

  getAccessToken(): string | null {
    return this.accessToken || localStorage.getItem('access_token')
  }

  async logout(): Promise<void> {
    this.accessToken = null
    this.refreshToken = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken()
  }
}
```

**Acceptance Criteria:**

- [ ] Auth0 application configured
- [ ] JWT authentication working
- [ ] Login endpoint functional
- [ ] Token refresh mechanism
- [ ] Logout endpoint
- [ ] Frontend integration complete
- [ ] Secure token storage

---

### Task 4.2: Role-Based Access Control (RBAC)

**Assignee**: TBD
**Effort**: 3 days
**Priority**: HIGH

**User Roles:**

```typescript
// server/auth/roles.ts
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  ANALYST = 'analyst',
  VIEWER = 'viewer'
}

export const permissions = {
  [UserRole.ADMIN]: [
    'prospects:read',
    'prospects:write',
    'prospects:delete',
    'competitors:read',
    'competitors:write',
    'portfolio:read',
    'portfolio:write',
    'users:read',
    'users:write',
    'users:delete',
    'settings:read',
    'settings:write'
  ],
  [UserRole.MANAGER]: [
    'prospects:read',
    'prospects:write',
    'competitors:read',
    'portfolio:read',
    'portfolio:write',
    'users:read'
  ],
  [UserRole.ANALYST]: ['prospects:read', 'prospects:write', 'competitors:read', 'portfolio:read'],
  [UserRole.VIEWER]: ['prospects:read', 'competitors:read', 'portfolio:read']
}
```

**Authorization Middleware:**

```typescript
// server/middleware/authorize.ts
import { Request, Response, NextFunction } from 'express'
import { UserRole, permissions } from '../auth/roles'

export const authorize = (...requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // User is attached by authenticate middleware
    const userRole = req.user.role as UserRole

    if (!userRole) {
      return res.status(403).json({ error: 'No role assigned' })
    }

    const userPermissions = permissions[userRole] || []
    const hasPermission = requiredPermissions.every((p) => userPermissions.includes(p))

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: requiredPermissions,
        has: userPermissions
      })
    }

    next()
  }
}
```

**Usage:**

```typescript
// Protect routes with permissions
router.delete('/prospects/:id', authenticate, authorize('prospects:delete'), async (req, res) => {
  // Only admins can delete prospects
})

router.post('/users', authenticate, authorize('users:write'), async (req, res) => {
  // Only admins and managers can create users
})
```

**Row-Level Security (RLS) in PostgreSQL:**

```sql
-- Enable RLS on prospects table
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own claimed prospects or unclaimed ones
CREATE POLICY prospects_visibility ON prospects
  FOR SELECT
  USING (
    status = 'unclaimed'
    OR claimed_by = current_setting('app.current_user_id')::uuid
    OR current_setting('app.current_user_role') = 'admin'
  );

-- Policy: Only assigned users or admins can update prospects
CREATE POLICY prospects_update ON prospects
  FOR UPDATE
  USING (
    claimed_by = current_setting('app.current_user_id')::uuid
    OR current_setting('app.current_user_role') IN ('admin', 'manager')
  );

-- Set current user context in queries
-- server/services/ProspectsService.ts
async list(userId: string, userRole: string, params: any) {
  await this.pool.query('SET app.current_user_id = $1', [userId])
  await this.pool.query('SET app.current_user_role = $1', [userRole])

  const result = await this.pool.query('SELECT * FROM prospects WHERE ...')

  return result.rows
}
```

**Acceptance Criteria:**

- [ ] 4 user roles defined
- [ ] Permission matrix implemented
- [ ] Authorization middleware working
- [ ] Row-level security in database
- [ ] Frontend role-based UI hiding
- [ ] Tests for all roles

---

### Task 4.3: API Key Authentication

**Assignee**: TBD
**Effort**: 2 days
**Priority**: MEDIUM

**API Keys Table:**

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  permissions TEXT[] NOT NULL,
  rate_limit INTEGER DEFAULT 1000,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,

  INDEX idx_api_keys_hash (key_hash),
  INDEX idx_api_keys_user (user_id)
);
```

**API Key Generation:**

```typescript
// server/services/APIKeyService.ts
import crypto from 'crypto'
import { Pool } from 'pg'

export class APIKeyService {
  constructor(private pool: Pool) {}

  async generate(userId: string, name: string, permissions: string[]): Promise<string> {
    // Generate random API key (32 bytes = 64 hex chars)
    const apiKey = crypto.randomBytes(32).toString('hex')

    // Hash for storage (never store plain key)
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

    await this.pool.query(
      `INSERT INTO api_keys (user_id, key_hash, name, permissions)
       VALUES ($1, $2, $3, $4)`,
      [userId, keyHash, name, permissions]
    )

    // Return plain key only once (user must save it)
    return `uccmca_${apiKey}`
  }

  async verify(apiKey: string): Promise<{ userId: string; permissions: string[] } | null> {
    // Remove prefix
    const key = apiKey.replace('uccmca_', '')

    // Hash incoming key
    const keyHash = crypto.createHash('sha256').update(key).digest('hex')

    const result = await this.pool.query(
      `SELECT user_id, permissions, rate_limit, expires_at, revoked_at
       FROM api_keys
       WHERE key_hash = $1`,
      [keyHash]
    )

    if (result.rows.length === 0) {
      return null
    }

    const apiKeyData = result.rows[0]

    // Check if revoked
    if (apiKeyData.revoked_at) {
      return null
    }

    // Check if expired
    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      return null
    }

    // Update last used
    await this.pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1', [keyHash])

    return {
      userId: apiKeyData.user_id,
      permissions: apiKeyData.permissions
    }
  }

  async revoke(keyHash: string): Promise<void> {
    await this.pool.query('UPDATE api_keys SET revoked_at = NOW() WHERE key_hash = $1', [keyHash])
  }
}
```

**API Key Middleware:**

```typescript
// server/middleware/apiKeyAuth.ts
import { Request, Response, NextFunction } from 'express'
import { APIKeyService } from '../services/APIKeyService'

export const apiKeyAuth = (apiKeyService: APIKeyService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' })
    }

    const keyData = await apiKeyService.verify(apiKey)

    if (!keyData) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    // Attach user to request
    req.user = {
      id: keyData.userId,
      permissions: keyData.permissions
    }

    next()
  }
}
```

**Acceptance Criteria:**

- [ ] API key generation
- [ ] Secure storage (hashed)
- [ ] Verification middleware
- [ ] Expiration handling
- [ ] Revocation mechanism
- [ ] Rate limiting per key

---

## Week 15-16: Security Hardening

### Task 4.4: Data Encryption

**Assignee**: TBD
**Effort**: 3 days
**Priority**: HIGH

**Field-Level Encryption:**

```typescript
// server/crypto/encryption.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Return: iv + authTag + encrypted
  return iv.toString('hex') + authTag.toString('hex') + encrypted
}

export function decrypt(ciphertext: string): string {
  const ivHex = ciphertext.slice(0, IV_LENGTH * 2)
  const authTagHex = ciphertext.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2)
  const encryptedHex = ciphertext.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2)

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, undefined, 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// Usage: Encrypt sensitive prospect fields
const encryptedEmail = encrypt(prospect.contactEmail)
const encryptedPhone = encrypt(prospect.contactPhone)
```

**AWS Secrets Manager Integration:**

```typescript
// server/secrets/secretsManager.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

export class SecretsManager {
  private client: SecretsManagerClient

  constructor() {
    this.client = new SecretsManagerClient({ region: process.env.AWS_REGION })
  }

  async getSecret(secretName: string): Promise<string> {
    const command = new GetSecretValueCommand({ SecretId: secretName })
    const response = await this.client.send(command)

    return response.SecretString!
  }

  async getAPIKey(service: string): Promise<string> {
    const secret = await this.getSecret(`${process.env.ENV}/api-keys/${service}`)
    return JSON.parse(secret).apiKey
  }
}

// Usage:
const secretsManager = new SecretsManager()
const auth0Secret = await secretsManager.getSecret('prod/auth0-client-secret')
const stripeKey = await secretsManager.getAPIKey('stripe')
```

**Acceptance Criteria:**

- [ ] Encryption functions tested
- [ ] Sensitive fields encrypted
- [ ] Secrets in AWS Secrets Manager
- [ ] No API keys in code
- [ ] Database encryption at rest

---

### Task 4.5: Security Scanning

**Assignee**: TBD
**Effort**: 2 days
**Priority**: HIGH

**Dependabot Configuration:**
`.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
    reviewers:
      - 'security-team'
    labels:
      - 'dependencies'
      - 'security'
```

**CodeQL Analysis:**
`.github/workflows/codeql.yml`

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write

    steps:
      - uses: actions/checkout@v3

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: javascript, typescript

      - name: Autobuild
        uses: github/codeql-action/autobuild@v2

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
```

**OWASP ZAP Scan:**

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * 0' # Weekly on Sunday at 2am

jobs:
  zap-scan:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Start application
        run: |
          npm install
          npm run build
          npm run preview &
          sleep 10

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'http://localhost:4173'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'

      - name: Upload ZAP Report
        uses: actions/upload-artifact@v3
        with:
          name: zap-report
          path: report_html.html
```

**Acceptance Criteria:**

- [ ] Dependabot enabled
- [ ] CodeQL analysis running
- [ ] OWASP ZAP scans weekly
- [ ] Vulnerability reports reviewed
- [ ] Critical issues fixed

---

### Task 4.6: Compliance & Audit Logging

**Assignee**: TBD
**Effort**: 2 days
**Priority**: MEDIUM

**Audit Log Schema:**

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_audit_user (user_id),
  INDEX idx_audit_timestamp (timestamp),
  INDEX idx_audit_resource (resource_type, resource_id)
);
```

**Audit Middleware:**

```typescript
// server/middleware/audit.ts
export const auditLog = (action: string, resourceType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res)

    res.json = (body: any) => {
      // Log after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        req.db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.user?.id,
            action,
            resourceType,
            body.id,
            JSON.stringify(body),
            req.ip,
            req.headers['user-agent']
          ]
        )
      }

      return originalJson(body)
    }

    next()
  }
}

// Usage:
router.delete(
  '/prospects/:id',
  authenticate,
  authorize('prospects:delete'),
  auditLog('DELETE', 'prospect'),
  async (req, res) => {
    // Delete prospect
  }
)
```

**GDPR Compliance:**

```typescript
// server/routes/gdpr.ts
router.post('/gdpr/export-data', authenticate, async (req, res) => {
  const userId = req.user.id

  // Collect all user data
  const [prospects, portfolio, notes, auditLogs] = await Promise.all([
    db.query('SELECT * FROM prospects WHERE claimed_by = $1', [userId]),
    db.query('SELECT * FROM portfolio_companies WHERE user_id = $1', [userId]),
    db.query('SELECT * FROM notes WHERE user_id = $1', [userId]),
    db.query('SELECT * FROM audit_logs WHERE user_id = $1', [userId])
  ])

  const userData = {
    user: req.user,
    prospects: prospects.rows,
    portfolio: portfolio.rows,
    notes: notes.rows,
    audit_logs: auditLogs.rows,
    exported_at: new Date().toISOString()
  }

  res.json(userData)
})

router.delete('/gdpr/delete-account', authenticate, async (req, res) => {
  const userId = req.user.id

  // Anonymize or delete user data (90-day retention policy)
  await db.query('BEGIN')
  try {
    await db.query('UPDATE prospects SET claimed_by = NULL WHERE claimed_by = $1', [userId])
    await db.query('DELETE FROM portfolio_companies WHERE user_id = $1', [userId])
    await db.query('DELETE FROM notes WHERE user_id = $1', [userId])
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId])
    await db.query('COMMIT')

    res.json({ message: 'Account deletion initiated' })
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  }
})
```

**Acceptance Criteria:**

- [ ] Audit logging for all actions
- [ ] GDPR data export
- [ ] GDPR account deletion
- [ ] 90-day data retention policy
- [ ] Privacy policy updated

---

## Phase 4 Completion Checklist

### Week 13-14: Authentication & Authorization ✓

- [ ] Auth0 OAuth2 integration
- [ ] JWT authentication
- [ ] Token refresh mechanism
- [ ] 4 user roles (Admin, Manager, Analyst, Viewer)
- [ ] Permission-based authorization
- [ ] Row-level security in PostgreSQL
- [ ] API key authentication
- [ ] Rate limiting per API key

### Week 15-16: Security Hardening ✓

- [ ] Field-level encryption (AES-256-GCM)
- [ ] AWS Secrets Manager integration
- [ ] No API keys in code
- [ ] Dependabot enabled
- [ ] CodeQL analysis running
- [ ] OWASP ZAP security scans
- [ ] Audit logging implemented
- [ ] GDPR compliance (export, deletion)
- [ ] Security audit report

### Deliverables

- [ ] Authentication system operational
- [ ] RBAC fully implemented
- [ ] All secrets in vault
- [ ] Security scans passing
- [ ] Audit trail complete
- [ ] GDPR compliance documented
- [ ] Security test coverage 80%+

### Metrics

- **Authentication Success Rate**: 99%+
- **Average Auth Response Time**: <200ms
- **Security Scan Pass Rate**: 100%
- **Vulnerability Count**: 0 critical, 0 high

---

**Total Effort**: 4 weeks
**Total Cost**: ~$24,000 (@ $150/hr)
**Next Phase**: Phase 5 - Production Deployment
