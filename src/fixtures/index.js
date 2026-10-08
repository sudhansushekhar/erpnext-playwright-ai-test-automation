/**
 * Everything a spec needs comes from here: `test`, `expect`, the report helpers, and the fixtures.
 *
 *   const { test, expect, meta } = require('../../src/fixtures')
 *   test('TC-POS-001 ...', { tag: ['@smoke'] }, async ({ pos, api, testData }) => { ... })
 *
 * The fixtures, in three layers (each file extends the one before):
 *
 *   base.js   env            base URL and credentials (.env)                                     [worker]
 *             testData       what the seed prepared: company, items, billing counters (docs/test-data.md) [worker]
 *             counter        this worker's billing counter: { number, name, cashier, item }        [worker]
 *             users          the people by role: users.admin / cashier (the counter's) / manager [worker]
 *             api            REST session as the automation user: set up data, read records by name [worker]
 *             session        REST client on the browser's own session (who is signed in here?)
 *   pages.js  loginPage      the sign-in screen
 *             deskPage       any desk page (open by path, what it shows)
 *             posPage        the Point of Sale screen (not signed in, nothing opened)
 *             secondDevice   a second browser: { page, loginPage, deskPage, session }
 *   pos.js    shifts         open / close shifts through the API                                 [worker]
 *             sales          make POS sales through the API (a sale to return)                   [worker]
 *             shift          the cashier's shift, opened before the test and closed (checked) after
 *             pos            the Point of Sale, cashier signed in, shift open: ready to sell
 *             posBeforeOpening the Point of Sale before the shift is opened: the opening dialog
 *
 * A fixture is set up only when a test names it, and torn down after the test, even a failed one.
 * [worker] fixtures are set up once per worker and shared by its tests (torn down when it ends).
 *
 * Parallel runs: each worker has its own billing counter (cashier, POS Profile, stock item), so tests
 * running at the same time never share one. WORKERS=n runs n counters at once (n ≤ the counters in
 * src/seed/data.js).
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
