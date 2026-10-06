/**
 * reporting-labs: the HTML report of a test run (https://github.com/naveenautomationlabs/reporting-labs).
 *
 * One file, .results/reporting-labs/index.html: failures ranked by priority, filters by feature and
 * owner, run history (new vs known failures, flaky, slower), plain-English failure reasons, every
 * API call the tests made, screenshots and traces, and a Bug Report button on each failure.
 *
 * Each test says what it is with meta() (src/fixtures.js re-exports it), taken from its test case:
 *   meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-012' })
 */
require('dotenv').config({ quiet: true })

const REPO = 'https://github.com/sudhansushekhar/erpnext-playwright-ai-test-automation'

module.exports = {
  title: 'ERPNext POS · India',
  project: {
    name: 'ERPNext Playwright AI Test Automation',
    team: 'QA',
    description: 'ERPNext v16 + Retail POS India: tests written from requirements with an AI agent, reviewed by a tester',
  },
  metadata: {
    env: process.env.TEST_ENV || 'local docker',
    branch: process.env.GITHUB_REF_NAME || 'local',
  },

  outputFolder: '.results/reporting-labs',
  open: 'never', // `npm run report` opens it
  history: { enabled: true, file: '.results/reporting-labs.history.json', keep: 30 },

  // A requirement ID in meta({ story }) opens that requirement in the PRD on GitHub.
  links: {
    story: `${REPO}/blob/main/docs/requirements/pos-sale-prd.md#:~:text={id}`,
  },

  // Never show the local passwords (they are also masked by name, this catches them anywhere).
  maskValues: [process.env.ADMIN_PASSWORD, process.env.DEMO_USER_PASSWORD].filter(Boolean),
  maskKeys: ['rpi_card_last4', 'rpi_upi_reference'],
}
