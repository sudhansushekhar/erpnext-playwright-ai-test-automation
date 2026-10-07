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

## TC-POS-007 a UPI payment without its transaction ID is refused at Complete Order
**Requirement:** REQ-POS-013 · **Priority:** P1 · **Severity:** critical · **Status: draft**
**Runs:** `@nightly` · **Test data:** QA-STOCK-001

**Steps**
1. Add 1 × QA-STOCK-001. Checkout.
2. Set Cash to ₹0.00; tap **UPI**, type 1 1 8. Leave UPI Transaction ID empty. Complete Order.

**Checks**
- The screen shows "Enter the UPI transaction ID (UTR) for the UPI payment."
- The sale is **not** submitted: the invoice the screen saved is still a draft (docstatus 0).

**Change it when** the UPI rules change.

## TC-POS-008 a 10% sale discount lowers GST, and the total is paid rounded to the rupee
**Requirement:** REQ-POS-007, REQ-POS-006 · **Priority:** P1 · **Severity:** critical · **Status: draft**
**Runs:** `@nightly` · **Test data:** 2 × QA-STOCK-001 (worked example #7 in `docs/test-data.md`)

**Steps**
1. Add 2 × QA-STOCK-001 to the cart. **Add Discount**: 10%.
2. Checkout. Pay ₹212 by **Cash** (type 2 1 2). Complete Order.

**Checks**
- The cart shows Net Total ₹180.00, CGST ₹16.20, SGST ₹16.20, Grand Total ₹212.40.
- The saved Sales Invoice: `additional_discount_percentage` 10, `apply_discount_on` Net Total,
  discount ₹20.00, net ₹180.00, CGST ₹16.20, SGST ₹16.20, grand total ₹212.40,
  **rounded total ₹212.00**, one payment row Cash ₹212.00.

**Change it when** the discount setting of the tills (Net Total) or rounding changes.

## TC-POS-009 a second session on an open till is refused
**Requirement:** REQ-POS-002 · **Priority:** P1 · **Severity:** critical · **Status: draft**
**Runs:** `@nightly` · **Test data:** Till 1 open for Anjali (the `till` fixture); manager Meera Nair (may use every till)

**Steps**
1. Sign in as Meera and open the Point of Sale. In **Create POS Opening Entry** choose POS Profile
   **Till 1**, opening Cash ₹1,000.00. Submit.

**Checks**
- The screen shows "Till 1 is open. Close the POS or cancel the existing POS Opening Entry to
  create a new POS Opening Entry."
- No second session: Meera has no open POS Opening Entry on Till 1, and Anjali's session is still Open.

**Change it when** ERPNext's session rule or the tills' users change.

## TC-POS-010 a cashier can neither pick nor read another cashier's till
**Requirement:** REQ-POS-001 · **Priority:** P1 · **Severity:** critical · **Status: draft**
**Runs:** `@nightly` · **Test data:** Rohit Kumar (Till 2, no open session); Anjali's open session on Till 1 (the `till` fixture)

**Steps**
1. Sign in as Rohit and open the Point of Sale. Type `Till` in the dialog's POS Profile box.
2. As Rohit, open Anjali's POS Opening Entry by its name (`/desk/pos-opening-entry/<name>`).

**Checks**
- The POS Profile list offers **Till 2** only, not Till 1.
- Rohit cannot read Anjali's session: the server refuses it (HTTP 403), the screen shows no data of it.

**Change it when** the Cashier role's permissions or the tills' users change.

## TC-POS-011 a cashier closes their own till from the POS menu
**Requirement:** REQ-POS-016 · **Priority:** P1 · **Severity:** critical · **Status: draft**
**Runs:** `@nightly` · **Test data:** QA-STOCK-001; Till 1 opened with ₹1,000.00

**Steps**
1. Sell 1 × QA-STOCK-001 for ₹118.00 Cash (as TC-POS-001).
2. Menu **⋯ → Close the POS**. On the POS Closing Entry: Save, then Submit.

**Checks**
- The closing entry lists the sale (by the invoice's name), and Cash: opening ₹1,000.00,
  expected ₹1,118.00.
- The closing entry, read back by name: submitted, owner anjali.verma@qa-retail.test, linked to the
  session the test opened; that session is now **Closed**.

**Change it when** the closing screen or the Cashier role changes.

## TC-POS-012 a full card number is refused
**Requirement:** REQ-POS-014 · **Priority:** P1 · **Severity:** critical · **Status: draft**
**Runs:** `@nightly` · **Test data:** QA-STOCK-001; a published **test** card number (see open question 6)

**Steps**
1. Add 1 × QA-STOCK-001. Checkout. Set Cash to ₹0.00; tap **Debit Card**, type 1 1 8.
2. Card Type Visa; enter the 16-digit test card number in **Card Last 4 Digits**. Complete Order.

**Checks**
- The screen shows "Card last 4 digits must be exactly 4 digits. Never enter the full card number."
- The sale is not submitted (docstatus 0), and the saved invoice holds **no** card number.

**Change it when** the card rules change.

## TC-POS-013 GST at 5% and 0% is worked out per item
**Requirement:** REQ-POS-005 · **Priority:** P2 · **Severity:** major · **Status: draft**
**Runs:** `@nightly` · **Test data:** see open question 7 (examples #11 and #12 in `docs/test-data.md`)

**Steps**
1. Add 1 × Wheat Atta 5 kg (5%) and 1 × Iodised Salt 1 kg (0%). Checkout, pay ₹313 by Cash. Complete Order.

**Checks**
- The saved Sales Invoice: the atta line net ₹271.43, the salt line net ₹28.00; CGST ₹6.79,
  SGST ₹6.79 (none on the salt); grand total ₹313.00.

**Change it when** the GST slabs or those items' prices change.

## Coverage

| Requirement | Test cases |
|---|---|
| REQ-POS-001 cashier opens own till | the `till` fixture (every test); TC-POS-010 (draft: not another's) |
| REQ-POS-002 one open session per till | TC-POS-009 (draft) |
| REQ-POS-003 opening float cash only | TC-POS-006 |
| REQ-POS-004 prices include GST | TC-POS-001 |
| REQ-POS-005 GST by slab | TC-POS-001 (18%); TC-POS-013 (draft: 5%, 0%) |
| REQ-POS-006 rounding | TC-POS-008 (draft) |
| REQ-POS-007 sale discount lowers GST | TC-POS-008 (draft) |
| REQ-POS-008 stock goes down | TC-POS-001 |
| REQ-POS-009 payment modes | TC-POS-001, TC-POS-002, TC-POS-004 |
| REQ-POS-010 number pad | TC-POS-005 |
| REQ-POS-011 card / UPI fields only where needed | TC-POS-002, TC-POS-004 |
| REQ-POS-012 card needs last 4 | TC-POS-003, TC-POS-004 |
| REQ-POS-013 UPI needs its ID | TC-POS-002; TC-POS-007 (draft: refused without it) |
| REQ-POS-014 no full card numbers | TC-POS-012 (draft); also 15 unit tests in retail_pos_india |
| REQ-POS-015 booked as a Sales Invoice | TC-POS-001, TC-POS-002, TC-POS-004 |
| REQ-POS-016 cashier closes own till | the `till` fixture (API, every test); TC-POS-011 (draft: on screen) |
| REQ-POS-017 to 019 sign-in, POS only, one device | `docs/test-cases/sign-in.md` (TC-SIGNIN-003 to 005) |

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
5. TC-POS-009: should the second session be tried **on the screen by Meera** (as drafted) or through
   the API? And is the message exactly the PRD's, with "Till 1" in place of `<till>`?
6. TC-POS-012 needs a full card number to type. Proposal: Visa's published test number
   4111 1111 1111 1111, added to `docs/test-data.md` on approval. OK?
7. TC-POS-013: the tests use QA items, but there is no QA item at 5% or 0%. Use the demo items
   Wheat Atta 5 kg and Iodised Salt 1 kg (measured as #11 and #12), or add QA-GST5-001 / QA-GST0-001
   to the seed? Also, ₹285.00 + ₹28.00 = ₹313.00 together is computed, not yet measured.
8. TC-POS-011 closes the till on screen, so its fixture must skip the API close (it still checks Closed).
9. TC-POS-010: the refusal when Rohit opens Till 1 **through the API** is not in the PRD; only the
   screen (Till 1 not offered) and reading (403) are drafted.
