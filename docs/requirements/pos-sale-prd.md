# PRD: Point of Sale for Indian retail

Product: ERPNext v16 Point of Sale with the Retail POS India app · Market: India (INR, GST)
Status: sample PRD for practice, written from the behaviour built in this project.

## 1. Opening a shift

### REQ-POS-001 · A cashier opens a shift at their own billing counter
A user with the Cashier role can open a POS session (POS Opening Entry) on their own billing counter
(POS profile). They cannot open, close or see another cashier's session.

### REQ-POS-002 · One open session per billing counter
A billing counter can have only one open session. A second attempt is refused with the message
"<billing counter> is open. Close the POS or cancel the existing POS Opening Entry to create a new POS Opening Entry."

### REQ-POS-003 · The opening float is cash only
The opening dialog lists only the Cash payment mode, with an opening amount. It shows no row
checkboxes, no "Delete row" and no "Duplicate row".

## 2. Selling

### REQ-POS-004 · Prices include GST
A shelf price includes GST (as an MRP does). For an item on the 18% slab sold at ₹118.00, the sale
shows net ₹100.00, CGST ₹9.00 and SGST ₹9.00, grand total ₹118.00.

### REQ-POS-005 · GST by item slab
Each item carries a GST slab (0%, 5% or 18%), split equally into CGST and SGST. A 0% item adds no tax.

### REQ-POS-006 · Totals are rounded to the rupee
The amount to pay is the grand total rounded to the nearest rupee: ₹212.40 is paid as ₹212.

### REQ-POS-007 · A sale discount lowers GST
A discount on the whole sale is applied on the net total, so GST is charged on the discounted
value: 2 × ₹118.00 with 10% off gives net ₹180.00, CGST ₹16.20, SGST ₹16.20, grand total ₹212.40.

### REQ-POS-008 · Stock goes down with each sale
A POS sale of a stock item reduces its stock in the billing counter's warehouse by the quantity sold.

## 3. Paying

### REQ-POS-009 · Payment modes
A sale can be paid by Cash, UPI, Debit Card or Credit Card, or split across them. Cash is the
default mode.

### REQ-POS-010 · The number pad takes whole amounts
On the payment number pad, 5 0 0 enters ₹500.00. The "." key enters paise: 1 2 . 5 is ₹12.50.
At most 2 decimals. Tapping a payment mode starts a new amount for it.

### REQ-POS-011 · Card and UPI details only where needed
Card Type, Card Last 4 Digits and Card Approval Code are shown only for a Debit Card or Credit
Card payment. UPI Transaction ID is shown only for a UPI payment. With only Cash, none is shown.

### REQ-POS-012 · A card payment needs its last 4 digits
At Complete Order, a sale paid (partly) by card is refused unless the card's last 4 digits are
entered. Message: "Enter the card's last 4 digits for the card payment."

### REQ-POS-013 · A UPI payment needs its transaction ID
At Complete Order, a sale paid (partly) by UPI is refused unless a 12-digit UPI transaction ID
(UTR) is entered. Message: "Enter the UPI transaction ID (UTR) for the UPI payment."

### REQ-POS-014 · No full card numbers
The last-4 field accepts exactly 4 digits. A full card number in any card field is refused:
"Card last 4 digits must be exactly 4 digits. Never enter the full card number."

### REQ-POS-015 · The sale is booked as a Sales Invoice
A completed POS sale is a submitted Sales Invoice with `is_pos = 1`, carrying the payments, the
GST lines and the card or UPI details, booked under the cashier who sold it.

## 4. Closing the billing counter

### REQ-POS-016 · A cashier closes their own billing counter
A cashier can close their own session from the POS menu ("Close the POS"): the closing entry
shows the session's sales and is submitted by the cashier.

## 5. Cashiers and devices

### REQ-POS-017 · A cashier signs in straight to the Point of Sale
After sign-in, a cashier lands on the Point of Sale, where they open their shift (session).

### REQ-POS-018 · A cashier uses only the Point of Sale
A cashier (no manager or admin role) who opens any other desk page is sent back to the Point of
Sale, with the message "Cashiers use the Point of Sale." Opening and closing a shift (POS
Opening Entry, POS Closing Entry) and printing receipts stay allowed. Managers are not redirected.

### REQ-POS-019 · One device at a time
A cashier can be signed in on one device only: signing in on a second device ends the session on
the first.

## 6. Returns

### REQ-POS-020 · A cashier returns some or all items of a past sale
From the Point of Sale (Recent Orders → the sale → Return), a cashier returns some or all items of a
sale, each up to the quantity sold. The return is booked as a Sales Invoice return against that sale,
with negative quantities and totals; the money is refunded in cash and the returned stock comes back.
*(Added 2026-10-08 at the tester's request, for the data-driven return tests.)*

## Open questions

- Should a cashier be able to give a sale discount without a manager? (Today: yes.)
- Is there a limit on the opening float? (Today: none.)
- Should a sale paid by card print the last 4 digits on the receipt? (Not decided.)
