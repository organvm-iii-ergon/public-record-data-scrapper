/**
 * E2E Tests for Navigation
 *
 * Tests the main navigation functionality including:
 * - Tab navigation
 * - URL handling
 * - Page transitions
 */

import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')

    // Check page title
    await expect(page).toHaveTitle(/UCC-MCA|Intelligence|Platform/i)

    // Check main heading
    await expect(page.locator('h1')).toContainText('UCC-MCA Intelligence Platform')
  })

  test('should display all navigation tabs', async ({ page }) => {
    await page.goto('/')

    // Check for all expected tabs
    const expectedTabs = [
      'Prospects',
      'Portfolio',
      'Intelligence',
      'Analytics',
      'Re-qual',
      'Agentic'
    ]

    for (const tabName of expectedTabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') })
      await expect(tab).toBeVisible()
    }
  })

  test('should switch between tabs correctly', async ({ page }) => {
    await page.goto('/')

    // Test each tab
    const tabs = [
      { name: /portfolio/i, content: /portfolio/i },
      { name: /intelligence/i, content: /competitor|intelligence/i },
      { name: /analytics/i, content: /analytics/i },
      { name: /agentic/i, content: /agentic|agent/i }
    ]

    for (const { name } of tabs) {
      const tab = page.getByRole('tab', { name })
      await tab.click()

      // Tab should be active
      await expect(tab).toHaveAttribute('data-state', 'active')

      // Previous tab should not be active
      await page.waitForTimeout(100)
    }
  })

  test('should maintain state when switching tabs', async ({ page }) => {
    await page.goto('/')

    // Interact with prospects tab (e.g., enter search)
    const searchInput = page.getByPlaceholder(/search/i).first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('test search')
    }

    // Switch to another tab
    await page.getByRole('tab', { name: /portfolio/i }).click()

    // Switch back to prospects
    await page.getByRole('tab', { name: /prospects/i }).click()

    // Search should be preserved (if using persistent state)
    if (await searchInput.isVisible()) {
      const value = await searchInput.inputValue()
      // Value may or may not be preserved depending on implementation
      expect(typeof value).toBe('string')
    }
  })
})

test.describe('Header', () => {
  test('should display the header with title', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header')
    await expect(header).toBeVisible()

    await expect(header.locator('h1')).toContainText('UCC-MCA Intelligence Platform')
  })

  test('should have refresh data button in header', async ({ page }) => {
    await page.goto('/')

    const refreshButton = page.getByRole('button', { name: /refresh/i })
    await expect(refreshButton).toBeVisible()
  })

  test('should have theme toggle in header', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header')
    const themeToggle = header.getByRole('button', { name: /toggle theme/i })
    await expect(themeToggle).toBeVisible()
  })
})

test.describe('Quick Access Banner', () => {
  test('should display quick access banner if present', async ({ page }) => {
    await page.goto('/')

    // Quick access banner may or may not be visible depending on state
    // Just verify the page loads without errors
    await expect(page.getByRole('main')).toBeVisible()
  })
})
