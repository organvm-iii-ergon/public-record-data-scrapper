# UCC Scraper Authentication Guide

This guide explains how to configure authentication for state UCC scrapers that require login credentials.

## Overview

As of September 2025, Texas requires authentication to access their UCC search portal. Other states may add authentication requirements in the future. This system provides a secure way to manage credentials for automated scraping.

## Quick Setup

### 1. Create .env File

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

### 2. Add Texas Credentials

Edit `.env` and add your Texas SOS Portal credentials:

```bash
# Texas SOS Portal Credentials
TX_UCC_USERNAME=your_actual_username
TX_UCC_PASSWORD=your_actual_password
```

### 3. Get Texas SOS Portal Account

If you don't have an account yet:

1. Visit: https://www.sos.state.tx.us/ucc/
2. Click "Create Account" or "Register"
3. Fill in required information
4. Verify your email address
5. Note your username and password

### 4. Test Authentication

Run the Texas scraper to verify your credentials work:

```bash
npm run test:scrapers:tx
```

You should see:
```
Attempting to authenticate with Texas SOS Portal
Username entered
Password entered
Login button clicked, waiting for navigation
Successfully authenticated with Texas SOS Portal
```

## Authentication Flow

### Automatic Authentication

The Texas scraper automatically handles authentication:

1. **Login Detection**: Checks if the page requires login
2. **Credential Retrieval**: Gets credentials from environment variables
3. **Form Fill**: Automatically fills username/password fields
4. **Submit**: Clicks the login button
5. **Verification**: Confirms successful authentication
6. **Session Persistence**: Maintains login across searches

### Session Management

- **Per-Browser Session**: Authentication persists for the browser instance
- **Automatic Re-auth**: If session expires, automatically re-authenticates
- **Multiple Searches**: One login supports multiple searches
- **Browser Cleanup**: Session cleared when browser closes

## Security Best Practices

### ✅ DO

- **Use Environment Variables**: Store credentials in `.env` file
- **Keep .env Private**: Never commit `.env` to git (it's in .gitignore)
- **Rotate Credentials**: Change passwords periodically
- **Use Strong Passwords**: Follow Texas SOS password requirements
- **Monitor Access**: Check for unauthorized usage
- **Production Secrets**: Use secret managers (AWS Secrets Manager, GitHub Secrets)

### ❌ DON'T

- **Don't Hardcode**: Never put credentials directly in code
- **Don't Share .env**: Don't commit or share your `.env` file
- **Don't Reuse Passwords**: Use unique password for UCC portal
- **Don't Log Credentials**: Credentials are never logged by the system
- **Don't Share Accounts**: Each user should have their own account

## Credential Configuration Methods

### Method 1: Environment Variables (Recommended)

```bash
export TX_UCC_USERNAME="your_username"
export TX_UCC_PASSWORD="your_password"
npm run test:scrapers:tx
```

### Method 2: .env File (Recommended for Development)

```bash
# .env file
TX_UCC_USERNAME=your_username
TX_UCC_PASSWORD=your_password
```

### Method 3: Programmatic Configuration

```typescript
import { authConfig } from './auth-config'

authConfig.setCredentials('TX', {
  username: 'your_username',
  password: 'your_password'
})
```

## Troubleshooting Authentication

### Error: "Texas authentication credentials not configured"

**Solution**: Set TX_UCC_USERNAME and TX_UCC_PASSWORD environment variables

```bash
# Check if variables are set
echo $TX_UCC_USERNAME
echo $TX_UCC_PASSWORD

# Set them if missing
export TX_UCC_USERNAME="your_username"
export TX_UCC_PASSWORD="your_password"
```

### Error: "Login failed - invalid credentials or portal change"

**Possible Causes**:
1. **Wrong credentials**: Verify username/password are correct
2. **Account locked**: Too many failed login attempts
3. **Portal changed**: Texas updated their login page structure
4. **Account expired**: Account needs renewal

**Solutions**:
- Try logging in manually at https://www.sos.state.tx.us/ucc/
- Reset your password if needed
- Contact Texas SOS if account is locked
- File a bug report if portal structure changed

### Error: "Could not locate username/email field on login page"

**Cause**: Texas SOS changed their login page HTML structure

**Solution**:
1. Open issue on GitHub with screenshot of current login page
2. We'll update the selectors to match new structure
3. As workaround, use manual searches temporarily

### Error: "Authentication timeout"

**Cause**: Network slow or portal unresponsive

**Solutions**:
- Increase timeout in scraper config (default: 45s)
- Check internet connection
- Try again during off-peak hours
- Texas portal may be under maintenance

## Advanced: 2FA Support (Future)

Two-factor authentication support is planned for future implementation:

```bash
# Future: 2FA configuration
TX_UCC_MFA_SECRET=your_totp_secret
```

This will use TOTP (Time-based One-Time Password) for automated 2FA handling.

## State-Specific Notes

### Texas (TX)
- ✅ **Authentication**: Required as of Sept 2025
- ✅ **Implemented**: Full automation support
- ⚠️ **Requirements**: Must create SOS Portal account
- 📝 **Cost**: Account creation is free

### Florida (FL)
- ✅ **Authentication**: Not required (as of Nov 2025)
- ℹ️ **Portal**: floridaucc.com (privatized system)
- 📝 **Note**: May add auth in future

### California (CA)
- ✅ **Authentication**: Optional (free searches available)
- ℹ️ **Portal**: bizfileonline.sos.ca.gov
- 📝 **Note**: Basic searches work without login

## Monitoring Authentication

### Check Auth Status

```typescript
import { authConfig } from './scripts/scrapers/auth-config'

// Check if credentials are configured
console.log('TX Auth:', authConfig.hasCredentials('TX'))
console.log('FL Auth:', authConfig.hasCredentials('FL'))
console.log('CA Auth:', authConfig.hasCredentials('CA'))

// List all configured states
console.log('Configured:', authConfig.getConfiguredStates())
```

### Test Authentication

```bash
# Test Texas authentication without running full search
npm run test:scrapers:tx
```

Look for these log messages:
- ✅ "Successfully authenticated with Texas SOS Portal"
- ❌ "Authentication failed"
- ⚠️ "Texas authentication credentials not configured"

## Production Deployment

### Environment Variables

For production deployment, set environment variables in your hosting platform:

**AWS Lambda/EC2:**
```bash
aws ssm put-parameter \
  --name "/app/tx-ucc-username" \
  --value "your_username" \
  --type "SecureString"
```

**Docker:**
```dockerfile
ENV TX_UCC_USERNAME=${TX_UCC_USERNAME}
ENV TX_UCC_PASSWORD=${TX_UCC_PASSWORD}
```

**GitHub Actions:**
```yaml
env:
  TX_UCC_USERNAME: ${{ secrets.TX_UCC_USERNAME }}
  TX_UCC_PASSWORD: ${{ secrets.TX_UCC_PASSWORD }}
```

### Secret Rotation

Implement credential rotation:

1. **Create New Credentials**: Generate new password in Texas portal
2. **Update Secrets**: Update environment variables
3. **Deploy**: Redeploy with new credentials
4. **Verify**: Test authentication works
5. **Delete Old**: Delete old credentials from portal

## Support

### Getting Help

- **Authentication Issues**: Check this guide first
- **Texas Portal Issues**: Contact Texas SOS support
- **Code Issues**: File issue on GitHub
- **Security Concerns**: Email security@example.com

### Reporting Issues

When reporting authentication issues, include:

1. **State**: Which state scraper (TX/FL/CA)
2. **Error Message**: Exact error text
3. **Logs**: Relevant log output (DO NOT include credentials)
4. **Screenshots**: Of error page (blur sensitive info)
5. **When**: Date/time when error occurred

### Contributing

Help improve authentication support:

- Test with different account types
- Report portal structure changes
- Submit PR with updated selectors
- Document edge cases you encounter
