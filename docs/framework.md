# How the framework works

One page: the layers, how a test is built, how to add one, and how it grows. Rules: [`CLAUDE.md`](../CLAUDE.md).

## Two repositories

| Repository | Holds | Owner of |
|---|---|---|
| [retail_pos_india](https://github.com/sudhansushekhar/retail_pos_india) | The app, and ERPNext in Docker with it (start, reset, backup, restore) | **the system under test** |
| this one | Requirements, test cases, tests, the test data (seed) | **the tests** |

The tests only need `BASE_URL` and the passwords in `.env`. Point them at any ERPNext site with the
app installed: the seed builds the data they need.

## The layers

```
docs/requirements/   REQ-POS-012 ...                     what the product must do      (BA / tester)
docs/test-cases/     TC-POS-003: steps + exact checks     what a test proves            (tester; AI drafts)
        │
tests/<area>/*.spec.js   steps and assertions, nothing else                               (AI writes, tester reviews)
        │ uses
src/fixtures/        ready-made things a test asks for by name: pos, till, users, api ...
        │ built from
src/pages/           page objects: every locator, one method per user action
src/api/             FrappeClient (REST), Tills (open/close a POS till)
src/seed/            data.js (every value) → seed.js (builds it) → .results/test-data.json
src/utils/           pure helpers: money (₹, GST split), invoice (payments, tax lines)
```

A spec reads like the test case because everything technical sits one layer down. The lint makes
sure it stays that way: a spec cannot hold a locator or import a page object.

## One test, end to end (TC-POS-001)

1. **Before the run:** the seed (Playwright `globalSetup`) makes sure the company, GST, items, prices,
   stock, users and tills exist, and writes their names to `.results/test-data.json`.
2. **The test asks for fixtures:** `async ({ pos, till, api, testData }) => ...`
   - `till` opens Anjali's till through the API (0.3 s);
   - `pos` signs her in through the API and opens the Point of Sale screen;
   - `api` is a REST session as Administrator, `testData` the seeded values.
3. **Steps** call page-object methods: `pos.addItem(item)`, `pos.checkout()`, `pos.payWith('Cash', '118')`,
   `pos.completeOrder()` (which returns the invoice's name from the screen's own request).
4. **Checks** read the record back **by that name**: `api.getDoc('Sales Invoice', name)`: GST lines,
   payment, owner, till; and stock: exactly 1 lower, the invoice's own stock entry −1.
5. **After the test**, even a failed one, the `till` fixture closes the till and checks it is Closed.

## The fixtures

All in [`src/fixtures/index.js`](../src/fixtures/index.js), in three layers, each extending the one
before. A fixture is set up only when a test names it.

| Layer | Fixtures |
|---|---|
| `base.js`: data and sessions | `env`, `testData`, `users` (admin, cashier, secondCashier, manager), `api`, `session` |
| `pages.js`: page objects | `loginPage`, `deskPage`, `posPage`, `secondDevice` (a second browser) |
| `pos.js`: the point of sale | `tills`, `till` (open before, close after), `pos` (ready to sell), `posWithoutTill` |

## Add a test

1. A test case exists and is `Status: approved` (`/test-cases` drafts them from a PRD).
2. Any value it needs is in `src/seed/data.js` and `docs/test-data.md`.
3. A user action the page objects cannot do yet becomes a new method on the page object
   (locators from the real page's accessibility tree).
4. The spec: title = the test case heading, steps, checks by record name, one tag.
5. `npm run lint`, run it, break it once to see it fail (`/write-test` does all of this).

New screen: a new class in `src/pages/` and a fixture in `pages.js`. New feature area: a folder in
`tests/`, a test case file in `docs/test-cases/`, and, if it needs setup, a fixture file like `pos.js`.

## How it scales

| Need | How |
|---|---|
| More tests | Same pattern; fixtures and page objects are shared, specs stay short |
| Faster runs | `WORKERS=n`. POS tests need **one till and cashier per worker** (a till has one open session, a cashier one device): add them to the seed and pick by `test.info().parallelIndex` |
| More browsers | Projects in `playwright.config.js` (Chromium and WebKit today) |
| Quick vs full | `@smoke` on every pull request; every test nightly, published to the [dashboard](https://sudhansushekhar.github.io/erpnext-playwright-ai-test-automation/) with the trend across runs |
| Another site | Change `BASE_URL`; the seed builds the data there |
| More people writing tests (or AI agents) | `CLAUDE.md` + the lint + the edit hook + CI: the same rules for everyone, checked by machines |

## How AI is used, safely

| Practice | Where |
|---|---|
| Rules the agent reads first | `CLAUDE.md` (also `AGENTS.md` for other agents) |
| Reusable prompts for each step | `.claude/commands/`: `/test-cases`, `/write-test`, `/review-test`, `/mutation-check` |
| Human approval gates | test cases (`draft` → `approved`), test review, commit and push |
| Rules checked by machines, not memory | `npm run lint`, the edit hook (`.claude/settings.json`), CI |
| Proof a test can fail | the mutation check, for every new test |
| Learning from mistakes | `docs/ai-review-log.md`: each mistake → a rule or a lint check |
| Traceability | requirement → test case (coverage table) → test title → report (`meta({ story })`) |
| No secrets | only local Docker values in `.env`; reports mask passwords and payment details |
