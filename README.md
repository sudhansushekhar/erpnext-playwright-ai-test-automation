# erpnext-playwright-ai-test-automation

[![ERPNext POS · Playwright E2E](https://github.com/sudhansushekhar/erpnext-playwright-ai-test-automation/actions/workflows/playwright-e2e.yml/badge.svg)](https://github.com/sudhansushekhar/erpnext-playwright-ai-test-automation/actions/workflows/playwright-e2e.yml)

[Test dashboard](https://sudhansushekhar.github.io/erpnext-playwright-ai-test-automation/) (last night's full run and the trend over time)

This is my end-to-end test framework for the ERPNext Point of Sale, set up for an Indian retail store:
GST included in prices, cash, UPI and card payments, several billing counters. It is written in
Playwright (JavaScript).

I built it to try out a way of working I think test teams are heading towards: the tester writes the
test cases in plain English, an AI coding agent writes the tests from them, and the repository itself
keeps the agent honest. The rules are in [CLAUDE.md](CLAUDE.md), most of them are checked by the lint,
the lint runs after every file the agent edits and again in CI, and every mistake the AI made that
review caught is written down in [docs/ai-review-log.md](docs/ai-review-log.md) together with the rule
that now prevents it.

A few things I care about in the tests themselves:

- After the screen saves something, the test reads that exact record back from the server by its name
  and checks it: lines, GST on each line, payments, stock movement. A screen can look right while the
  books are wrong.
- Tests run in parallel without stepping on each other. Each worker gets its own billing counter, with
  its own cashier, POS profile and stock item.
- Nothing is retried and nothing is skipped. Every new test is broken on purpose once, to prove it can fail.

If you want the details: [docs/framework.md](docs/framework.md) explains the structure and design
(with diagrams), and [docs/ai-workflow.md](docs/ai-workflow.md) describes the day-to-day loop with the AI.

## Two repositories

This repository only has tests: requirements, test cases, the specs and the test data. The app under
test and the Docker setup for ERPNext live in [retail_pos_india](https://github.com/sudhansushekhar/retail_pos_india).

## Running it on your machine

You need Git, Node.js 20 or newer, and Docker Desktop (running, with at least 4 GB of memory).

Start ERPNext from the app repository. The first start takes 5 to 15 minutes:

```bash
git clone https://github.com/sudhansushekhar/retail_pos_india.git
cd retail_pos_india
npm run erp:up
npm run erp:app
cd ..
```

Wait until http://localhost:8080/api/method/ping answers `{"message":"pong"}` before running `erp:app`.
Stopping, resetting and backups are in the [app's README](https://github.com/sudhansushekhar/retail_pos_india#run-erpnext-with-this-app-locally-docker).

Then get the tests ready:

```bash
git clone https://github.com/sudhansushekhar/erpnext-playwright-ai-test-automation.git
cd erpnext-playwright-ai-test-automation
cp .env.example .env
npm install
npx playwright install chromium webkit
```

And run them:

```bash
npm run seed
npm run check
npm run test:smoke
npm test
npm run report
```

`seed` builds the test data (a few minutes the first time), `check` should show a green tick on every
line, `test:smoke` runs the quick tests and `npm test` runs everything on Chromium and WebKit.

After that you can sign in at http://localhost:8080 as Administrator / admin. You land on a QA Testing
page that lists every test value. The demo users sign in with `DEMO_USER_PASSWORD` from `.env`.

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Tells you whether the site is ready for the tests, one line per thing it checks. Changes nothing. |
| `npm run seed` | Builds the test data, and repairs anything someone changed by hand. |
| `npm run lint` | The rules a machine can check (no locators in specs, no fixed waits, nothing skipped, readable names), plus a check that every test reads test data that exists. |
| `npm test` / `npm run test:smoke` | Every test on both browsers, or only the `@smoke` ones. |
| `npm run test:chromium` / `npm run test:webkit` | Every test on one browser. |
| `npm run test:headed` | Watch the tests drive the browser (Chromium, one at a time). |
| `npx playwright test tests/pos/sale.spec.js --project=chromium` | One file in one browser. |
| `npx playwright test tests/pos/sale-data.spec.js -g TC-RET-201` | One test, by its test case ID. |
| `npm run report` | The last run's report. `npm run report:playwright` opens Playwright's own report, with traces. |

When something goes wrong:

- `npm install` fails with 403: your global npm registry points somewhere else. The `.npmrc` here fixes
  it for this folder, or run `npm config set registry https://registry.npmjs.org/`.
- The seed fails with HTTP 401: the Administrator password isn't the one in `.env` (on a fresh Docker
  site it is `admin`).
- `npm run check` shows a red cross: run `npm run seed` and check again. Anything the seed can't fix,
  the check tells you how to fix.
- Tests fail on a site you changed by hand: reset it from the app repository (`npm run erp:reset`,
  `erp:up`, `erp:app`), then `npm run seed`.

## CI

The workflow in [.github/workflows/playwright-e2e.yml](.github/workflows/playwright-e2e.yml) runs the
lint first, then starts ERPNext from `retail_pos_india` in Docker, seeds it, runs `npm run check`, and
then the tests.

- On every pull request and push to `main`: the `@smoke` tests on Chromium, about 5 minutes. The report
  is attached to the run.
- Every night at 02:00 IST: every test on Chromium and WebKit. The report is attached and also
  published to the [dashboard](https://sudhansushekhar.github.io/erpnext-playwright-ai-test-automation/).
- By hand from the Actions tab: pick the suite (`smoke` or `full`) and the browser. A `full` run on
  `main` also updates the dashboard.

The dashboard shows failures ranked by priority, the trend across runs, new and known failures, and
flaky or slower tests. It's public, so it doesn't include traces, and passwords, cookies and payment
details are masked.

## Tests with data from Excel or JSON

Testers can keep the values of a test in an Excel sheet or a JSON file, in the layout they're used to:
one row per item line, merged cells allowed. The steps stay in the test, written out one action at a
time, so you can still read what the cashier does.

```
testdata/sales/
  SaleTestData.xlsx     sheet "Sales": TC-SALE-101, TC-RET-201
  SaleTestData.json     TC-SALE-102, TC-SALE-103, TC-RET-202, TC-RET-203

src/utils/dataReader.js        reads any .xlsx or .json file, every column
src/utils/testDataReport.js    puts the data a test used (file and row) in the report
src/utils/saleHelpers.js       reads back and checks the saved invoice
tests/pos/sale-data.spec.js    one test per test case
```

A test says which data it uses, then uses the values in its steps:

```js
test('TC-SALE-102 two of one item, paid by UPI', { tag: ['@nightly'] }, async ({ pos, api, testData }) => {
  const testCase = readTestData({ file: JSON_FILE, testCaseId: 'TC-SALE-102' })
  await reportTestData(testCase, testData)
  const [sale] = testCase.transactions
  const [line] = sale.lines

  // Add the item and set its quantity
  await pos.addItem(itemOf(line))
  await pos.setQty(itemOf(line), line.qty)
  ...
})
```

For an Excel file you also give the sheet: `readTestData({ file, sheet: 'Sales', testCaseId })`.

Some things worth knowing:

- There's one reader for every module. Each column header becomes a key ("Item Code" becomes
  `itemCode`), so a new column shows up in the data without any code change. The reader refuses card
  numbers, expiry dates, CVVs and passwords.
- If the file, the sheet or the test case ID isn't there, the test fails and says what the file does
  contain. It also fails if the title in the data doesn't match the test's title.
- You can add data before anyone writes its test. `npm run lint` lists those test cases as "no test yet"
  and still passes. It only fails when a test asks for a test case that no file has.
- Returns are covered three ways: TC-RET-201 makes the sale through the API and returns it on screen,
  TC-RET-202 does both on screen (it's marked `test.slow()` because it's two whole transactions), and
  TC-RET-203 does both through the API.
- The data holds expected values, not records to create. Any item a row uses has to come from the seed.
  QA-DATA-001 is the item set aside for these tests.

The full layout, every column and the JSON shape are in [docs/test-data.md](docs/test-data.md#sales-and-returns-from-test-data-excel--json).

## What the seed creates

Tests never rely on anything set up by hand. Before every run, the seed ([src/seed/seed.js](src/seed/seed.js))
makes sure the site has what they need, and only creates what's missing, so running it again is safe.
Everything is set up for India, in rupees:

- the company QA Retail (Asia/Kolkata, financial year April to March), with GST as CGST + SGST
  included in prices, at 0%, 5% and 18% (demo rates, not legal advice)
- payment modes Cash, UPI, Debit Card and Credit Card
- four billing counters, one per cashier, plus the QA POS profile
- test items with round numbers (QA-STOCK-001 is ₹118.00, which is ₹100.00 + CGST ₹9.00 + SGST ₹9.00),
  11 demo items and their stock
- demo customers and suppliers, and users: four cashiers, a store manager and an admin
- the QA Testing page in ERPNext, which lists all of it

Every value, every person, and 13 worked GST examples are in [docs/test-data.md](docs/test-data.md).

## A few terms

- **Test case:** plain English in `docs/test-cases/` with the steps and the exact checks. A tester
  writes or approves it, and every test comes from one.
- **Seed:** the script that prepares the test data before the tests run.
- **Fixture:** something a test asks for by name and gets ready to use, like the POS screen with an
  open shift, or an API session. It's cleaned up afterwards.
- **Page object:** one class per screen that knows how to find things on it and do things with them.
  Tests call its methods and never deal with locators.
- **Read back by name:** after the screen saves something, ask the server for that exact record and
  check it, rather than "the latest one".
- **Mutation check:** breaking a test on purpose to see it fail. A test that can't fail doesn't prove anything.
- **Hook:** a command Claude Code runs automatically after each file the AI edits. Here, it's the lint.
- **Data-driven test:** a test whose values come from a file (Excel or JSON in `testdata/`). Its steps
  are still written in the test.
- **@smoke and @nightly:** tags. `@smoke` tests are quick and run on every change; `@nightly` tests run
  once a day.
