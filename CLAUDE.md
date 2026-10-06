# CLAUDE.md

Rules for any AI coding agent (and any person) writing tests in this repository.
The tester writes **test cases** in plain English; the agent turns them into tests; these rules,
the lint and CI keep the result honest. Read this whole file before writing a test.

## Project

Playwright Test (JavaScript, CommonJS) for **ERPNext**, run locally in Docker
(`docker/pwd.yml`, site at `http://localhost:8080`, Administrator / admin, local only).

| Path | Role |
|---|---|
| `docs/requirements/*.md` | BRD/PRD documents: requirements with IDs (`REQ-POS-012`). What test cases are drafted from. |
| `docs/test-cases/*.md` | Test cases in plain English: steps, and the exact checks including the record the server saved. One file per spec file. **The source of every test.** |
| `tests/**/*.spec.js` | Tests: steps and assertions only. No locators. |
| `src/pages/*.js` | Page objects: one class per screen, one method per thing a user does. All locators live here. |
| `src/fixtures.js` | `test` and `expect` for every spec, plus `testData`, `api`, and the page objects. |
| `src/api/FrappeClient.js` | REST client. Reads back the record a test booked, by its name. |
| `src/seed/data.js` | Every test and demo value (India: INR, GST, items, people). |
| `src/seed/seed.js` | Builds that data through the API before the run. |
| `docs/test-data.md` | Every test data value, and worked totals. **Read it before writing a test.** |
| `docs/ai-review-log.md` | Every mistake an AI made that a review caught, and the rule it led to. |

## Commands

```bash
npm run erp:up           # start ERPNext in Docker (first start: a few minutes)
npm run check            # is the site ready? one line per prerequisite, read-only
npm run seed             # prepare the test data without running tests
npm test                 # every test, Chromium and WebKit
npm run test:smoke       # only @smoke
npm run test:headed      # watch it, one worker, Chromium
npm run report           # open the last HTML report
```

## Rules for every test

1. **Start from a test case.** The test's title is the test case's exact heading (`TC-nnn ...`),
   and its first line names the file (`// Test case: docs/test-cases/sales-invoice.md (TC-002)`).
   No test case, no test.
2. **Import `test` and `expect` from `src/fixtures.js`**, never from `@playwright/test`.
3. **Assert the record the server booked, by its name.** Take the document's name from the
   screen's own response (`page.waitForResponse`) or from the URL, then read it with
   `api.getDoc(doctype, name)` and check status, totals and links. Never assert "the latest"
   record or a count: the site keeps every run's data.
4. **No locators in specs.** A new user action is a new method on a page object.
5. **Find elements the way a person does:** `getByRole` with an accessible name, `getByLabel`,
   `getByText`, `getByPlaceholder`. Use CSS only where nothing else works, and say why in a comment.
6. **Wait for the server, not the clock.** Wait for a response, a URL, or a visible result.
   `page.waitForTimeout` is forbidden.
7. **Set up data through the seed or the API, never through the screens**, unless the screen is
   what the test is about. Take names and prices from the `testData` fixture
   (`testData.items.stock.sellingPrice`), never as typed literals. A value the test needs that
   is not in `docs/test-data.md` is added to the seed and that page first.
   Through the API, a tax template needs its lines too: `taxes: await api.salesTaxRows(template)`.
   Amounts are in INR with GST **included in the price**; a sale's cash amount is its `rounded_total`.
8. **Exactly one tag** per test: `@smoke` (fast, the main path) or `@nightly` (everything else).
   `@quarantine` replaces `@smoke` on a flaky test, with an owner, an issue and an end date
   no more than 7 days away.
9. **Nothing switched off:** no `.skip`, `.only`, `.fixme`, `.fail`. No retries; `retries` stays 0.
10. **Every test must be able to fail.** When you write one, break the expected value once and
    watch it go red before you trust it green.
11. **Never type or commit a real credential.** Only the local Docker values in `.env`.

## Test cases from requirements (BRD / PRD)

When asked to draft test cases from a document in `docs/requirements/`:

1. **One requirement, at least one test case**, and the **unhappy path** as its own test case
   (refused, invalid, not allowed). Each test case names its requirement: `**Requirement:** REQ-POS-012`.
2. **Use only what the document and `docs/test-data.md` say.** Exact values (amounts, messages)
   come from them. Never invent a business rule, a message or an amount.
3. **Anything unclear becomes a question**, listed under `## Open questions` in the test case
   file, not a guess. Contradictions between the document and the site are listed there too.
4. Write drafts in the test case format (`docs/test-cases/README.md`) with `Status: draft`.
   **No test code is written from a draft:** a tester reviews it and sets `Status: approved`.
5. End with a **coverage table**: every requirement ID in the document, and the test cases that
   cover it (or "not covered: why").

## Rules for the agent

- Read the test case and the existing page objects before writing anything. Reuse methods.
- Write code only from a test case with `Status: approved` (or one written by a tester).
- Reusable prompts for this workflow are slash commands in `.claude/commands/`
  (`/test-cases`, `/write-test`, `/review-test`, `/mutation-check`); see `docs/ai-workflow.md`.
- If the test case is ambiguous, stop and ask; do not invent business rules or expected values.
- After writing a test, run it (`npx playwright test <file> --project=chromium`) and report
  the real result. Do not claim a pass you did not see.
- When a review finds a mistake you made, it goes in `docs/ai-review-log.md` with the rule
  that prevents it, and the rule is added here.
