/**
 * What the report shows about a test, beyond Playwright's own clicks and fills:
 *
 *   step('Pay ₹118 by Cash', async () => { ... })   a named step; the actions inside nest under it
 *   note('Invoice submitted: ACC-SINV-2026-00123')   a value the test captured, as a line in the report
 *
 * Used by page objects (one step per user action) and fixtures (set-up, captured values), so specs
 * stay as they are and every test reads well in the report. Values are masked by reporting-labs
 * (passwords, payment details: reporting-labs.config.js); never put a password in a step title.
 */
const { test } = require('@playwright/test')
const { log } = require('reporting-labs')

/**
 * A named step. `box: true` makes a failure inside it point at the test line that called the
 * page-object method (the spec), not at a line inside the page object.
 */
function step(title, body) {
  if (!insideTest()) return body() // the seed and `npm run check` use the same code, outside any test
  return test.step(title, body, { box: true })
}

/** A line in the report (await it). Ignored outside a test. */
async function note(message) {
  if (insideTest()) await log(message)
}

function insideTest() {
  try {
    test.info()
    return true
  } catch {
    return false
  }
}

module.exports = { step, note }
