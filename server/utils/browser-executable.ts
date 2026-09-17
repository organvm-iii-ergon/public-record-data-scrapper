import { accessSync, constants, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'

export function resolveBrowserExecutablePath(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const puppeteerPath = env.PUPPETEER_EXECUTABLE_PATH?.trim()
  const chromiumPath = env.CHROMIUM_EXECUTABLE_PATH?.trim()
  if (puppeteerPath && chromiumPath && puppeteerPath !== chromiumPath) {
    throw new Error(
      'PUPPETEER_EXECUTABLE_PATH and CHROMIUM_EXECUTABLE_PATH conflict; configure one Chromium executable for every launcher.'
    )
  }

  const executablePath = puppeteerPath || chromiumPath
  if (!executablePath) {
    if (env.NODE_ENV === 'production') {
      throw new Error(
        'Browser scraping requires an installed or mounted Chromium executable in production. Set PUPPETEER_EXECUTABLE_PATH (or CHROMIUM_EXECUTABLE_PATH); npm ci --ignore-scripts does not install a browser.'
      )
    }
    return undefined
  }

  const invalidPath =
    'Configured Chromium executable must be an absolute path to a nonempty executable file. Install or mount Chromium and set PUPPETEER_EXECUTABLE_PATH (or CHROMIUM_EXECUTABLE_PATH).'
  if (!isAbsolute(executablePath)) {
    throw new Error(invalidPath)
  }

  try {
    const executable = statSync(executablePath)
    if (!executable.isFile() || executable.size === 0) {
      throw new Error(invalidPath)
    }
    accessSync(executablePath, constants.X_OK)
  } catch {
    throw new Error(invalidPath)
  }

  return executablePath
}
