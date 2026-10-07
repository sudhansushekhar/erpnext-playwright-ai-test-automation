/**
 * Layer 1 of the fixtures: configuration, data, people and API sessions. No browser pages here.
 */
const fs = require('fs')
const base = require('@playwright/test')
const { ENV } = require('../../config/env')
const { FrappeClient } = require('../api/FrappeClient')

const test = base.test.extend({
  /** Base URL and credentials (config/env.js, from .env). */
  env: async ({}, use) => {
    await use(ENV)
  },

  /** The data the seed prepared (.results/test-data.json): company, items, tills, people... */
  testData: async ({}, use) => {
    if (!fs.existsSync(ENV.testDataFile)) throw new Error(`${ENV.testDataFile} is missing: the seed did not run`)
    await use(JSON.parse(fs.readFileSync(ENV.testDataFile, 'utf8')))
  },

  /**
   * The people of the tests, by role: { admin, cashier, secondCashier, manager }, each with
   * email, name, password and (cashiers) their till. A spec says `users.cashier`, never an email.
   */
  users: async ({ testData, env }, use) => {
    const person = (u) => ({
      email: u.email,
      name: `${u.first} ${u.last}`,
      password: env.demoUserPassword,
      till: testData.tills.find((t) => t.users.includes(u.email))?.name,
    })
    const withRole = (role) => testData.users.filter((u) => u.role === role).map(person)
    const [cashier, secondCashier] = withRole('Cashier')
    await use({
      admin: { email: env.adminUser, name: 'Administrator', password: env.adminPassword },
      cashier, // Anjali Verma, Till 1
      secondCashier, // Rohit Kumar, Till 2
      manager: withRole('Store Manager')[0], // Meera Nair
    })
  },

  /** A REST session signed in as Administrator: set up data, read back records by name. */
  api: async ({}, use) => {
    const api = await FrappeClient.signIn(ENV.baseUrl, ENV.adminUser, ENV.adminPassword)
    await use(api)
    await api.dispose()
  },

  /** A REST client on the browser's own session: what the server thinks of THIS browser. */
  session: async ({ page }, use) => {
    await use(FrappeClient.fromContext(page.request))
  },
})

module.exports = { test }
