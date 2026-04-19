import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

const base = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: (process.env.CI ? 'github' : 'list') as 'github' | 'list',
  use: {
    baseURL,
    trace: 'on-first-retry' as const,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
} satisfies PlaywrightTestConfig

const config: PlaywrightTestConfig = process.env.PLAYWRIGHT_NO_WEBSERVER
  ? base
  : {
      ...base,
      webServer: {
        command: 'pnpm dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
    }

export default defineConfig(config)
