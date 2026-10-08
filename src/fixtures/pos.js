/**
 * Layer 3 of the fixtures: the point of sale, with the cashier's shift opened before and closed after.
 *
 * Everything here uses this worker's billing counter (src/fixtures/base.js) and its cashier. A counter
 * can have one open shift and a cashier one device, so each counter's tests run one at a time, and
 * tests at different counters run in parallel.
 */
const { expect } = require('@playwright/test')
const { test: pages } = require('./pages')
const { Shifts } = require('../api/shifts')
const { Sales } = require('../api/sales')
const { note } = require('../report')

const test = pages.extend({
  /** Open and close shifts through the API. */
  shifts: [async ({ api, testData }, use) => {
    await use(new Shifts(api, {
      company: testData.company,
      timeZone: testData.timezone,
      openingCash: testData.posProfile.openingCash,
    }))
  }, { scope: 'worker' }],

  /** Make POS sales through the API, as prerequisites (a sale to return). */
  sales: [async ({ api, testData }, use) => {
    await use(new Sales(api, testData))
  }, { scope: 'worker' }],

  /**
   * The cashier's shift at her billing counter, open: { counter, cashier, opening }. The prerequisite
   * of every POS sale test. Afterwards, even after a failure, the shift is closed and checked Closed:
   * its last step.
   */
  shift: async ({ shifts, users }, use) => {
    // ── BEFORE the test ─────────────────────────────
    const { email, counter } = users.cashier
    await shifts.closeAllOf(email) // left open by a run that crashed
    const opening = await shifts.open({ counter, user: email })
    await note(`Shift ${opening} opened for ${email} at ${counter}`)

    await use({ counter, cashier: email, opening })

    // ── AFTER the test (even if it failed) ──────────
    const closing = await shifts.close(opening)
    expect(await shifts.status(opening), `shift ${opening}`).toBe('Closed')
    await note(`Shift ${opening} closed (${closing})`)
  },

  /** The Point of Sale: the cashier signed in, her shift open, ready to sell. */
  pos: async ({ posPage, shift, users, testData }, use) => {
    await posPage.open(shift.cashier, users.cashier.password)
    await posPage.ready(testData.posProfile.customer)
    await use(posPage)
  },

  /** The Point of Sale before the cashier's shift is opened: the opening dialog. */
  posBeforeOpening: async ({ posPage, shifts, users }, use) => {
    const { email, password } = users.cashier
    await shifts.closeAllOf(email)
    await posPage.open(email, password)
    await posPage.openingDialog.waitFor()
    await use(posPage)
  },
})

module.exports = { test }
