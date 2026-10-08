# CLAUDE.md

Rules for any AI coding agent (and any person) writing tests in this repository.
The tester writes **test cases** in plain English; the agent turns them into tests; the rules below,
the lint, a hook and CI keep the result honest. How the framework is built: [`docs/framework.md`](docs/framework.md).

## Project

Playwright Test (JavaScript, CommonJS) for **ERPNext** with the Retail POS India app. The site under
test is `BASE_URL` in `.env` (locally `http://localhost:8080`, Administrator / admin, local only),
started from the [retail_pos_india](https://github.com/sudhansushekhar/retail_pos_india) repository.
This repository holds tests only.

| Path | Role |
|---|---|
| `docs/requirements/*.md` | BRD/PRD documents: requirements with IDs (`REQ-POS-012`). What test cases are drafted from. |
| `docs/test-cases/*.md` | Test cases in plain English: steps and exact checks. One file per spec. **The source of every test.** |
| `tests/<area>/*.spec.js` | Tests: steps and assertions only. |
| `src/fixtures/` | `test`, `expect` and every fixture (table in `src/fixtures/index.js`). |
| `src/pages/` | Page objects: one class per screen, one method per user action. **All locators live here.** |
| `src/api/` | `FrappeClient` (REST: read back records by name) and `Shifts` (open/close POS billing counters). |
| `src/utils/` | Pure helpers specs may import (money, invoice reading). |
| `src/seed/` | `data.js`: every test value. `seed.js`: builds it before each run. `check.js`: is the site ready? |
| `docs/test-data.md` | Every test data value and worked totals. **Read it before writing a test.** |
| `docs/ai-review-log.md` | Every mistake an AI made that review caught, and the rule it led to. |

## Commands

```bash
npm run check            # is the site ready? one line per prerequisite, read-only
npm run seed             # prepare the test data without running tests
npm run lint             # the rules below that a machine can check
npm test                 # every test, Chromium and WebKit
npx playwright test <file> --project=chromium   # one file
npm run report           # open the last report
```

## Rules for every test

Rules marked **[lint]** are enforced by `npm run lint`, in CI, and by a hook after every file an AI
agent edits (`.claude/settings.json`): a violation is sent straight back to the agent.

1. **Start from a test case.** The test's title is the test case's exact heading (`TC-<AREA>-nnn ...`),
   and the file's first line names the test case file (`// Test case: docs/test-cases/pos-sale.md (...)`).
   No test case, no test.
2. **[lint] Specs import only `src/fixtures` and `src/utils`.** `test` and `expect` never come from
   `@playwright/test`; page objects, the API and the people come as fixtures.
3. **Assert the record the server booked, by its name.** Take the name from the screen's own response
   or the URL, read it with `api.getDoc(doctype, name)`, check status, totals and links. Never assert
   "the latest" record or a count: the site keeps every run's data.
4. **[lint] No locators in specs.** A new user action is a new method on a page object.
5. **Find elements the way a person does:** `getByRole` with a name, `getByLabel`, `getByText`,
   `getByPlaceholder`. CSS only where nothing else works, with a comment saying why.
6. **[lint] Wait for the server, not the clock.** Wait for a response, a URL or a visible result.
   No `page.waitForTimeout`.
7. **Set up data through the seed or the API, never through the screens**, unless the screen is what
   the test is about. Values come from the `testData` fixture, people from `users` (`users.cashier`), the stock item from `counter.item`,
   never as typed literals. A value not in `docs/test-data.md` is added to `src/seed/data.js` and
   that page first. Through the API a tax template needs its lines: `taxes: await api.salesTaxRows(t)`.
   Amounts are INR with GST **included in the price**; a sale's cash amount is its `rounded_total`.
8. **Exactly one tag:** `@smoke` (fast, the main path) or `@nightly` (everything else). `@quarantine`
   replaces `@smoke` on a flaky test, with an owner, an issue and an end date within 7 days.
9. **[lint] Nothing switched off:** no `.only`, `.skip`, `.fixme`, `.fail`. `retries` stays 0.
10. **Every test must be able to fail.** Break the expected value (or the state, for a visibility
    check) once and watch it go red before trusting it green (`/mutation-check`).
11. **Never type or commit a real credential.** Only the local Docker values in `.env`.
12. **One sign-in per user at a time.** Signing a user in again while a page of theirs loads shows
    "Server Error", and tests run in parallel. So the `api` fixture signs in as its own automation
    user (never Administrator), and each worker uses only its own **billing counter**: its cashier, billing counter and stock
    item (`users.cashier`, `shift`, `counter.item`; "Billing counters" in `docs/test-data.md`). Never sign in
    another billing counter's cashier, and never use Administrator for API work.

## Test cases from requirements (BRD / PRD)

1. **One requirement, at least one test case**, and the **unhappy path** as its own test case. Each
   names its requirement: `**Requirement:** REQ-POS-012`.
2. **Use only what the document and `docs/test-data.md` say.** Never invent a rule, message or amount.
3. **Anything unclear becomes a question** under `## Open questions`, not a guess.
4. Drafts are `Status: draft`. **No test code from a draft:** a tester approves it first.
5. End with a **coverage table**: every requirement ID and its test cases (or "not covered: why").

## Rules for the agent

- Read the test case, `src/fixtures/index.js` and the page objects before writing. Reuse methods.
- Write code only from a test case with `Status: approved` (or one written by a tester).
- Use the slash commands in `.claude/commands/` (`/test-cases`, `/write-test`, `/review-test`,
  `/mutation-check`); the loop is in `docs/ai-workflow.md`.
- If the test case is ambiguous, stop and ask; do not invent business rules or expected values.
- **Verify before you report:** `npm run lint`, then `npx playwright test <file> --project=chromium`.
  Report the real result; never claim a pass you did not see.
- When a run or review finds a mistake you made, log it in `docs/ai-review-log.md` with the rule
  that prevents it, and add the rule here (or to the lint).
- Never commit or push without the tester's go-ahead.
