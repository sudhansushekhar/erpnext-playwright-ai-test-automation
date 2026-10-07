/**
 * Layer 3 of the fixtures: the point of sale, with its till opened before and closed after.
 *
 * A till can have one open session and a cashier one device, so the POS tests of one cashier
 * run one at a time (workers: 1). More parallel POS tests need more tills and cashiers (seed).
 */
const { expect } = require('@playwright/test')
const { test: pages } = require('./pages')
const { Tills } = require('../api/tills')

const test = pages.extend({
  /** Open and close tills through the API (as Administrator). */
  tills: async ({ api, testData }, use) => {
    await use(new Tills(api, {
      company: testData.company,
      timeZone: testData.timezone,
      openingCash: testData.posProfile.openingCash,
    }))
  },

  /**
   * The cashier's till, open: { name, cashier, opening }. The prerequisite of every POS sale test.
   * Afterwards, even after a failure, the till is closed and checked Closed: its last step.
   */
  till: async ({ tills, users }, use) => {
    const { email, till } = users.cashier
    await tills.closeAllOf(email) // left open by a run that crashed
    const opening = await tills.open({ till, user: email })
    await use({ name: till, cashier: email, opening })
    await tills.close(opening)
    expect(await tills.status(opening), `till session ${opening}`).toBe('Closed')
  },

  /** The Point of Sale: the cashier signed in, their till open, ready to sell. */
  pos: async ({ posPage, till, users }, use) => {
    await posPage.open(till.cashier, users.cashier.password)
    await posPage.ready()
    await use(posPage)
  },

  /** The Point of Sale for the second cashier, whose till is NOT open: the opening dialog. */
  posWithoutTill: async ({ posPage, tills, users }, use) => {
    const { email, password } = users.secondCashier
    await tills.closeAllOf(email)
    await posPage.open(email, password)
    await posPage.openingDialog.waitFor()
    await use(posPage)
  },
})

module.exports = { test }
