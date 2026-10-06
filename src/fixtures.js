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
 */
const fs = require('fs')
const base = require('@playwright/test')
const { ENV } = require('../config/env')
const { FrappeClient } = require('./api/FrappeClient')
const { LoginPage } = require('./pages/LoginPage')

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
})

// Report helpers (reporting-labs), so specs import everything from this one file:
//   meta({...})        priority, severity, owner, feature, story (= requirement ID) from the test case
//   log('...')         a timestamped line in the report
//   reportData(obj)    the data a test used, as a table in the report (reporting-labs calls it
//                      testData; renamed here so it does not clash with the testData fixture)
const { meta, log, testData: reportData } = require('reporting-labs')

module.exports = { test, expect: base.expect, meta, log, reportData }
