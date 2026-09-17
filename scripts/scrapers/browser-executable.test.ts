import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveBrowserExecutablePath } from '../../server/utils/browser-executable'
import { BaseScraper } from './base-scraper'
import { CaliforniaUCCScraperPuppeteer } from './ca-ucc-scraper-puppeteer'
import { NYUCCPortalScraper } from '../../apps/web/src/lib/scrapers/NYUCCPortalScraper'

const launchers = vi.hoisted(() => ({ stealth: vi.fn(), playwright: vi.fn() }))

vi.mock('puppeteer-extra', () => ({
  default: { use: vi.fn(), launch: launchers.stealth }
}))

vi.mock('puppeteer-extra-plugin-stealth', () => ({
  default: vi.fn(() => ({ name: 'stealth' }))
}))

vi.mock('playwright', () => ({
  chromium: { launch: launchers.playwright }
}))

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'ucc-browser-path-'))
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('PUPPETEER_EXECUTABLE_PATH', undefined)
  vi.stubEnv('CHROMIUM_EXECUTABLE_PATH', undefined)
  launchers.stealth.mockReset().mockRejectedValue(new Error('test stopped before navigation'))
  launchers.playwright.mockReset().mockRejectedValue(new Error('test stopped before navigation'))
  vi.spyOn(
    BaseScraper.prototype as unknown as { sleep(ms: number): Promise<void> },
    'sleep'
  ).mockResolvedValue(undefined)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  rmSync(directory, { recursive: true, force: true })
})

describe('configured browser executable', () => {
  it('requires an explicitly provisioned executable in production', () => {
    expect(() => resolveBrowserExecutablePath()).toThrow(/installed or mounted Chromium/)
  })

  it.each(['development', 'test'])('retains library defaults in %s when unconfigured', (mode) => {
    expect(resolveBrowserExecutablePath({ NODE_ENV: mode })).toBeUndefined()
  })

  it.each(['PUPPETEER_EXECUTABLE_PATH', 'CHROMIUM_EXECUTABLE_PATH'])(
    'accepts a valid absolute executable through %s',
    (key) => {
      expect(
        resolveBrowserExecutablePath({ NODE_ENV: 'production', [key]: process.execPath })
      ).toBe(process.execPath)
    }
  )

  it('permits matching aliases but refuses conflicting executables', () => {
    expect(
      resolveBrowserExecutablePath({
        PUPPETEER_EXECUTABLE_PATH: process.execPath,
        CHROMIUM_EXECUTABLE_PATH: process.execPath
      })
    ).toBe(process.execPath)
    expect(() =>
      resolveBrowserExecutablePath({
        PUPPETEER_EXECUTABLE_PATH: process.execPath,
        CHROMIUM_EXECUTABLE_PATH: '/different/browser'
      })
    ).toThrow(/conflict/)
  })

  it.each(['relative/browser', '/missing/ucc-test-browser'])(
    'rejects unusable path %s',
    (value) => {
      expect(() => resolveBrowserExecutablePath({ PUPPETEER_EXECUTABLE_PATH: value })).toThrow(
        /nonempty executable file/
      )
    }
  )

  it('refuses directories and empty executable placeholders', () => {
    expect(() => resolveBrowserExecutablePath({ PUPPETEER_EXECUTABLE_PATH: directory })).toThrow(
      /nonempty executable file/
    )
    const empty = join(directory, 'empty')
    writeFileSync(empty, '', { mode: 0o755 })
    expect(() => resolveBrowserExecutablePath({ PUPPETEER_EXECUTABLE_PATH: empty })).toThrow(
      /nonempty executable file/
    )
  })

  it.skipIf(process.platform === 'win32')('refuses a non-executable file', () => {
    const file = join(directory, 'not-executable')
    writeFileSync(file, '#!/bin/sh\nexit 0\n')
    chmodSync(file, 0o644)
    expect(() => resolveBrowserExecutablePath({ PUPPETEER_EXECUTABLE_PATH: file })).toThrow(
      /nonempty executable file/
    )
  })
})

describe('production launcher boundaries', () => {
  it('refuses CA and both NY search paths before launching when configuration is missing', async () => {
    const ca = await new CaliforniaUCCScraperPuppeteer().search('Example')
    const ny = new NYUCCPortalScraper()
    const debtor = await ny.searchByDebtorName('Example')
    const filing = await ny.searchByFilingNumber('123')

    expect(ca.success).toBe(false)
    expect(ca.error).toMatch(/PUPPETEER_EXECUTABLE_PATH/)
    for (const result of [debtor, filing]) {
      expect(result.success).toBe(false)
      expect(result.errors.join(' ')).toMatch(/PUPPETEER_EXECUTABLE_PATH/)
    }
    expect(launchers.stealth).not.toHaveBeenCalled()
    expect(launchers.playwright).not.toHaveBeenCalled()
  })

  it('forwards one configured executable to CA and both NY launchers without navigating', async () => {
    vi.stubEnv('PUPPETEER_EXECUTABLE_PATH', process.execPath)

    await new CaliforniaUCCScraperPuppeteer().search('Example')
    const ny = new NYUCCPortalScraper()
    await ny.searchByDebtorName('Example')
    await ny.searchByFilingNumber('123')

    expect(launchers.stealth).toHaveBeenCalled()
    expect(launchers.playwright).toHaveBeenCalledTimes(2)
    for (const call of [...launchers.stealth.mock.calls, ...launchers.playwright.mock.calls]) {
      expect(call[0]).toEqual(expect.objectContaining({ executablePath: process.execPath }))
    }
  })
})
