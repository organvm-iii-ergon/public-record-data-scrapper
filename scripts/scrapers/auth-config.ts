/**
 * Authentication Configuration for State UCC Scrapers
 *
 * Manages credentials and authentication state for scrapers that require login.
 * Currently supports Texas SOS Portal (as of Sept 2025).
 *
 * Configuration methods (in priority order):
 * 1. Environment variables (TX_UCC_USERNAME, TX_UCC_PASSWORD)
 * 2. .env file in project root
 * 3. Manual configuration via setCredentials()
 *
 * Security notes:
 * - NEVER commit credentials to git
 * - Use environment variables in production
 * - .env file should be in .gitignore
 */

export interface StateCredentials {
  username: string
  password: string
  mfaSecret?: string // TOTP secret for 2FA (future use)
}

export interface AuthConfig {
  TX?: StateCredentials
  FL?: StateCredentials
  CA?: StateCredentials
}

class AuthConfigManager {
  private config: AuthConfig = {}

  constructor() {
    this.loadFromEnv()
  }

  /**
   * Load credentials from environment variables
   */
  private loadFromEnv(): void {
    // Texas credentials
    if (process.env.TX_UCC_USERNAME && process.env.TX_UCC_PASSWORD) {
      this.config.TX = {
        username: process.env.TX_UCC_USERNAME,
        password: process.env.TX_UCC_PASSWORD,
        mfaSecret: process.env.TX_UCC_MFA_SECRET
      }
    }

    // Florida credentials (if needed in future)
    if (process.env.FL_UCC_USERNAME && process.env.FL_UCC_PASSWORD) {
      this.config.FL = {
        username: process.env.FL_UCC_USERNAME,
        password: process.env.FL_UCC_PASSWORD
      }
    }

    // California credentials (if needed in future)
    if (process.env.CA_UCC_USERNAME && process.env.CA_UCC_PASSWORD) {
      this.config.CA = {
        username: process.env.CA_UCC_USERNAME,
        password: process.env.CA_UCC_PASSWORD
      }
    }
  }

  /**
   * Manually set credentials for a state (useful for testing)
   */
  setCredentials(state: keyof AuthConfig, credentials: StateCredentials): void {
    this.config[state] = credentials
  }

  /**
   * Get credentials for a state
   */
  getCredentials(state: keyof AuthConfig): StateCredentials | undefined {
    return this.config[state]
  }

  /**
   * Check if credentials are configured for a state
   */
  hasCredentials(state: keyof AuthConfig): boolean {
    return !!this.config[state]?.username && !!this.config[state]?.password
  }

  /**
   * Get all configured states
   */
  getConfiguredStates(): string[] {
    return Object.keys(this.config).filter(state =>
      this.hasCredentials(state as keyof AuthConfig)
    )
  }

  /**
   * Clear credentials for a state
   */
  clearCredentials(state: keyof AuthConfig): void {
    delete this.config[state]
  }

  /**
   * Clear all credentials
   */
  clearAll(): void {
    this.config = {}
  }
}

// Singleton instance
export const authConfig = new AuthConfigManager()

/**
 * Helper function to check if authentication is available for Texas
 */
export function hasTexasAuth(): boolean {
  return authConfig.hasCredentials('TX')
}

/**
 * Helper function to get Texas credentials
 */
export function getTexasCredentials(): StateCredentials | undefined {
  return authConfig.getCredentials('TX')
}
