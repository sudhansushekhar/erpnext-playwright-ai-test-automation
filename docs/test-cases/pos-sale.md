# Scenario: Point of Sale sale

Script: `tests/pos/sale.spec.js` · Area: POS · Owner: @sudhansushekhar · **Status: draft** (drafted by the AI agent from `docs/requirements/pos-sale-prd.md`; review and set to approved)

Every test runs as cashier **Anjali Verma** on **Till 1**: a `pos` fixture opens her POS session
with ₹1,000.00 opening cash before the test and **always closes it afterwards**, even when the test
failed, so the till is never left open for the next test. Amounts from `docs/test-data.md`.

## TC-002 a cashier sells one item for cash: GST included, booked as a POS sales invoice
**Requirement:** REQ-POS-004, REQ-POS-009, REQ-POS-015 · **Priority:** P0 · **Severity:** blocker
**Runs:** `@smoke` · **Test data:** QA-STOCK-001 (₹118.00, GST 18%), Walk-in Customer, Till 1

**Steps**
1. Add 1 × QA-STOCK-001 to the cart.
2. Checkout. Pay ₹118.00 by **Cash**. Complete Order.

**Checks**
- The cart shows Net Total ₹100.00, CGST ₹9.00, SGST ₹9.00, Grand Total ₹118.00.
- The Sales Invoice the screen submitted, read back by name: `is_pos` 1, submitted, customer
  Walk-in Customer, net ₹100.00, CGST ₹9.00, SGST ₹9.00, grand total ₹118.00, one payment row
  Cash ₹118.00, owner anjali.verma@qa-retail.test, POS profile Till 1.

**Change it when** the POS payment screen, GST setup or POS profile changes.

## TC-003 a cashier sells by UPI: the transaction ID is saved with the sale
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

## TC-004 a card payment without its last 4 digits is refused at Complete Order
**Requirement:** REQ-POS-012 · **Priority:** P1 · **Severity:** critical
**Runs:** `@nightly` · **Test data:** QA-STOCK-001

**Steps**
1. Add 1 × QA-STOCK-001. Checkout.
2. Set Cash to ₹0.00; tap **Credit Card**, type 1 1 8. Leave the card fields empty. Complete Order.

**Checks**
- The screen shows "Enter the card's last 4 digits for the card payment."
- The sale is **not** submitted: the invoice the screen saved is still a draft (docstatus 0).

**Change it when** the card rules change.

## TC-005 a card sale keeps the card type, last 4 digits and approval code
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

## TC-006 the number pad takes whole rupees and paise
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

## TC-007 opening the till asks only for the cash float
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
| REQ-POS-003 opening float cash only | TC-007 |
| REQ-POS-004 prices include GST | TC-002 |
| REQ-POS-005 GST by slab | TC-002 (18%); 0% and 5%: **not covered**, measured by hand in docs/test-data.md |
| REQ-POS-006 rounding | **not covered** (needs a basket with paise, e.g. a line discount) |
| REQ-POS-007 sale discount lowers GST | **not covered** (propose for next round) |
| REQ-POS-008 stock goes down | **not covered** (propose: add a stock check to TC-002) |
| REQ-POS-009 payment modes | TC-002, TC-003, TC-005 |
| REQ-POS-010 number pad | TC-006 |
| REQ-POS-011 card / UPI fields only where needed | TC-003, TC-005 |
| REQ-POS-012 card needs last 4 | TC-004, TC-005 |
| REQ-POS-013 UPI needs its ID | TC-003 (happy path); refusal without UTR: **not covered** (mirror of TC-004) |
| REQ-POS-014 no full card numbers | **not covered** in the browser (15 unit tests in retail_pos_india cover it) |
| REQ-POS-015 booked as a Sales Invoice | TC-002, TC-003, TC-005 |
| REQ-POS-016 cashier closes own till | the `pos` fixture's teardown (every test) |

## Open questions

1. TC-002 to TC-005 check the **saved invoice**; should TC-002 also check **stock went down by 1**
   (REQ-POS-008)? The seed tops stock back up before each run, so it can be checked as a difference.
2. Should the closing of the till (REQ-POS-016) be its own test case with checks on the closing
   entry (totals per payment mode), or is "the fixture closes it" enough for now?
3. TC-007 needs a cashier with **no** open session (Rohit, Till 2). If a test or a person leaves
   Till 2 open, TC-007 cannot see the dialog. OK to have its fixture close any session of Rohit's first?
