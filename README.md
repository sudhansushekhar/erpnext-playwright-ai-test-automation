# erpnext-playwright-ai-test-automation

AI-assisted test automation for **ERPNext** with Playwright.

A tester writes **test cases** in plain English. An AI coding agent turns them into
Playwright tests under the rules in [`CLAUDE.md`](CLAUDE.md). Every test reads back the
record the server booked, by its name, and the rules, a lint and CI catch what the AI gets wrong.
What it got wrong is logged in [`docs/ai-review-log.md`](docs/ai-review-log.md).

> Work in progress: one-week build, day by day. New machine? Start at [Setup on a new machine](#setup-on-a-new-machine).

## Setup on a new machine

Everything the tests need is rebuilt from this repository: ERPNext runs in Docker, and the
seed prepares the test data. Nothing is configured by hand. Run the commands in **Git Bash** or
**PowerShell**, one line at a time.

### 1. Install once

| Tool | Version | Check |
|---|---|---|
| Git | any | `git --version` |
| Docker Desktop (on Windows: with the WSL 2 engine) | any recent | `docker version` |
| Node.js | 20 or newer | `node --version` |

Docker Desktop must be **running** before step 3. Give it at least 4 GB of memory
(Settings → Resources) and about 5 GB of free disk for the ERPNext images.

### 2. Get the code

Two repositories, cloned **side by side** in the same folder: this one (the tests) and
`retail_pos_india` (our POS app, which the Docker ERPNext loads from the folder next to this one):

```bash
git clone https://github.com/sudhansushekhar/erpnext-playwright-ai-test-automation.git
git clone https://github.com/sudhansushekhar/retail_pos_india.git
cd erpnext-playwright-ai-test-automation
cp .env.example .env
npm install
npx playwright install chromium webkit
```

```
CareerPath/
  erpnext-playwright-ai-test-automation/   tests, seed, Docker setup (this repository)
  retail_pos_india/      the Retail POS India app
```

`.env` holds the local Docker site's address and its Administrator password (`admin`).
It is never committed. `retail_pos_india` somewhere else? Set `RETAIL_POS_INDIA_PATH` in `.env` to its full path.

### 3. Start ERPNext

```bash
npm run erp:up
```

The first start downloads the images (about 2 GB) and creates the site; allow 5–15 minutes.
It is ready when this answers `{"message":"pong"}`:

```bash
curl http://localhost:8080/api/method/ping
```

Then install our app on the site (safe to run again; it migrates when already installed):

```bash
npm run erp:apps
```

### 4. Prepare the test data and run the tests

```bash
npm run seed            # builds the company, GST, items, users, tills... (first run: a few minutes)
npm run check           # is the site ready? every line must be ✅ (read-only)
npm run test:smoke      # the quick @smoke tests
npm test                # every test, Chromium and WebKit
npm run report          # open the HTML report of the last run
```

On a brand-new site the seed completes ERPNext's setup wizard (India, INR), then creates what the
tests use (see [What the seed prepares](#what-the-seed-prepares)). On later runs it only adds what
is missing. Before the first seed, `npm run check` shows ❌: that is expected.

Then sign in at http://localhost:8080 as **Administrator / admin**: you land on the **QA Testing**
page. The demo users (cashiers, manager, admin) sign in with `DEMO_USER_PASSWORD` from `.env`.

### Start again from nothing

Deleting the folders does **not** delete ERPNext's data: the site lives in Docker volumes. To
rebuild everything from scratch:

1. In this folder, wipe the site (its data, POS sessions and sales are deleted):
   ```bash
   npm run erp:reset
   ```
2. Delete the two folders (`erpnext-playwright-ai-test-automation`, `retail_pos_india`). Close any
   editor, File Explorer window or terminal that has them open first, or Windows refuses.
3. Follow this setup again from step 2. The Docker images stay downloaded, so step 3 takes a few
   minutes instead of fifteen.

### Everyday commands

| Command | What it does |
|---|---|
| `npm run erp:up` | Start ERPNext (keeps its data), with our apps mounted |
| `npm run erp:apps` | Install our apps on the site, or migrate them after a change |
| `npm run erp:down` | Stop ERPNext (keeps its data) |
| `npm run erp:reset` | Stop ERPNext and **delete its data**; the next `erp:up` builds a fresh site |
| `npm run erp:logs` | Follow the site-creation and server logs |
| `npm run check` | **Is the site ready?** One ✅/❌ line per prerequisite; changes nothing |
| `npm run seed` | Prepare the test data now, and repair anything changed by hand |
| `npm run test:headed` | Watch the tests drive the browser (Chromium, one at a time) |
| `npx playwright test tests/access/sign-in.spec.js --project=chromium` | Run one file in one browser |

### If something goes wrong

| Symptom | Fix |
|---|---|
| `npm install` fails with **403 Forbidden** from `www.npmjs.com` | Your global npm registry is wrong. This repo's `.npmrc` fixes it for this folder; to fix it everywhere: `npm config set registry https://registry.npmjs.org/` |
| `erp:up` says **port 8080 is already allocated** | Something else uses 8080. Stop it, or change `"8080:8080"` in `docker/pwd.yml` to e.g. `"8081:8080"` and `BASE_URL` in `.env` to match |
| `ping` does not answer after 15 minutes | `npm run erp:logs`; if the site creation failed, `npm run erp:reset` then `npm run erp:up` |
| The seed fails with **HTTP 401** | The Administrator password is not the one in `.env`. On a fresh Docker site it is `admin` |
| Tests fail on a site you changed by hand | Reset to a clean site: `npm run erp:reset`, `npm run erp:up`, `npm run erp:apps` |
| **502 Bad Gateway** after `erp:up` | nginx still points at the old backend container: `docker restart erpnext-qa-frontend-1` (`erp:up` does this for you) |
| A change in `retail_pos_india` does not show | Python or hooks: `docker restart erpnext-qa-backend-1`. The POS script: `docker exec erpnext-qa-backend-1 bench --site frontend clear-cache`, then a **hard reload** of the page (**Ctrl+Shift+R**): the browser keeps the old POS script until then |

## What the seed prepares

Tests never depend on anything clicked by hand. Whatever a test needs is created by the seed
([`src/seed/seed.js`](src/seed/seed.js)) before every run, so every machine and every CI run
starts from the same data. Market: **India, INR**.

- Company **QA Retail** (India, ₹, Asia/Kolkata, financial year April-March)
- **GST** as CGST + SGST, **included in prices**, slabs 0% / 5% / 18% (illustrative demo rates)
- Payment modes **Cash, UPI, Debit Card, Credit Card**; POS profiles **QA POS**, **Till 1**, **Till 2**
- Test items with round numbers (QA-STOCK-001 ₹118.00 = ₹100.00 + CGST ₹9.00 + SGST ₹9.00) and
  11 demo grocery, personal care, home care, electronics and apparel items, with stock
- Demo customers (Walk-in Customer, customers in Delhi, Chennai, Hyderabad, Pune, Lucknow) and suppliers
- Demo users: 2 **cashiers**, a **store manager**, an **admin** (password: `DEMO_USER_PASSWORD` in `.env`)
- The **QA Testing** page in ERPNext, where you see all of it after signing in

**Every value, the people, and 13 measured GST examples: [`docs/test-data.md`](docs/test-data.md).** The values themselves live in [`src/seed/data.js`](src/seed/data.js).

## How it fits together

| Layer | Where |
|---|---|
| Test cases in plain English (the tester's work) | `docs/test-cases/` |
| Rules the AI must follow | `CLAUDE.md` |
| Tests: steps and assertions only | `tests/` |
| Page objects: every locator | `src/pages/` |
| Test and demo data: values in `src/seed/data.js`, built by `src/seed/seed.js` before every run | `src/seed/`, explained in `docs/test-data.md` |
| Read-back of booked records | `src/api/FrappeClient.js` |

## Words used here

| Word | Plain meaning |
|---|---|
| **Test case** | Written in plain English in `docs/test-cases/`: steps, and exact checks including the record the server saved. The tester writes it; every test is generated from one. |
| **Seed** | A script that prepares the test data before tests run (a company, a customer, an item). It only creates what is missing, so running it again is safe. Like setting the table before the guests arrive. |
| **Test data file** | `.results/test-data.json`: the names of what the seed prepared, so tests use exactly those. |
| **Fixture** | Something every test gets ready-made (the login page, an API connection), set up before the test and cleaned up after it. |
| **Page object** | One file per screen that knows how to find things and do actions on it. Tests call its methods and never hold locators. |
| **Read back by name** | After the screen saves something, ask the server for that exact record and check it, not "the latest one". |
| **Mutation check** | Break a test on purpose to prove it can fail. A test that cannot fail proves nothing. |
| **@smoke / @nightly** | Tags: `@smoke` tests are quick and run on every change; `@nightly` tests run once a day. |
