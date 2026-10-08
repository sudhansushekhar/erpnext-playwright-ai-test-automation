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
require('reporting-labs/auto') // records every request / page.request call in the report
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
  // Tests spread over the workers one by one. Each worker has its own billing counter (cashier, POS Profile, stock
  // item; src/seed/data.js), so tests running at the same time share nothing. WORKERS ≤ the counters.
  fullyParallel: true,
  workers: Number(process.env.WORKERS) || 1,

  reporter: [
    isCI ? ['github'] : ['list'],
    ['reporting-labs', require('./reporting-labs.config')], // the main report: npm run report
    ['html', { outputFolder: '.results/html', open: 'never' }], // Playwright's own, for its trace viewer
  ],

  use: {
    baseURL: ENV.baseUrl,
    // Evidence of a failure, kept only when a test fails: the trace (every step, DOM, network,
    // console), a screenshot at the moment it failed, and a video of the test.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
      // Measured: WebKit takes 0.5-1 s per click on the POS screen, so TC-POS-005 (14 key taps)
      // runs about 67 s here against 60 s allowed. A longer limit, never a retry.
      timeout: 120 * 1000,
    },
  ],
})
