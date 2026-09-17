# Security Implementation Guide

## Overview

This document outlines the security measures implemented in the UCC-MCA Intelligence Platform and provides guidance for maintaining security best practices.

## Implemented Security Measures

### 1. Input Sanitization ✅

**Location**: `src/lib/utils/sanitize.ts`

**Coverage**:

- HTML sanitization (XSS prevention)
- Text escaping (HTML entity encoding)
- URL validation (javascript:, data: protocol blocking)
- Email validation and normalization
- Filename sanitization (path traversal prevention)
- Number validation with bounds checking
- SQL input sanitization (defense in depth)
- Alphanumeric filtering
- Deep object sanitization
- CSP nonce generation

**Usage Examples**:

```typescript
import { sanitizeHtml, sanitizeText, sanitizeUrl } from '@/lib/utils/sanitize'

// Sanitize user-generated HTML
const safeHtml = sanitizeHtml(userInput)

// Escape text for display
const safeText = sanitizeText(userInput)

// Validate URLs
const safeUrl = sanitizeUrl(linkInput)
```

**Test Coverage**: 38 tests covering all sanitization functions

### 2. Build System Security ✅

**Issues Fixed**:

- Missing `react-is` dependency causing build failures
- Resolved Recharts import issues

**Current Status**:

- Build completes successfully
- Zero npm vulnerabilities (verified with `npm audit`)
- All dependencies up to date

### 3. Content Security Policy (CSP)

**Status**: Planned
**Priority**: P1

**Recommended Headers**:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{NONCE}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.yourcompany.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

**Implementation**: Add CSP middleware to server

## Pending Security Implementations

### 1. Authentication & Authorization 🔴 CRITICAL

**Status**: Not Implemented
**Priority**: P0 (Blocks Production)

**Recommended Solution**: Auth0 or Clerk

**Required Features**:

- User authentication (login/logout)
- Role-based access control (RBAC)
  - Admin: Full access
  - Sales Manager: View all, claim, export
  - Sales Rep: View assigned, claim own
  - Viewer: Read-only
- Multi-factor authentication (MFA)
- Session management
- API key management

**Estimated Timeline**: 3-5 days

### 2. Rate Limiting 🟠 HIGH

**Status**: Partial (in-memory only)
**Priority**: P1

**Current Implementation**:

- Token bucket algorithm in `src/lib/collectors/RateLimiter.ts`
- **Limitation**: Per-instance, not distributed

**Required Enhancement**: Redis-backed rate limiter

```typescript
// server/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
})
```

**Tiers**:

- Public API: 100 requests/15min (free), 10k/day (paid)
- Scraping: 10 requests/hour per user
- Exports: 50 exports/day per user

### 3. Audit Logging 🟠 HIGH

**Status**: Not Implemented
**Priority**: P1

**Requirements**:

- Log all data mutations (create, update, delete)
- Track user actions (claim, unclaim, export)
- Immutable append-only log
- Queryable audit trail

**Schema**:

```typescript
interface AuditLog {
  id: string
  timestamp: Date
  userId: string
  action: 'create' | 'update' | 'delete' | 'claim' | 'export'
  resource: 'prospect' | 'portfolio' | 'user'
  resourceId: string
  changes?: Record<string, any>
  ipAddress: string
  userAgent: string
}
```

**Storage**: PostgreSQL with time-series partitioning

### 4. Encryption at Rest 🟡 MEDIUM

**Status**: Depends on infrastructure
**Priority**: P2

**Coverage**:

- Database encryption (RDS encryption enabled)
- S3 bucket encryption (SSE-S3 or SSE-KMS)
- Secrets management (AWS Secrets Manager)

**Verification**:

```bash
# Check RDS encryption
aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,StorageEncrypted]'

# Check S3 encryption
aws s3api get-bucket-encryption --bucket your-bucket
```

### 5. Security Headers 🟡 MEDIUM

**Status**: Not Implemented
**Priority**: P2

**Required Headers**:

```typescript
// server/middleware/security.ts
import helmet from 'helmet'

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'nonce-{NONCE}'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true
  })
)
```

## Vulnerability Management

### Dependency Scanning

**Current Status**: ✅ Zero vulnerabilities

**Tools**:

- `npm audit` (built-in)
- Dependabot (GitHub, configured)
- Snyk (optional, recommended for production)

**Process**:

```bash
# Regular audits
npm audit

# Fix automatically when possible
npm audit fix

# Check for outdated packages
npm outdated
```

### Secret Management

**Best Practices**:

1. ❌ Never commit secrets to git
2. ✅ Use `.env.example` for templates
3. ✅ Use environment variables for secrets
4. ✅ Rotate secrets regularly (90 days)
5. ✅ Use AWS Secrets Manager in production

**Current Implementation**:

```bash
# .env (not committed)
VITE_API_URL=https://api.yourcompany.com
DATABASE_URL=postgresql://user:pass@localhost/db
REDIS_URL=redis://localhost:6379
SENDGRID_API_KEY=SG.xxx
AUTH0_CLIENT_SECRET=xxx
```

### Security Scanning

**Recommended Tools**:

1. **SAST** (Static Analysis):
   - ESLint with security rules
   - Semgrep (free, powerful)
2. **DAST** (Dynamic Analysis):
   - OWASP ZAP
   - Burp Suite

3. **Container Scanning**:
   - Trivy
   - Clair

4. **License Compliance**:
   - `license-checker` (npm)
   - FOSSA

## Compliance

### SOC 2 Type I/II

**Status**: Not Started
**Priority**: P1 for Enterprise Sales

**Requirements**:

- Audit logging ✅ (pending)
- Encryption at rest ✅ (infrastructure ready)
- Access controls ❌ (no auth yet)
- Incident response plan ❌
- Vendor risk management ❌

**Timeline**: 6-12 months

### GDPR Compliance

**Status**: Partial
**Priority**: P1 for EU customers

**Implemented**:

- Data minimization (collect only necessary data)
- Secure storage (encrypted)

**Pending**:

- Privacy policy ❌
- Cookie consent ❌
- Data export (right to access) ❌
- Data deletion (right to be forgotten) ❌
- Data processing agreement ❌

**Implementation**:

```typescript
// server/services/gdpr.ts
export async function exportUserData(userId: string) {
  const data = {
    profile: await db.user.findUnique({ where: { id: userId } }),
    prospects: await db.prospect.findMany({ where: { claimedBy: userId } }),
    auditLogs: await db.auditLog.findMany({ where: { userId } })
  }

  return JSON.stringify(data, null, 2)
}

export async function deleteUserData(userId: string) {
  // Anonymize audit logs (keep for compliance)
  await db.auditLog.updateMany({
    where: { userId },
    data: { userId: 'DELETED_USER' }
  })

  // Delete user and cascading data
  await db.user.delete({ where: { id: userId } })
}
```

## Security Checklist

### Development

- [ ] Never commit secrets
- [ ] Sanitize all user inputs
- [ ] Use parameterized queries
- [ ] Validate API responses
- [ ] Handle errors gracefully (no stack traces to users)

### Pre-Deployment

- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Run security linters (ESLint, Semgrep)
- [ ] Review IAM permissions (principle of least privilege)
- [ ] Enable AWS GuardDuty
- [ ] Configure CloudWatch alarms

### Post-Deployment

- [ ] Monitor error rates
- [ ] Review audit logs weekly
- [ ] Rotate secrets monthly
- [ ] Patch vulnerabilities within 7 days (critical), 30 days (high)
- [ ] Conduct security training quarterly

## Incident Response Plan

### Detection

1. CloudWatch alarms trigger
2. Error rate spikes
3. Security tool alerts (GuardDuty, Snyk)
4. User reports suspicious activity

### Response

1. **Triage** (5 min): Assess severity (P0-P3)
2. **Contain** (15 min): Isolate affected systems
3. **Investigate** (1 hour): Root cause analysis
4. **Remediate** (4 hours): Deploy fix
5. **Communicate** (24 hours): Notify affected users
6. **Document** (1 week): Postmortem report

### Contact

- Security Lead: security@yourcompany.com
- On-Call Engineer: PagerDuty
- AWS Support: Premium support ticket

## Security Audit Schedule

| Audit Type       | Frequency | Last Completed | Next Due   |
| ---------------- | --------- | -------------- | ---------- |
| Dependency Scan  | Weekly    | 2025-12-19     | 2025-12-26 |
| Penetration Test | Annually  | N/A            | 2026-01-01 |
| Code Review      | Per PR    | Continuous     | N/A        |
| Access Review    | Quarterly | N/A            | 2026-03-31 |
| Secret Rotation  | Monthly   | N/A            | 2026-01-19 |

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [GitHub Security Advisories](https://github.com/advisories)

---

**Last Updated**: December 19, 2025  
**Version**: 1.0  
**Owner**: Engineering Team
