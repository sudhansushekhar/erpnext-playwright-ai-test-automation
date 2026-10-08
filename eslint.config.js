/**
 * `npm run lint`: the CLAUDE.md rules a machine can check, for people and AI agents alike.
 * It runs in CI, and after every file an AI agent edits (.claude/settings.json).
 *
 *   tests/**   rule 2  test/expect from src/fixtures only; page objects and API come as fixtures
 *              rule 4  no locators in specs (they live in src/pages)
 *              rule 6  no page.waitForTimeout
 *              rule 9  no .only / .skip / .fixme / .fail
 *              rule 4  every expect has a message (its title in the report)
 *   src/**     rule 6  no page.waitForTimeout either
 */
const js = require('@eslint/js')
const globals = require('globals')
const playwright = require('eslint-plugin-playwright')

const LOCATOR_METHODS = 'locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId|getByTitle|getByAltText|\\$|\\$\\$|\\$eval|\\$\\$eval'

module.exports = [
  { ignores: ['node_modules/', '.results/'] },

  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-empty-pattern': 'off', // Playwright fixtures that need no other fixture: async ({}, use)
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
    },
  },

  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } }, // page.evaluate callbacks run in the page
    plugins: { playwright },
    rules: { 'playwright/no-wait-for-timeout': 'error' },
  },

  {
    files: ['tests/**/*.spec.js'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-force-option': 'error',
      'playwright/missing-playwright-await': 'error',
      // Every check has a message, e.g. expect(qty, 'Stock is exactly 1 lower'): it is the check's title in the report.
      'playwright/valid-expect': ['error', { minArgs: 2 }],
      'no-restricted-syntax': ['error',
        {
          selector: "CallExpression[callee.name='require'][arguments.0.value='@playwright/test']",
          message: 'Rule 2: import test and expect from src/fixtures.',
        },
        {
          // A selector regex cannot hold "/", so "." stands for it: src/pages, src/api, src/seed, src/fixtures/<file>.
          selector: "CallExpression[callee.name='require'][arguments.0.value=/src.(pages|api|seed|fixtures.)/]",
          message: 'Rule 2/4: page objects, the API and data come as fixtures (src/fixtures/index.js); pure helpers from src/utils.',
        },
        {
          selector: `CallExpression[callee.property.name=/^(${LOCATOR_METHODS})$/]`,
          message: 'Rule 4: no locators in specs. Add a method or property to a page object in src/pages.',
        },
        {
          selector: 'CallExpression[callee.object.name="test"][callee.property.name=/^(fixme|fail)$/]',
          message: 'Rule 9: nothing switched off. Fix the test, or quarantine it (rule 8).',
        },
      ],
    },
  },
]
