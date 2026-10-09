/**
 * Warm the server up after the seed, before any test starts.
 *
 * The seed changes POS Profiles, items and users, which clears ERPNext's caches. Then every worker
 * starts at the same moment, each loading the Point of Sale for its cashier with nothing cached:
 * the first tests of a run were the slowest, and one of them ran out of time (TC-POS-001, 72 s of
 * 60 s, on the first of 10 runs; the other 9 took about 26 s). So, once, for each billing counter's
 * cashier: sign in through the API, load the Point of Sale page (the server builds the cashier's
 * session data) and the Sales Invoice form definition it asks for next, then sign out again.
 *
 * Only reads; changes no data. A failure here is reported, not fatal: the tests still run.
 */
const { request } = require('@playwright/test')
const { ENV } = require('../../config/env')

async function warmUp(testData, { log = console.log } = {}) {
  const started = Date.now()
  const cashiers = testData.billingCounters.map((counter) => counter.cashier.email)
  const results = await Promise.allSettled(cashiers.map((email) => warmUpFor(email)))
  const failed = results.filter((result) => result.status === 'rejected')
  for (const failure of failed) log(`WARM-UP: ${failure.reason.message}`)
  log(`WARM-UP: Point of Sale loaded for ${cashiers.length - failed.length} of ${cashiers.length} cashiers in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

async function warmUpFor(email) {
  const session = await request.newContext({ baseURL: ENV.baseUrl })
  try {
    const signIn = await session.post('/api/method/login', { form: { usr: email, pwd: ENV.demoUserPassword } })
    if (!signIn.ok()) throw new Error(`${email}: sign-in answered HTTP ${signIn.status()}`)
    const page = await session.get('/desk/point-of-sale')
    if (!page.ok()) throw new Error(`${email}: the Point of Sale page answered HTTP ${page.status()}`)
    await session.get('/api/method/frappe.desk.form.load.getdoctype', { params: { doctype: 'Sales Invoice', with_parent: 1 } })
    await session.post('/api/method/logout')
  } finally {
    await session.dispose()
  }
}

module.exports = { warmUp }
