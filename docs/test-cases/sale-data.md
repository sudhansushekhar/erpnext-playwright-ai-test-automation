# Scenario: Sales and returns from test data (Excel / JSON)

Script: `tests/pos/sale-data.spec.js` · Area: POS · Owner: @sudhansushekhar · **Status: approved**
(2026-10-08, data-driven sales and returns requested by the tester; the data's values are the tester's)

Each test case below has its **own steps** (its own test, calling the screen's actions one by one); its
**values** (items, quantities, expected amounts, payment) come from its row(s) in a test data file:

- `testdata/sales/SaleTestData.xlsx`, sheet **Sales**: the Excel layout, one row per item line (see "Sales and returns from test data" in `docs/test-data.md`)
- `testdata/sales/SaleTestData.json`: test cases written as JSON, with the same field names

A test names its data: `readTestData({ file, sheet, testCaseId })` (the sheet for Excel only). It fails,
naming the file, sheet and row, if its data is not found, if the data's Test Case ID and Title differ from
the test's title, or if the data sells a billing counter's own item. Data may be added before its test is
written: `npm run lint` lists it as "no test yet".

Every test runs at the worker's billing counter, in the cashier's shift (opened before, closed after).

**Checks common to every test case** (the "saved invoice" check, soft: every mismatch reported):
the Sales Invoice, read back by its name, is submitted; it has exactly the data's lines, each with its
**Qty**, **Price**, **Line Total** and **Tax** (the GST booked on the line); **Total Tax**, **Sub Total**
(before tax) and **Grand Total**; one payment row, the **Payment Type** and **Pay Amount**; each stock item
moved by exactly its Qty (out on a sale, back in on a return).

## TC-SALE-101 two different items, paid in cash
**Requirement:** REQ-POS-015 · **Priority:** P1 · **Severity:** critical · **Runs:** @smoke
**Test data:** SaleTestData.xlsx › Sales, TC-SALE-101 (QA-DATA-001 ×1 and QA-ITEM-001 ×1, ₹177)

**Steps**
1. Add both items to the cart, one of each.
2. Checkout; pay the Pay Amount by Cash. Complete Order.

**Checks**
- On screen (hard): each cart line shows its **Line Total**; the cart's Grand Total is the **Grand Total**.
- The saved invoice (above).

## TC-SALE-102 two of one item, paid by UPI
**Requirement:** REQ-POS-011 · **Priority:** P1 · **Severity:** critical · **Runs:** @nightly
**Test data:** SaleTestData.json, TC-SALE-102 (QA-DATA-001 ×2, ₹236, UPI)

**Steps**
1. Add the item to the cart; set its quantity to the line's Qty.
2. Checkout; pay the Pay Amount by UPI; enter the **UPI Transaction ID**. Complete Order.

**Checks**
- On screen (hard): the line shows its **Line Total**; the cart's Grand Total is the **Grand Total**.
- The saved invoice (above), and it keeps the UPI Transaction ID.

## TC-SALE-103 three of a service item, paid by debit card
**Requirement:** REQ-POS-012 · **Priority:** P1 · **Severity:** critical · **Runs:** @nightly
**Test data:** SaleTestData.json, TC-SALE-103 (QA-ITEM-001 ×3, ₹177, Debit Card)

**Steps**
1. Add the item to the cart; set its quantity to the line's Qty.
2. Checkout; pay the Pay Amount by Debit Card; enter the **Card Type**, **Card Last 4** and **Card
   Approval Code**. Complete Order.

**Checks**
- On screen (hard): the line shows its **Line Total**; the cart's Grand Total is the **Grand Total**.
- The saved invoice (above), and it keeps the card type, last 4 digits and approval code. No stock moves
  (a service item).

## TC-RET-201 one item of a sale is returned, refunded in cash
**Requirement:** REQ-POS-020 · **Priority:** P1 · **Severity:** critical · **Runs:** @nightly
**Test data:** SaleTestData.xlsx › Sales, TC-RET-201 (Sale: QA-DATA-001 ×2 and QA-ITEM-001 ×1, ₹295;
Sale Return: QA-DATA-001 ×−1, −₹118)

**Steps**
1. **Sale, through the API** (a prerequisite, saved as the POS screen saves it, at this billing counter);
   checked like a saved invoice.
2. **Return, on screen:** search the sale's invoice number in Recent Orders, open it and start its **Return**.
3. Remove the kept item (QA-ITEM-001); set the returned item's quantity to the return line's Qty (−1).
4. Checkout; the Cash tile shows the refund. Complete Order.

**Checks**
- On screen (hard): the return line shows its **Line Total** (negative); the cart's Grand Total is the
  **Grand Total**; the Cash tile shows the **Pay Amount** (the refund, negative).
- The saved return (above, negative values), booked as a return (`is_return`) **against the sale**.

## TC-RET-202 every item of a sale is returned, refunded in cash
**Requirement:** REQ-POS-020 · **Priority:** P1 · **Severity:** critical · **Runs:** @nightly · **Slow:** a sale and a return on screen
**Test data:** SaleTestData.json, TC-RET-202 (Sale: QA-DATA-001 ×1 and QA-ITEM-001 ×1, ₹177;
Sale Return: both, −₹177)

**Steps**
1. **Sale, on screen:** add both items, checkout, pay by Cash, Complete Order; keep the **invoice number**
   it gives. Checked like a saved invoice. New Order.
2. Search that invoice number in Recent Orders, open it and start its **Return**. Nothing to change: every
   line comes back at its full quantity.
3. Checkout; the Cash tile shows the refund. Complete Order.

**Checks**
- On screen (hard): each return line shows its **Line Total**; the cart's Grand Total is the **Grand
  Total**; the Cash tile shows the **Pay Amount**.
- The saved return (above, negative values), booked as a return **against the sale**.

## TC-RET-203 one of two units is returned, sale and return through the API
**Requirement:** REQ-POS-020 · **Priority:** P1 · **Severity:** critical · **Runs:** @nightly
**Test data:** SaleTestData.json, TC-RET-203 (Sale: QA-DATA-001 ×2, ₹236; Sale Return: QA-DATA-001 ×−1, −₹118)

**Steps**
1. **Sale, through the API**, at this billing counter; checked like a saved invoice.
2. **Return, through the API**, as the screen's Return does (ERPNext's own "make sales return" from the
   sale), at the return line's Qty (−1), refunded in Cash.

**Checks**
- The saved return (above, negative values), booked as a return **against the sale**; the stock item
  came back by exactly 1.

**The three return tests together:** TC-RET-201 API sale + screen return; TC-RET-202 screen sale + screen
return; TC-RET-203 API sale + API return (what the server books, without the screens).

**Change it when** the POS cart, payment or return screens change, or the data layout gets new columns.

## Not covered yet

Line and sale discounts, item and sale surcharges (the POS screen cannot pick a surcharge), a customer
other than Walk-in Customer, refunds other than cash, vouchers, due dates: each needs its own test case
and test (its own steps). Never accepted in test data: passwords and tokens (they belong in `.env`).
