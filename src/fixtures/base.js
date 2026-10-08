/**
 * Layer 1 of the fixtures: configuration, data, the worker's billing counter, people and API sessions.
 * No browser pages here.
 *
 * Worker fixtures ({ scope: 'worker' }) are set up once per worker and shared by its tests;
 * the others are set up for each test that names them.
 */
const fs = require('fs')
const base = require('@playwright/test')
const { ENV } = require('../../config/env')
const { FrappeClient } = require('../api/FrappeClient')

const test = base.test.extend({
  /** Base URL and credentials (config/env.js, from .env). */
  env: [async ({}, use) => {
    await use(ENV)
  }, { scope: 'worker' }],

  /** The data the seed prepared (.results/test-data.json): company, items, billing counters, people... */
  testData: [async ({}, use) => {
    if (!fs.existsSync(ENV.testDataFile)) throw new Error(`${ENV.testDataFile} is missing: the seed did not run`)
    await use(JSON.parse(fs.readFileSync(ENV.testDataFile, 'utf8')))
  }, { scope: 'worker' }],

  /**
   * This worker's billing counter: { number, name, cashier, item }. Tests running at the same time
   * are at different counters, so they never share a cashier (one sign-in), a counter (one open
   * shift) or the stock of an item. Worker 1 → Billing Counter 1 (Anjali, QA-STOCK-001), worker 2 →
   * Billing Counter 2...
   */
  counter: [async ({ testData }, use, workerInfo) => {
    const counters = testData.billingCounters
    const counter = counters[workerInfo.parallelIndex]
    if (!counter) {
      throw new Error(
        `Worker ${workerInfo.parallelIndex + 1} has no billing counter: there are ${counters.length}. ` +
        `Run with WORKERS=${counters.length} or fewer, or add a counter in src/seed/data.js.`,
      )
    }
    await use(counter)
  }, { scope: 'worker' }],

  /**
   * The people of the tests, by role: { admin, cashier, manager }, each with email, name and
   * password. `users.cashier` is this counter's cashier, with her `counter` (its name). A spec says `users.cashier`,
   * never an email.
   */
  users: [async ({ testData, counter, env }, use) => {
    const person = (user) => ({ email: user.email, name: `${user.first} ${user.last}`, password: env.demoUserPassword })
    await use({
      admin: { email: env.adminUser, name: 'Administrator', password: env.adminPassword },
      cashier: { ...person(counter.cashier), counter: counter.name }, // this worker's counter and its cashier
      manager: person(testData.users.find((user) => user.role === 'Store Manager')), // Meera Nair
    })
  }, { scope: 'worker' }],

  /**
   * A REST session to set up data and read back records by name, signed in as the tests' own
   * automation user (Admin roles), once per worker. Not Administrator: an Administrator sign-in from
   * a parallel worker while a browser page of Administrator loads shows "Server Error" (rule 12).
   */
  api: [async ({ testData, env }, use) => {
    const api = await FrappeClient.signIn(env.baseUrl, testData.automationUser, env.demoUserPassword)
    await use(api)
    await api.dispose()
  }, { scope: 'worker' }],

  /** A REST client on the browser's own session: what the server thinks of THIS browser. */
  session: async ({ page }, use) => {
    await use(FrappeClient.fromContext(page.request))
  },
})

module.exports = { test }
