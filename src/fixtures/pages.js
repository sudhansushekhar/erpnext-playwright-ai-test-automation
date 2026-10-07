/**
 * Layer 2 of the fixtures: page objects on the test's browser page, and a second device.
 * Nothing here signs in or changes data; the page objects are ready to use.
 */
const { test: base } = require('./base')
const { FrappeClient } = require('../api/FrappeClient')
const { LoginPage } = require('../pages/LoginPage')
const { DeskPage } = require('../pages/DeskPage')
const { PosPage } = require('../pages/PosPage')

const test = base.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },

  deskPage: async ({ page }, use) => {
    await use(new DeskPage(page))
  },

  posPage: async ({ page }, use) => {
    await use(new PosPage(page))
  },

  /**
   * A second browser with its own cookies: another device of the same person, or another person.
   * { page, loginPage, deskPage, session }
   */
  secondDevice: async ({ browser, env }, use) => {
    const context = await browser.newContext({ baseURL: env.baseUrl, viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await use({
      page,
      loginPage: new LoginPage(page),
      deskPage: new DeskPage(page),
      session: FrappeClient.fromContext(page.request),
    })
    await context.close()
  },
})

module.exports = { test }
