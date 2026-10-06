# Scenario: Point of Sale sale

Script: `tests/pos/sale.spec.js` · Area: POS · Owner: @sudhansushekhar · **Status: approved** (2026-10-07; drafted by the AI agent from `docs/requirements/pos-sale-prd.md`)

Every test runs as cashier **Anjali Verma** on **Till 1**: a `pos` fixture opens her POS session
with ₹1,000.00 opening cash before the test and **always closes it afterwards**, even when the test
failed, so the till is never left open for the next test. Amounts from `docs/test-data.md`.

## TC-POS-001 a cashier sells one item for cash: GST included, booked as a POS sales invoice
**Requirement:** REQ-POS-004, REQ-POS-008, REQ-POS-009, REQ-POS-015 · **Priority:** P0 · **Severity:** blocker
**Runs:** `@smoke` · **Test data:** QA-STOCK-001 (₹118.00, GST 18%, stock in Stores - QAR), Walk-in Customer, Till 1

**Steps**
1. Add 1 × QA-STOCK-001 to the cart.
2. Checkout. Pay ₹118.00 by **Cash**. Complete Order.

**Checks**
- The cart shows Net Total ₹100.00, CGST ₹9.00, SGST ₹9.00, Grand Total ₹118.00.
- The Sales Invoice the screen submitted, read back by name: `is_pos` 1, submitted, customer
  Walk-in Customer, net ₹100.00, CGST ₹9.00, SGST ₹9.00, grand total ₹118.00, one payment row
  Cash ₹118.00, owner anjali.verma@qa-retail.test, POS profile Till 1.
- Stock of QA-STOCK-001 in Stores - QAR is exactly **1 lower** after the sale than before it, and
  the stock movement booked by that invoice (its Stock Ledger Entry, by the invoice's name) is
  **−1** of QA-STOCK-001 in Stores - QAR.

**Change it when** the POS payment screen, GST setup, POS profile or stock settings change.

## TC-POS-002 a cashier sells by UPI: the transaction ID is saved with the sale
**Requirement:** REQ-POS-011, REQ-POS-013, REQ-POS-015 · **Priority:** P0 · **Severity:** blocker
**Runs:** `@smoke` · **Test data:** QA-STOCK-001, UTR 412345678901

**Steps**
1. Add 1 × QA-STOCK-001. Checkout.
2. Set Cash to ₹0.00; tap **UPI**, type 1 1 8 on the number pad.
3. Enter UPI Transaction ID 412345678901. Complete Order.

**Checks**
- Only the UPI Transaction ID field is shown (no card fields) once UPI is tapped.
- The saved Sales Invoice: one payment row UPI ₹118.00, `rpi_upi_reference` = 412345678901,
  no card details, grand total ₹118.00.

**Change it when** the UPI field, the number pad or payment modes change.

## TC-POS-003 a card payment without its last 4 digits is refused at Complete Order
**Requirement:** REQ-POS-012 · **Priority:** P1 · **Severity:** critical
**Runs:** `@nightly` · **Test data:** QA-STOCK-001

**Steps**
1. Add 1 × QA-STOCK-001. Checkout.
2. Set Cash to ₹0.00; tap **Credit Card**, type 1 1 8. Leave the card fields empty. Complete Order.

**Checks**
- The screen shows "Enter the card's last 4 digits for the card payment."
- The sale is **not** submitted: the invoice the screen saved is still a draft (docstatus 0).

**Change it when** the card rules change.

## TC-POS-004 a card sale keeps the card type, last 4 digits and approval code
**Requirement:** REQ-POS-011, REQ-POS-012, REQ-POS-015 · **Priority:** P1 · **Severity:** critical
**Runs:** `@nightly` · **Test data:** QA-STOCK-001, card RuPay / 4242 / approval A1B2C3

**Steps**
1. Add 1 × QA-STOCK-001. Checkout.
2. Set Cash to ₹0.00; tap **Debit Card**, type 1 1 8.
3. Card Type RuPay, Card Last 4 Digits 4242, Card Approval Code a1b2c3. Complete Order.

**Checks**
- The saved Sales Invoice: payment row Debit Card ₹118.00, `rpi_card_type` RuPay,
  `rpi_card_last4` 4242, `rpi_card_approval_code` A1B2C3 (kept in capitals), no UPI reference.

**Change it when** the card fields or rules change.

## TC-POS-005 the number pad takes whole rupees and paise
**Requirement:** REQ-POS-010 · **Priority:** P2 · **Severity:** major
**Runs:** `@nightly` · **Test data:** QA-STOCK-001

**Steps**
1. Add 1 × QA-STOCK-001. Checkout. Tap **Cash**.
2. Type 5 0 0. Then Delete. Then . 5.
3. Tap **Cash** again; type 1 2 . 5 5 5.

**Checks**
- After 5 0 0: Cash ₹500.00. After Delete: ₹50.00. After . 5: ₹50.50.
- After tapping Cash again and 1 2 . 5 5 5: ₹12.55 (a new amount; at most 2 decimals).
- Nothing is submitted (the test does not complete the order).

**Change it when** the number pad changes.

## TC-POS-006 opening the till asks only for the cash float
**Requirement:** REQ-POS-003 · **Priority:** P3 · **Severity:** minor
**Runs:** `@nightly` · **Test data:** cashier Rohit Kumar, Till 2 (no open session)

**Steps**
1. Sign in as Rohit Kumar and open the Point of Sale. Choose POS Profile Till 2.

**Checks**
- The Opening Balance Details table has one row: Cash, opening amount ₹0.00.
- No row checkboxes, no "Delete row", no "Duplicate row" are shown.
- Nothing is submitted (the dialog is left unsaved).

**Change it when** the opening dialog changes.

## Coverage

| Requirement | Test cases |
|---|---|
| REQ-POS-001 cashier opens own till | the `pos` fixture (every test); a refusal for another cashier's till: **not covered** (needs a second cashier session; propose for next round) |
| REQ-POS-002 one open session per till | **not covered** (propose for next round) |
| REQ-POS-003 opening float cash only | TC-POS-006 |
| REQ-POS-004 prices include GST | TC-POS-001 |
| REQ-POS-005 GST by slab | TC-POS-001 (18%); 0% and 5%: **not covered**, measured by hand in docs/test-data.md |
| REQ-POS-006 rounding | **not covered** (needs a basket with paise, e.g. a line discount) |
| REQ-POS-007 sale discount lowers GST | **not covered** (propose for next round) |
| REQ-POS-008 stock goes down | TC-POS-001 |
| REQ-POS-009 payment modes | TC-POS-001, TC-POS-002, TC-POS-004 |
| REQ-POS-010 number pad | TC-POS-005 |
| REQ-POS-011 card / UPI fields only where needed | TC-POS-002, TC-POS-004 |
| REQ-POS-012 card needs last 4 | TC-POS-003, TC-POS-004 |
| REQ-POS-013 UPI needs its ID | TC-POS-002 (happy path); refusal without UTR: **not covered** (mirror of TC-POS-003) |
| REQ-POS-014 no full card numbers | **not covered** in the browser (15 unit tests in retail_pos_india cover it) |
| REQ-POS-015 booked as a Sales Invoice | TC-POS-001, TC-POS-002, TC-POS-004 |
| REQ-POS-016 cashier closes own till | the `pos` fixture's teardown (every test) |

## Open questions

1. ~~Should TC-POS-001 also check stock went down by 1?~~ **Decided (2026-10-07): yes**, added to TC-POS-001.
2. Should the closing of the till (REQ-POS-016) be its own test case with checks on the closing
   entry (totals per payment mode)? **For now:** opening the till is every test's prerequisite and
   closing it its last step, both done by the `pos` fixture through the API (it fails the test if the
   till is still open afterwards); a closing-screen test case can be added.
3. TC-POS-006 needs a cashier with **no** open session (Rohit, Till 2). **For now:** its fixture closes
   any session Rohit left open first (as every POS fixture does for its cashier).
4. ~~Defect found by TC-POS-005 (2026-10-07)~~ **Fixed (2026-10-07) in retail_pos_india:** tapping the
   payment mode that was **already selected** (Cash, right after Checkout) switched it **off**
   (ERPNext's tile toggle), so the number pad typed nothing, against REQ-POS-010. The app now keeps a
   tapped tile selected and starts a new amount; TC-POS-005 passes on Chromium and WebKit.
