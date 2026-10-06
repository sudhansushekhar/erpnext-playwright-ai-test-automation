// @ts-check
/**
 * Playwright configuration
 *
 *   globalSetup → src/seed/globalSetup.js prepares the test data (company, customer, item)
 *                 through the REST API before any test runs, and writes .results/test-data.json
 *   chromium    → every spec on Chromium
 *   webkit      → every spec on WebKit (Safari's engine)
 *
 * Rules that live here on purpose (see CLAUDE.md):
 *   - retries: 0. A retry hides the flakiness this suite exists to show.
 *   - No grep/testIgnore here. Narrowing happens only on the command line (--grep @smoke).
 */
const { defineConfig, devices } = require('@playwright/test')
const { ENV } = require('./config/env')

const isCI = !!process.env.CI

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  outputDir: '.results/test-results',
  globalSetup: require.resolve('./src/seed/globalSetup'),

  timeout: 60 * 1000,
  expect: { timeout: 10 * 1000 },

  retries: 0,
  forbidOnly: isCI,
  fullyParallel: false,
  workers: Number(process.env.WORKERS) || 1,

  reporter: [
    isCI ? ['github'] : ['list'],
    ['html', { outputFolder: '.results/html', open: 'never' }],
    ['json', { outputFile: '.results/results.json' }],
  ],

  use: {
    baseURL: ENV.baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
})
