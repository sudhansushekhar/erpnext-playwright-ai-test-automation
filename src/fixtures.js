/**
 * Every spec takes `test` and `expect` from here, never from @playwright/test.
 *
 *   const { test, expect, meta } = require('../../src/fixtures')
 *   test('...', { tag: ['@smoke'] }, async ({ loginPage, session, testData, api }) => { ... })
 *
 *   env        base URL and credentials (config/env.js)
 *   testData   the test data the seed prepared: names of the company, customer, item (.results/test-data.json)
 *   api        a REST session signed in as Administrator, disposed after the test
 *   session    a REST client on the browser's own session (page.request): what the server
 *              thinks of THIS browser, e.g. session.sessionUser()
 *   loginPage  the sign-in screen
 *   desk       any desk page (open by path, what it shows)
 *   secondDevice  a page in a second browser (its own cookies): another device or another user
 *   till       the cashier's till, open: Anjali on Till 1 with the opening float (POS Opening Entry,
 *              through the API). Closed after the test, even a failed one, and checked Closed.
 *   pos        the Point of Sale, signed in as the till's cashier, ready to sell
 *   posNoTill  the Point of Sale for Rohit (Till 2) with no open till: the opening dialog
 *
 * A till can have one open session and a cashier one device, so POS tests on one till run one at a time.
 */
const fs = require('fs')
const base = require('@playwright/test')
const { ENV } = require('../config/env')
const { FrappeClient } = require('./api/FrappeClient')
const { LoginPage } = require('./pages/LoginPage')
const { PosPage } = require('./pages/PosPage')
const { DeskPage } = require('./pages/DeskPage')
const { openTill, closeTill, closeOpenTillsOf } = require('./api/till')

const test = base.test.extend({
  env: async ({}, use) => {
    await use(ENV)
  },

  testData: async ({}, use) => {
    if (!fs.existsSync(ENV.testDataFile)) throw new Error(`${ENV.testDataFile} is missing: the seed did not run`)
    await use(JSON.parse(fs.readFileSync(ENV.testDataFile, 'utf8')))
  },

  api: async ({}, use) => {
    const api = await FrappeClient.signIn(ENV.baseUrl, ENV.adminUser, ENV.adminPassword)
    await use(api)
    await api.dispose()
  },

  session: async ({ page }, use) => {
    await use(FrappeClient.fromContext(page.request))
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },

  desk: async ({ page }, use) => {
    await use(new DeskPage(page))
  },

  secondDevice: async ({ browser, env }, use) => {
    const context = await browser.newContext({ baseURL: env.baseUrl, viewport: { width: 1440, height: 900 } })
    await use(await context.newPage())
    await context.close()
  },

  till: async ({ api, testData }, use) => {
    const [till] = testData.tills // Till 1, Anjali
    const cashier = till.users[0]
    const timeZone = testData.timezone
    await closeOpenTillsOf(api, cashier, { timeZone }) // left open by a run that crashed
    const opening = await openTill(api, {
      company: testData.company, posProfile: till.name, user: cashier,
      openingCash: testData.posProfile.openingCash, timeZone,
    })
    await use({ name: till.name, cashier, opening })
    // The last step of every POS test: close the till, and make sure it is closed.
    await closeTill(api, opening, { timeZone })
    base.expect((await api.getDoc('POS Opening Entry', opening)).status, `till session ${opening}`).toBe('Closed')
  },

  pos: async ({ page, till, env }, use) => {
    const pos = new PosPage(page)
    await pos.open(till.cashier, env.demoUserPassword)
    await pos.ready()
    await use(pos)
  },

  posNoTill: async ({ page, api, testData, env }, use) => {
    const cashier = testData.tills[1].users[0] // Rohit, Till 2
    await closeOpenTillsOf(api, cashier, { timeZone: testData.timezone })
    const pos = new PosPage(page)
    await pos.open(cashier, env.demoUserPassword)
    await pos.openingDialog.waitFor()
    await use(pos)
  },
})

// Report helpers (reporting-labs), so specs import everything from this one file:
//   meta({...})        priority, severity, owner, feature, story (= requirement ID) from the test case
//   log('...')         a timestamped line in the report
//   reportData(obj)    the data a test used, as a table in the report (reporting-labs calls it
//                      testData; renamed here so it does not clash with the testData fixture)
const { meta, log, testData: reportData } = require('reporting-labs')

module.exports = { test, expect: base.expect, meta, log, reportData }
