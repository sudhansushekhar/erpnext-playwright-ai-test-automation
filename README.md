# erpnext-playwright-ai-test-automation

[![ERPNext POS · Playwright E2E](https://github.com/sudhansushekhar/erpnext-playwright-ai-test-automation/actions/workflows/playwright-e2e.yml/badge.svg)](https://github.com/sudhansushekhar/erpnext-playwright-ai-test-automation/actions/workflows/playwright-e2e.yml)
**[Test dashboard](https://sudhansushekhar.github.io/erpnext-playwright-ai-test-automation/)**: last night's full run, with the trend across runs.

AI-assisted test automation for **ERPNext** (Point of Sale for Indian retail) with Playwright.

A tester writes **test cases** in plain English. An AI coding agent turns them into Playwright tests
under the rules in [`CLAUDE.md`](CLAUDE.md). Every test reads back the record the server booked, by
its name. A lint, a hook on every AI edit and CI check the rules; what the AI got wrong is logged in
[`docs/ai-review-log.md`](docs/ai-review-log.md).

**How it is built (structure, architecture, OOP and design patterns, with diagrams): [docs/framework.md](docs/framework.md).**
How to work with the AI day to day: [docs/ai-workflow.md](docs/ai-workflow.md).

## Two repositories

| | |
|---|---|
| **this one** | requirements, test cases, tests, test data (seed) |
| [**retail_pos_india**](https://github.com/sudhansushekhar/retail_pos_india) | the app under test, and ERPNext in Docker with it |

## Setup on a new machine

Needs **Git**, **Node.js 20+**, and **Docker Desktop** (running, at least 4 GB of memory).
Run each command on its own line (Git Bash or PowerShell).

**1. Start ERPNext** (from the app repository; first start 5–15 minutes):

```bash
git clone https://github.com/sudhansushekhar/retail_pos_india.git
cd retail_pos_india
npm run erp:up
npm run erp:app
cd ..
```

Wait until http://localhost:8080/api/method/ping answers `{"message":"pong"}` before `erp:app`.
Stopping, resetting, backups and troubleshooting: the [app's README](https://github.com/sudhansushekhar/retail_pos_india#run-erpnext-with-this-app-locally-docker).

**2. Get the tests ready:**

```bash
git clone https://github.com/sudhansushekhar/erpnext-playwright-ai-test-automation.git
cd erpnext-playwright-ai-test-automation
cp .env.example .env
npm install
npx playwright install chromium webkit
```

**3. Prepare the data and run:**

```bash
npm run seed            # company, GST, items, users, shifts... (first run: a few minutes)
npm run check           # every line must be ✅ (read-only)
npm run test:smoke      # the quick @smoke tests
npm test                # every test, Chromium and WebKit
npm run report          # open the report of the last run
```

Then sign in at http://localhost:8080 as **Administrator / admin**: you land on the **QA Testing**
page with every test value. Demo users sign in with `DEMO_USER_PASSWORD` from `.env`.

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Is the site ready for the tests? One ✅/❌ line per prerequisite; changes nothing |
| `npm run seed` | Prepare the test data now, and repair anything changed by hand |
| `npm run lint` | Check the rules a machine can check (no locators in specs, no waits, nothing skipped...) |
| `npm test` / `npm run test:smoke` | Every test on both browsers / only `@smoke` |
| `npm run test:chromium` / `npm run test:webkit` | Every test on one browser |
| `npm run test:headed` | Watch the tests drive the browser (Chromium, one at a time) |
| `npx playwright test tests/pos/sale.spec.js --project=chromium` | One file in one browser |
| `npm run report` | The last run's report (reporting-labs); `npm run report:playwright` for Playwright's own, with traces |

| Problem | Fix |
|---|---|
| `npm install` fails with **403** | Your global npm registry is wrong; this repo's `.npmrc` fixes it here, or: `npm config set registry https://registry.npmjs.org/` |
| The seed fails with **HTTP 401** | The Administrator password is not the one in `.env` (`admin` on a fresh Docker site) |
| `npm run check` shows ❌ | `npm run seed`, then check again; it says what to do for anything the seed cannot fix |
| Tests fail on a site changed by hand | Reset it from the app repository (`npm run erp:reset`, `erp:up`, `erp:app`), then `npm run seed` |

## CI (GitHub Actions)

[`.github/workflows/playwright-e2e.yml`](.github/workflows/playwright-e2e.yml): first **lint**, then ERPNext from
`retail_pos_india` (`main`) in Docker, the seed, `npm run check`, then the tests.

| When | Tests | Report |
|---|---|---|
| Every pull request, every push to `main` | `@smoke` on Chromium (about 5 minutes) | attached to the run (**test-reports**) |
| Every night (02:00 IST) | every test, Chromium and WebKit | attached, and published to the **[dashboard](https://sudhansushekhar.github.io/erpnext-playwright-ai-test-automation/)** |
| By hand (Actions → ERPNext POS · Playwright E2E → Run workflow) | choose the suite (`smoke` or `full`) and the browser (`chromium`, `webkit` or `both`); `full` on `main` also updates the dashboard | as above |

The dashboard is the reporting-labs report of the latest full run: failures ranked by priority,
the trend, new vs known failures, flaky and slower tests (the run history is kept by the CI cache).
It is public, so it holds no traces (they record what was typed); passwords, cookies and payment
details are masked in the report.

## What the seed prepares

Tests never depend on anything clicked by hand: whatever they need is created by the seed
([`src/seed/seed.js`](src/seed/seed.js)) before every run. Market: **India, INR**.

- Company **QA Retail** (₹, Asia/Kolkata, financial year April-March); **GST** as CGST + SGST,
  **included in prices**, slabs 0% / 5% / 18% (illustrative demo rates)
- Payment modes **Cash, UPI, Debit Card, Credit Card**; billing counters **Billing Counter 1–4**, one per cashier, and **QA POS**
- Test items with round numbers (QA-STOCK-001 ₹118.00 = ₹100.00 + CGST ₹9.00 + SGST ₹9.00), 11 demo items, stock
- Demo customers and suppliers; users: 4 **cashiers**, a **store manager**, an **admin**
- **Billing counters** for parallel runs: each test worker gets its own cashier, billing counter and stock item (`WORKERS=4 npm test`)
- The **QA Testing** page in ERPNext, listing all of it

**Every value, the people, and 13 measured GST examples: [`docs/test-data.md`](docs/test-data.md).**

## Words used here

| Word | Plain meaning |
|---|---|
| **Test case** | Plain English in `docs/test-cases/`: steps and exact checks. Written (or approved) by the tester; every test comes from one. |
| **Seed** | Prepares the test data before the tests run. It only creates what is missing, so running it again is safe. |
| **Fixture** | Something a test asks for by name and gets ready-made (the POS with an open a shift, an API session), cleaned up after it. |
| **Page object** | One class per screen that knows how to find things and do actions on it. Tests call its methods and never hold locators. |
| **Read back by name** | After the screen saves something, ask the server for that exact record and check it, not "the latest one". |
| **Mutation check** | Break a test on purpose to prove it can fail. A test that cannot fail proves nothing. |
| **Lint** | A program that reads the code and reports rule breaks before anything runs. |
| **Hook** | A command Claude Code runs automatically after each file the AI edits: here, the lint. |
| **@smoke / @nightly** | Tags: `@smoke` tests are quick and run on every change; `@nightly` tests run once a day. |
