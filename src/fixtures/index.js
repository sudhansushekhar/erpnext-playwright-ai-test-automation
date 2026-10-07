/**
 * Everything a spec needs comes from here: `test`, `expect`, the report helpers, and the fixtures.
 *
 *   const { test, expect, meta } = require('../../src/fixtures')
 *   test('TC-POS-001 ...', { tag: ['@smoke'] }, async ({ pos, api, testData }) => { ... })
 *
 * The fixtures, in three layers (each file extends the one before):
 *
 *   base.js   env            base URL and credentials (.env)
 *             testData       what the seed prepared: company, items, prices, tills (docs/test-data.md)
 *             users          the people by role: users.admin / cashier / secondCashier / manager
 *             api            REST session as Administrator: set up data, read back records by name
 *             session        REST client on the browser's own session (who is signed in here?)
 *   pages.js  loginPage      the sign-in screen
 *             deskPage       any desk page (open by path, what it shows)
 *             posPage        the Point of Sale screen (not signed in, nothing opened)
 *             secondDevice   a second browser: { page, loginPage, deskPage, session }
 *   pos.js    tills          open / close tills through the API
 *             till           the cashier's till, opened before the test and closed (checked) after
 *             pos            the Point of Sale, cashier signed in, till open: ready to sell
 *             posWithoutTill the second cashier on the Point of Sale, no till open: the opening dialog
 *
 * A fixture is set up only when a test names it, and torn down after the test, even a failed one.
 */
const { expect } = require('@playwright/test')
const { test } = require('./pos')

// Report helpers (reporting-labs):
//   meta({...})        priority, severity, owner, feature, story (= requirement ID) from the test case
//   log('...')         a timestamped line in the report
//   reportData(obj)    the data a test used, as a table in the report (reporting-labs calls it
//                      testData; renamed so it does not clash with the testData fixture)
const { meta, log, testData: reportData } = require('reporting-labs')

module.exports = { test, expect, meta, log, reportData }
