/**
 * Texas UCC Scraper
 * 
 * Scrapes UCC filing data from Texas Secretary of State
 * Uses Puppeteer for real web scraping with anti-detection measures
 */

import { BaseScraper, ScraperResult } from '../base-scraper'
import puppeteer, { Browser, Page } from 'puppeteer'

export class TexasScraper extends BaseScraper {
  private browser: Browser | null = null

  constructor() {
    super({
      state: 'TX',
      baseUrl: 'https://www.sos.state.tx.us/ucc/index.shtml',
      rateLimit: 5, // 5 requests per minute
      timeout: 30000,
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
        return await this.performSearch(companyName, searchUrl)
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
   */
  private async performSearch(companyName: string, searchUrl: string): Promise<ScraperResult> {
    let page: Page | null = null

    try {
      const browser = await this.getBrowser()
      page = await browser.newPage()

      this.log('info', 'Browser page created', { companyName })

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
      await page.setViewport({ width: 1920, height: 1080 })

      // Navigate to main Texas UCC search page
      this.log('info', 'Navigating to Texas UCC portal', { companyName })
      await page.goto(this.config.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      })

      // Texas may require authentication - check for login page
      const needsLogin = await page.evaluate(() => {
        return document.body.innerText.toLowerCase().includes('login') ||
               document.body.innerText.toLowerCase().includes('sign in') ||
               document.querySelector('input[type="password"]') !== null
      })

      if (needsLogin) {
        this.log('error', 'Texas UCC portal requires authentication', { companyName })
        return {
          success: false,
          error: 'Texas UCC portal requires SOS account login - automated search not available without credentials',
          searchUrl,
          timestamp: new Date().toISOString()
        }
      }

      // Wait for page to load and find search interface
      try {
        await page.waitForSelector('input[type="text"], input[name*="debtor"], input[name*="name"], form, a[href*="search"]', {
          timeout: 10000
        })
      } catch (err) {
        this.log('warn', 'Search interface not immediately found', { companyName })
      }

      // Try to find and click search link if present
      const searchLinkSelectors = [
        'a[href*="search"]',
        'a:has-text("Search")',
        'a:has-text("UCC Search")'
      ]

      for (const selector of searchLinkSelectors) {
        try {
          const link = await page.$(selector)
          if (link) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.config.timeout }),
              link.click()
            ])
            this.log('info', 'Navigated to search page', { selector })
            break
          }
        } catch (err) {
          // Try next selector
        }
      }

      // Try to fill in the debtor name field
      const debtorFieldSelectors = [
        'input[name*="debtor"]',
        'input[name*="DebtorName"]',
        'input[name*="name"]',
        'input[id*="debtor"]',
        'input[placeholder*="debtor"]',
        'input[type="text"]'
      ]

      let fieldFilled = false
      for (const selector of debtorFieldSelectors) {
        try {
          const field = await page.$(selector)
          if (field) {
            await field.type(companyName, { delay: 100 })
            this.log('info', 'Filled debtor name field', { selector })
            fieldFilled = true
            break
          }
        } catch (err) {
          // Try next selector
        }
      }

      if (!fieldFilled) {
        this.log('warn', 'Could not find debtor name field, page structure may have changed')
      }

      // Submit the search form
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Search")',
        'input[value*="Search"]'
      ]

      let formSubmitted = false
      for (const selector of submitSelectors) {
        try {
          const button = await page.$(selector)
          if (button) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.config.timeout }),
              button.click()
            ])
            this.log('info', 'Submitted search form', { selector })
            formSubmitted = true
            break
          }
        } catch (err) {
          // Try next selector
        }
      }

      if (!formSubmitted && fieldFilled) {
        try {
          await page.keyboard.press('Enter')
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 })
          this.log('info', 'Submitted search via Enter key')
        } catch (err) {
          this.log('warn', 'Could not submit search form')
        }
      }

      // Wait for results to load
      await page.waitForTimeout(2000)

      const hasCaptcha = await page.evaluate(() => {
        return document.body.innerText.toLowerCase().includes('captcha') ||
               document.body.innerText.toLowerCase().includes('robot') ||
               document.querySelector('iframe[src*="recaptcha"]') !== null
      })

      if (hasCaptcha) {
        this.log('error', 'CAPTCHA detected', { companyName })
        return {
          success: false,
          error: 'CAPTCHA detected - manual intervention required',
          searchUrl,
          timestamp: new Date().toISOString()
        }
      }

      // Scrape UCC filing data with multiple selector patterns
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

        // Try multiple selector patterns for finding results
        const selectorPatterns = [
          'table tr:not(:first-child)', // Table rows excluding header
          '.search-result',
          '.result-row',
          '.ucc-filing',
          'tr.filing-row',
          '.result-item',
          '[class*="result"]',
          '[class*="filing"]'
        ]

        let resultElements: NodeListOf<Element> | null = null
        for (const pattern of selectorPatterns) {
          const elements = document.querySelectorAll(pattern)
          if (elements.length > 0) {
            resultElements = elements
            break
          }
        }

        if (!resultElements || resultElements.length === 0) {
          errors.push('No result elements found on page - page structure may have changed')
          return { filings: results, errors }
        }

        resultElements.forEach((element, index) => {
          try {
            const getText = (selectors: string[]): string => {
              for (const sel of selectors) {
                const el = element.querySelector(sel)
                if (el?.textContent?.trim()) {
                  return el.textContent.trim()
                }
              }
              const cells = element.querySelectorAll('td')
              if (cells.length > 0) {
                const cellTexts = Array.from(cells).map(c => c.textContent?.trim() || '')
                return cellTexts.join('|')
              }
              return ''
            }

            const filingNumber = getText([
              '[class*="filing"]',
              '[class*="number"]',
              '[class*="file"]',
              'td:nth-child(1)',
              '.filing-number',
              '.filing-id'
            ]).split('|')[0] || ''

            const debtorName = getText([
              '[class*="debtor"]',
              '[class*="name"]',
              'td:nth-child(2)',
              '.debtor-name',
              '.debtor'
            ]).split('|')[1] || getText([
              '[class*="debtor"]',
              '[class*="name"]'
            ]).split('|')[0] || ''

            const securedParty = getText([
              '[class*="secured"]',
              '[class*="party"]',
              '[class*="creditor"]',
              'td:nth-child(3)',
              '.secured-party',
              '.creditor'
            ]).split('|')[2] || getText([
              '[class*="secured"]',
              '[class*="party"]',
              '[class*="creditor"]'
            ]).split('|')[0] || ''

            const filingDate = getText([
              '[class*="date"]',
              'td:nth-child(4)',
              '.filing-date',
              '.date'
            ]).split('|')[3] || getText([
              '[class*="date"]'
            ]).split('|')[0] || ''

            const status = getText([
              '[class*="status"]',
              'td:nth-child(5)',
              '.status'
            ]).split('|')[4] || getText([
              '[class*="status"]'
            ]).split('|')[0] || 'active'

            const collateral = getText([
              '[class*="collateral"]',
              'td:nth-child(6)',
              '.collateral'
            ]).split('|')[5] || getText([
              '[class*="collateral"]'
            ]).split('|')[0] || ''

            if (filingNumber || debtorName) {
              results.push({
                filingNumber,
                debtorName,
                securedParty,
                filingDate,
                collateral,
                status: status.toLowerCase().includes('active') ? 'active' :
                       status.toLowerCase().includes('terminated') ? 'terminated' :
                       status.toLowerCase().includes('lapsed') ? 'lapsed' : 'active',
                filingType: filingNumber.toUpperCase().includes('UCC-3') || filingNumber.toUpperCase().includes('AMENDMENT') ? 'UCC-3' : 'UCC-1'
              })
            }
          } catch (err) {
            errors.push(`Error parsing element ${index}: ${err instanceof Error ? err.message : String(err)}`)
          }
        })

        return { filings: results, errors }
      })

      // Validate filings and collect errors
      const { validatedFilings, validationErrors } = this.validateFilings(rawFilings, parseErrors)

      if (validationErrors.length > 0) {
        this.log('warn', 'Some filings had parsing or validation errors', {
          companyName,
          errorCount: validationErrors.length,
          errors: validationErrors
        })
      }

      this.log('info', 'Filings scraped and validated', {
        companyName,
        rawCount: rawFilings.length,
        validCount: validatedFilings.length,
        errorCount: validationErrors.length
      })

      return {
        success: true,
        filings: validatedFilings,
        searchUrl,
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
   * Texas UCC portal requires login, so we return the main portal page
   */
  getManualSearchUrl(companyName: string): string {
    // Texas UCC search requires authentication
    // Return the main portal page where users can log in
    return this.config.baseUrl
  }
}
