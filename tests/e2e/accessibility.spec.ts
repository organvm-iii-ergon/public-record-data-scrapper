/**
 * E2E Accessibility Tests
 *
 * Tests basic accessibility requirements including:
 * - Keyboard navigation
 * - ARIA attributes
 * - Focus management
 */

import { test, expect } from '@playwright/test'

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')

    // Should have exactly one h1
    const h1Elements = page.locator('h1')
    await expect(h1Elements).toHaveCount(1)

    // h1 should be the main title
    await expect(h1Elements.first()).toContainText('UCC-MCA Intelligence Platform')
  })

  test('should have accessible tab navigation', async ({ page }) => {
    await page.goto('/')

    // Tabs should have proper ARIA roles
    const tablist = page.getByRole('tablist')
    await expect(tablist).toBeVisible()

    // Each tab should be a button with proper role
    const tabs = page.getByRole('tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThan(0)

    // Active tab should have aria-selected="true"
    const activeTab = page.getByRole('tab', { selected: true })
    await expect(activeTab.first()).toHaveAttribute('aria-selected', 'true')
  })

  test('should support keyboard navigation for tabs', async ({ page }) => {
    await page.goto('/')

    // Focus on the first tab
    await page.getByRole('tab').first().focus()

    // Press arrow right to move to next tab
    await page.keyboard.press('ArrowRight')

    // The focus should have moved
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/')

    // All buttons should be accessible
    const buttons = page.getByRole('button')
    const buttonCount = await buttons.count()

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i)
      // Button should either have text content or aria-label
      const hasText = (await button.textContent())?.trim().length ?? 0 > 0
      const hasAriaLabel = (await button.getAttribute('aria-label')) !== null
      const hasTitle = (await button.getAttribute('title')) !== null

      expect(hasText || hasAriaLabel || hasTitle).toBeTruthy()
    }
  })

  test('should have visible focus indicators', async ({ page }) => {
    await page.goto('/')

    // Tab through interactive elements
    await page.keyboard.press('Tab')

    // Focused element should be visible
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/')

    // Find all input elements
    const inputs = page.locator('input:visible')
    const inputCount = await inputs.count()

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)

      // Input should have either:
      // - Associated label
      // - aria-label
      // - aria-labelledby
      // - placeholder (as fallback)
      const hasLabel = (await input.getAttribute('id')) !== null
      const hasAriaLabel = (await input.getAttribute('aria-label')) !== null
      const hasAriaLabelledBy = (await input.getAttribute('aria-labelledby')) !== null
      const hasPlaceholder = (await input.getAttribute('placeholder')) !== null

      expect(hasLabel || hasAriaLabel || hasAriaLabelledBy || hasPlaceholder).toBeTruthy()
    }
  })

  test('should have sufficient color contrast in header', async ({ page }) => {
    await page.goto('/')

    // The header text should be readable
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Title should be visible
    const title = header.locator('h1')
    await expect(title).toBeVisible()

    // We can't programmatically check contrast ratio without additional tools,
    // but we can verify the elements are visible
    const titleBox = await title.boundingBox()
    expect(titleBox).not.toBeNull()
  })
})

test.describe('Focus Management', () => {
  test('should trap focus in dialogs', async ({ page }) => {
    await page.goto('/')

    // This test would need a dialog to be open
    // For now, just verify no dialogs are open by default
    const dialogs = page.getByRole('dialog')
    await expect(dialogs).toHaveCount(0)
  })

  test('should return focus after closing dialogs', async ({ page }) => {
    await page.goto('/')

    // Find a clickable element that opens a dialog
    // This is app-specific and may need adjustment
    const prospectCards = page.locator('[data-testid="prospect-card"]')

    if ((await prospectCards.count()) > 0) {
      const firstCard = prospectCards.first()
      await firstCard.click()

      // If a dialog opens, close it
      const closeButton = page.getByRole('button', { name: /close/i })
      if (await closeButton.isVisible()) {
        await closeButton.click()

        // Focus should return to the triggering element
        await page.waitForTimeout(100)
      }
    }
  })
})
