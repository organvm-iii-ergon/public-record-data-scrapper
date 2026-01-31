/**
 * Texas UCC Scraper
 *
 * Scrapes UCC filing data from Texas Secretary of State
 * Uses Puppeteer for real web scraping with anti-detection measures
 *
 * NOTE: As of September 2025, Texas requires SOS Portal authentication.
 * Set TX_UCC_USERNAME and TX_UCC_PASSWORD environment variables.
 */

import { BaseScraper, ScraperResult } from '../base-scraper'
import puppeteer, { Browser, Page } from 'puppeteer'
import { getTexasCredentials, hasTexasAuth } from '../auth-config'
import { PaginationHandler } from '../pagination-handler'

export class TexasScraper extends BaseScraper {
  private browser: Browser | null = null
  private isAuthenticated: boolean = false

  constructor() {
    super({
      state: 'TX',
      baseUrl: 'https://www.sos.state.tx.us/ucc/index.shtml',
      rateLimit: 3, // 3 requests per minute (conservative for new portal)
      timeout: 45000, // Increased timeout for portal that requires login
      retryAttempts: 2
    })
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      })
    }
    return this.browser
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.isAuthenticated = false
    }
  }

  /**
   * Authenticate with Texas SOS Portal
   *
   * Attempts to log in using credentials from environment variables.
   * Returns true if already authenticated or login successful, false otherwise.
   */
  private async authenticate(page: Page): Promise<{ success: boolean; error?: string }> {
    // Check if already authenticated
    if (this.isAuthenticated) {
      return { success: true }
    }

    // Check if credentials are available
    if (!hasTexasAuth()) {
      return {
        success: false,
        error:
          'Texas authentication credentials not configured. Set TX_UCC_USERNAME and TX_UCC_PASSWORD environment variables.'
      }
    }

    const credentials = getTexasCredentials()!

    try {
      this.log('info', 'Attempting to authenticate with Texas SOS Portal')

      // Navigate to login page (adjust URL as needed)
      const loginUrl = 'https://www.sos.state.tx.us/ucc/login' // This may need adjustment
      await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: this.config.timeout })

      // Wait for login form
      await this.sleep(2000)

      // Find and fill username field
      const usernameField = await page.evaluate(() => {
        const selectors = [
          'input[name="username"]',
          'input[name="email"]',
          'input[type="email"]',
          'input[id="username"]',
          'input[id="email"]',
          'input[placeholder*="username" i]',
          'input[placeholder*="email" i]'
        ]

        for (const selector of selectors) {
          const input = document.querySelector(selector) as HTMLInputElement
          if (input && input.offsetParent !== null) {
            return selector
          }
        }
        return null
      })

      if (!usernameField) {
        return {
          success: false,
          error: 'Could not locate username/email field on login page'
        }
      }

      await page.type(usernameField, credentials.username, { delay: 100 })
      this.log('info', 'Username entered')

      // Find and fill password field
      const passwordField = await page.evaluate(() => {
        const input = document.querySelector('input[type="password"]') as HTMLInputElement
        return input && input.offsetParent !== null ? 'input[type="password"]' : null
      })

      if (!passwordField) {
        return {
          success: false,
          error: 'Could not locate password field on login page'
        }
      }

      await page.type(passwordField, credentials.password, { delay: 100 })
      this.log('info', 'Password entered')

      // Find and click submit button
      const loginButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        const loginBtn = buttons.find((btn) => {
          const text =
            (btn as HTMLElement).textContent?.toLowerCase() ||
            (btn as HTMLInputElement).value?.toLowerCase() ||
            ''
          return text.includes('login') || text.includes('sign in') || text.includes('submit')
        })
        return loginBtn ? true : false
      })

      if (!loginButton) {
        return {
          success: false,
          error: 'Could not locate login/submit button'
        }
      }

      // Click login button
      await page.click('button[type="submit"], input[type="submit"]')
      this.log('info', 'Login button clicked, waiting for navigation')

      // Wait for navigation after login
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
      await this.sleep(2000)

      // Check if login was successful
      const loginSuccess = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase()
        // If we see these, login likely failed
        if (
          bodyText.includes('invalid username') ||
          bodyText.includes('invalid password') ||
          bodyText.includes('incorrect username') ||
          bodyText.includes('incorrect password') ||
          bodyText.includes('login failed')
        ) {
          return false
        }
        // If we still see login form, probably failed
        if (document.querySelector('input[type="password"]')) {
          return false
        }
        return true
      })

      if (loginSuccess) {
        this.isAuthenticated = true
        this.log('info', 'Successfully authenticated with Texas SOS Portal')
        return { success: true }
      } else {
        return {
          success: false,
          error: 'Login failed - invalid credentials or portal change'
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.log('error', 'Authentication error', { error: errorMessage })
      return {
        success: false,
        error: `Authentication error: ${errorMessage}`
      }
    }
  }

  /**
   * Search for UCC filings in Texas
   */
  async search(companyName: string): Promise<ScraperResult> {
    if (!this.validateSearch(companyName)) {
      this.log('error', 'Invalid company name provided', { companyName })
      return {
        success: false,
        error: 'Invalid company name',
        timestamp: new Date().toISOString()
      }
    }

    this.log('info', 'Starting UCC search', { companyName })

    // Rate limiting - wait 12 seconds between requests (5 per minute)
    await this.sleep(12000)

    const searchUrl = this.getManualSearchUrl(companyName)

    try {
      const { result, retryCount } = await this.retryWithBackoff(async () => {
        return await this.performSearch(companyName)
      }, `TX UCC search for ${companyName}`)

      this.log('info', 'UCC search completed successfully', {
        companyName,
        filingCount: result.filings?.length || 0,
        retryCount
      })

      return {
        ...result,
        retryCount
      }
    } catch (error) {
      this.log('error', 'UCC search failed after all retries', {
        companyName,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        searchUrl,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Perform the actual search operation
   *
   * NOTE: As of September 1, 2025, Texas UCC portal requires SOS Portal account login.
   * This scraper will attempt to access public search if available, but may require
   * authentication credentials to be configured.
   */
  private async performSearch(companyName: string): Promise<ScraperResult> {
    let page: Page | null = null

    try {
      const browser = await this.getBrowser()
      page = await browser.newPage()

      this.log('info', 'Browser page created', { companyName })

      // Set user agent and viewport
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      )
      await page.setViewport({ width: 1920, height: 1080 })

      // Navigate to main UCC page first
      this.log('info', 'Navigating to TX UCC portal', { companyName, baseUrl: this.config.baseUrl })
      await page.goto(this.config.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      })

      // Check for login requirement
      const requiresLogin = await page.evaluate(() => {
        if (document.querySelector('input[type="password"]')) {
          return true
        }
        const bodyText = document.body.innerText.toLowerCase()
        const mentionsSignIn = bodyText.includes('sign in') || bodyText.includes('log in')
        return mentionsSignIn && bodyText.includes('password')
      })

      if (requiresLogin) {
        this.log('info', 'Texas UCC portal requires authentication', { companyName })

        // Attempt authentication
        const authResult = await this.authenticate(page)

        if (!authResult.success) {
          this.log('error', 'Authentication failed', { error: authResult.error })
          return {
            success: false,
            error:
              authResult.error ||
              'Texas UCC portal requires SOS Portal account login. Please configure TX_UCC_USERNAME and TX_UCC_PASSWORD environment variables.',
            searchUrl: this.config.baseUrl,
            timestamp: new Date().toISOString()
          }
        }

        // After successful authentication, navigate back to UCC page
        this.log('info', 'Authentication successful, navigating to UCC search')
        await page.goto(this.config.baseUrl, {
          waitUntil: 'networkidle2',
          timeout: this.config.timeout
        })
        await this.sleep(2000)
      }

      // Look for search form or search link
      const searchFormFound = await page.evaluate(() => {
        // Try to find search input fields
        const searchInputs = document.querySelectorAll(
          'input[name*="debtor"], input[name*="search"], input[name*="name"]'
        )
        return searchInputs.length > 0
      })

      if (!searchFormFound) {
        // Try to find and click search link
        const searchLinkClicked = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'))
          const searchLink = links.find(
            (link) =>
              link.textContent?.toLowerCase().includes('search') ||
              link.textContent?.toLowerCase().includes('ucc search')
          )
          if (searchLink) {
            searchLink.click()
            return true
          }
          return false
        })

        if (searchLinkClicked) {
          await page
            .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
            .catch(() => {})
        }
      }

      // Try to fill search form
      const formFilled = await page.evaluate((name) => {
        // Try various common input name patterns for Texas UCC
        const possibleSelectors = [
          'input[name="debtorName"]',
          'input[name="debtor_name"]',
          'input[name="searchName"]',
          'input[name="name"]',
          'input[type="text"]'
        ]

        for (const selector of possibleSelectors) {
          const input = document.querySelector(selector) as HTMLInputElement
          if (input) {
            input.value = name
            return true
          }
        }
        return false
      }, companyName)

      if (!formFilled) {
        const portalNotice =
          'Texas UCC searches now run inside the SOS Portal. Create an SOS Portal account and search there.'
        this.log('warn', portalNotice, { companyName })
        return {
          success: true,
          filings: [],
          searchUrl: page.url(),
          timestamp: new Date().toISOString(),
          parsingErrors: [portalNotice]
        }
      }

      // Submit the form
      await page.evaluate(() => {
        const submitButton = document.querySelector(
          'input[type="submit"], button[type="submit"]'
        ) as HTMLElement
        if (submitButton) {
          submitButton.click()
        } else {
          const form = document.querySelector('form')
          if (form) {
            form.submit()
          }
        }
      })

      // Wait for results
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
      await this.sleep(2000) // Additional wait for dynamic content

      // Check for CAPTCHA
      const hasCaptcha = await page.evaluate(() => {
        return (
          document.body.innerText.toLowerCase().includes('captcha') ||
          document.body.innerText.toLowerCase().includes('robot') ||
          document.querySelector('iframe[src*="recaptcha"]') !== null ||
          document.querySelector('iframe[src*="hcaptcha"]') !== null
        )
      })

      if (hasCaptcha) {
        this.log('error', 'CAPTCHA detected', { companyName })
        return {
          success: false,
          error: 'CAPTCHA detected - manual intervention required',
          searchUrl: page.url(),
          timestamp: new Date().toISOString()
        }
      }

      // Initialize pagination handler
      const paginationHandler = new PaginationHandler({ maxPages: 10 })
      const allFilings: UCCFiling[] = []
      const allErrors: string[] = []
      let currentPage = 1

      // Pagination loop
      while (true) {
        this.log('info', `Scraping page ${currentPage}`, { companyName })

        // Extract UCC filing data with multiple selector strategies
        const { filings: rawFilings, errors: parseErrors } = await page.evaluate(() => {
          const results: Array<{
            filingNumber: string
            debtorName: string
            securedParty: string
            filingDate: string
            collateral: string
            status: 'active' | 'terminated' | 'lapsed'
            filingType: 'UCC-1' | 'UCC-3'
          }> = []
          const errors: string[] = []

          // Try multiple selector strategies for Texas UCC results
          let resultElements = document.querySelectorAll(
            'table.results tr, table.ucc-results tr, div.result-item, div.filing-item'
          )

          // If no results found with specific selectors, try finding tables
          if (resultElements.length === 0) {
            const tables = document.querySelectorAll('table')
            for (const table of tables) {
              const rows = table.querySelectorAll('tr')
              if (rows.length > 1) {
                // Has header + data rows
                resultElements = rows
                break
              }
            }
          }

          resultElements.forEach((element, index) => {
            // Skip header rows
            if (element.querySelector('th') || index === 0) {
              return
            }

            try {
              const cells = element.querySelectorAll('td')

              if (cells.length >= 3) {
                // Try to extract from table cells (common pattern: filing#, date, debtor, secured party)
                const filingNumber = cells[0]?.textContent?.trim() || ''
                const filingDate = cells[1]?.textContent?.trim() || ''
                const debtorName = cells[2]?.textContent?.trim() || ''
                const securedParty = cells[3]?.textContent?.trim() || ''
                const status = cells[4]?.textContent?.trim() || ''

                if (filingNumber || debtorName) {
                  results.push({
                    filingNumber,
                    debtorName,
                    securedParty,
                    filingDate,
                    collateral: '', // May need detail page navigation
                    status: status.toLowerCase().includes('active')
                      ? 'active'
                      : status.toLowerCase().includes('terminated')
                        ? 'terminated'
                        : status.toLowerCase().includes('lapsed')
                          ? 'lapsed'
                          : 'active',
                    filingType:
                      filingNumber.toLowerCase().includes('ucc3') ||
                      filingNumber.toLowerCase().includes('ucc-3')
                        ? 'UCC-3'
                        : 'UCC-1'
                  })
                }
              } else {
                // Try div-based layout
                const filingNumber =
                  element
                    .querySelector('[class*="filing"], [class*="number"]')
                    ?.textContent?.trim() || ''
                const debtorName =
                  element
                    .querySelector('[class*="debtor"], [class*="name"]')
                    ?.textContent?.trim() || ''
                const securedParty =
                  element
                    .querySelector('[class*="secured"], [class*="party"], [class*="creditor"]')
                    ?.textContent?.trim() || ''
                const filingDate =
                  element.querySelector('[class*="date"]')?.textContent?.trim() || ''

                if (filingNumber || debtorName) {
                  results.push({
                    filingNumber,
                    debtorName,
                    securedParty,
                    filingDate,
                    collateral: '',
                    status: 'active',
                    filingType:
                      filingNumber.toLowerCase().includes('ucc3') ||
                      filingNumber.toLowerCase().includes('ucc-3')
                        ? 'UCC-3'
                        : 'UCC-1'
                  })
                }
              }
            } catch (err) {
              errors.push(
                `Error parsing element ${index}: ${err instanceof Error ? err.message : String(err)}`
              )
            }
          })

          return { filings: results, errors }
        })

        // Add filings and errors from this page
        allFilings.push(...rawFilings)
        allErrors.push(...parseErrors)

        this.log('info', `Page ${currentPage}: Found ${rawFilings.length} raw filings`, {
          companyName
        })

        // Check for pagination
        const pagination = await paginationHandler.detectPagination(page)

        this.log('info', `Pagination detected: ${pagination.paginationType}`, {
          companyName,
          currentPage: pagination.currentPage,
          totalPages: pagination.totalPages,
          hasNextPage: pagination.hasNextPage
        })

        // Check if we should continue to next page
        if (!paginationHandler.shouldContinue(currentPage, pagination)) {
          this.log('info', `Pagination complete at page ${currentPage}`, { companyName })
          break
        }

        // Navigate to next page
        const navigated = await paginationHandler.goToNextPage(page, pagination)

        if (!navigated) {
          this.log('info', 'Could not navigate to next page, stopping pagination', { companyName })
          break
        }

        currentPage++
      }

      // Validate all filings and collect errors
      const { validatedFilings, validationErrors } = this.validateFilings(allFilings, allErrors)

      if (validationErrors.length > 0) {
        this.log('warn', 'Some filings had parsing or validation errors', {
          companyName,
          errorCount: validationErrors.length,
          errors: validationErrors
        })
      }

      this.log('info', 'All filings scraped and validated', {
        companyName,
        totalPages: currentPage,
        rawCount: allFilings.length,
        validCount: validatedFilings.length,
        errorCount: validationErrors.length
      })

      return {
        success: true,
        filings: validatedFilings,
        searchUrl: page.url(),
        timestamp: new Date().toISOString(),
        parsingErrors: validationErrors.length > 0 ? validationErrors : undefined
      }
    } finally {
      if (page) {
        await page.close().catch((err) => {
          this.log('warn', 'Error closing page', {
            error: err instanceof Error ? err.message : String(err)
          })
        })
      }
    }
  }

  /**
   * Get manual search URL for Texas
   *
   * NOTE: As of September 2025, Texas requires SOS Portal account login.
   * This URL directs to the main UCC page where users must authenticate.
   */
  getManualSearchUrl(companyName: string): string {
    return `${this.config.baseUrl}#search=${encodeURIComponent(companyName)}`
  }
}
