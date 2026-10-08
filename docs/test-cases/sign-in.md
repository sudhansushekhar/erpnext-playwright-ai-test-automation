# Scenario: Sign in

Script: `tests/access/sign-in.spec.js` · Area: Access · Owner: @sudhansushekhar · Status: approved

**Billing counters (parallel runs):** the cashier below is billing counter 1's (Anjali Verma, Billing Counter 1). When tests run in
parallel, each worker signs in its own billing counter's cashier instead; see "Billing counters" in `docs/test-data.md`.

## TC-SIGNIN-001 a wrong password is refused and starts no session
**Requirement:** ERPNext sign-in (standard behaviour, no PRD) · **Priority:** P1 · **Severity:** critical
**Runs:** `@smoke` · **Test data:** the Administrator user (from `.env`)

**Steps**
1. Open the sign-in screen.
2. Type `Administrator` and a wrong password; press **Continue**.

**Checks**
- The server refuses the sign-in (HTTP 401).
- The screen shows *Invalid credentials, try again.* and stays on the sign-in screen.
- No session was made: the server set this browser's session to `Guest`, and refuses a
  request that needs a signed-in user.

**Change it when** the sign-in screen, its button or its refusal message changes.

## TC-SIGNIN-002 Administrator signs in and lands on the QA Testing page
**Requirement:** ERPNext sign-in (standard behaviour, no PRD) · **Priority:** P0 · **Severity:** blocker
**Runs:** `@smoke` · **Test data:** Administrator (from `.env`); landing page QA Testing (set by the seed)

**Steps**
1. Open the sign-in screen.
2. Type `Administrator` and the right password; press **Continue**.

**Checks**
- The server accepts the sign-in (HTTP 200).
- The browser lands on `/desk/qa-testing` and shows the **QA Testing** page (its heading and the
  "Test and demo data prepared by the seed" text), **not** a "Server Error" page.
- The session is Administrator's: the server reports the signed-in user as `Administrator`.

**Change it when** the sign-in screen or the Administrator's landing page (seed) changes.

## TC-SIGNIN-003 a cashier signs in straight to the Point of Sale, ready to open a shift
**Requirement:** REQ-POS-017 · **Priority:** P0 · **Severity:** blocker
**Runs:** `@smoke` · **Test data:** cashier Anjali Verma (anjali.verma@qa-retail.test, `DEMO_USER_PASSWORD`), Billing Counter 1 not open

**Steps**
1. Open the sign-in screen.
2. Type Anjali's email and the demo password; press **Continue**.

**Checks**
- The server accepts the sign-in (HTTP 200).
- The browser lands on the **Point of Sale** (`/desk/selling/point-of-sale`), showing the
  **Create POS Opening Entry** dialog (her billing counter is not open yet).
- The server reports the signed-in user as `anjali.verma@qa-retail.test`.

**Change it when** the cashier's landing page (seed: role Cashier → Home Page) changes.

## TC-SIGNIN-004 a cashier stays on the Point of Sale: other desk pages send them back
**Requirement:** REQ-POS-018 · **Priority:** P2 · **Severity:** major
**Runs:** `@nightly` · **Test data:** cashier Anjali Verma; manager Meera Nair

**Steps**
1. Signed in as Anjali, open `/desk`, then `/desk/item`, then `/desk/sales-invoice`.
2. Open `/desk/pos-closing-entry/new` (closing the shift).
3. Signed in as Meera (manager), open `/desk/item`.

**Checks**
- Each page in step 1 ends on the **Point of Sale** (the message "Cashiers use the Point of Sale." is shown).
- Step 2 stays on the POS Closing Entry form (closing the shift is allowed).
- Step 3 stays on the Item list (managers are not redirected).

**Change it when** the cashier guard in retail_pos_india changes.

## TC-SIGNIN-005 a cashier signed in on a second device is signed out of the first
**Requirement:** REQ-POS-019 · **Priority:** P1 · **Severity:** critical
**Runs:** `@nightly` · **Test data:** cashier Anjali Verma

**Steps**
1. Device A (a browser): Anjali signs in.
2. Device B (a second browser): Anjali signs in.

**Checks**
- Device B is signed in as Anjali.
- Device A's session has ended: the server refuses its next request for the signed-in user (HTTP 401).

**Change it when** the session limit (seed: one session per user, cashiers 1) changes.

TC-SIGNIN-002 to TC-SIGNIN-005 approved by the tester on 2026-10-07.

## Decisions (2026-10-07, from the open questions)

1. A cashier lands on the **Point of Sale**, opens their shift there, sells and closes the shift; they
   do not use the rest of the desk (REQ-POS-017, REQ-POS-018: TC-SIGNIN-003, TC-SIGNIN-004).
2. **One device at a time** for a cashier (REQ-POS-019: TC-SIGNIN-005).
3. Rule for writing tests, from measuring TC-SIGNIN-002: signing the same user in again while a page of
   theirs is loading makes that page show "Server Error" (CLAUDE.md rule 12).
