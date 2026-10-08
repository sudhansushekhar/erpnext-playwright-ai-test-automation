// Test case: docs/test-cases/pos-sale.md (TC-POS-001 to TC-POS-006)
// Every sale runs at the worker's billing counter (src/fixtures/base.js), with its cashier and stock
// item; the `shift` fixture opens her shift before the test and closes it after.
const { test, expect, meta } = require('../../src/fixtures')
const { rupees, gstSplit } = require('../../src/utils/money')
const { paidRows, taxOn } = require('../../src/utils/invoice')

test('TC-POS-001 a cashier sells one item for cash: GST included, booked as a POS sales invoice', { tag: ['@smoke'] }, async ({
  pos,
  shift,
  counter,
  api,
  testData,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-004' })
  const item = counter.item
  const price = gstSplit(item)
  const stockBefore = await api.stockQty(item.code, testData.warehouse)

  await pos.addItem(item)
  // On screen: hard checks on the elements (the sale goes on only if the cart is right).
  await expect(pos.cartTotal('Net Total'), 'Cart: net total').toHaveText(rupees(price.net))
  await expect(pos.cartTotal('CGST'), 'Cart: CGST, half the GST').toHaveText(rupees(price.halfGst))
  await expect(pos.cartTotal('SGST'), 'Cart: SGST, half the GST').toHaveText(rupees(price.halfGst))
  await expect(pos.cartTotal('Grand Total'), 'Cart: grand total, GST included').toHaveText(rupees(price.gross))
  await pos.checkout()
  await pos.payWith('Cash', String(price.gross))
  const sale = await pos.completeOrder()
  expect(sale.accepted, 'The server accepted the sale').toBe(true)

  const invoice = await api.getDoc('Sales Invoice', sale.name)
  expect.soft(invoice, 'Saved invoice: a submitted POS sale to the customer, with its totals, cashier and counter').toMatchObject({
    is_pos: 1,
    docstatus: 1,
    customer: testData.posProfile.customer,
    net_total: price.net,
    grand_total: price.gross,
    owner: shift.cashier,
    pos_profile: shift.counter,
  })
  expect.soft(taxOn(invoice, testData.gst.cgstAccount), 'CGST booked: half the GST').toBe(price.halfGst)
  expect.soft(taxOn(invoice, testData.gst.sgstAccount), 'SGST booked: half the GST').toBe(price.halfGst)
  expect.soft(paidRows(invoice), 'Paid in full by Cash, and nothing else').toEqual([{ mode: 'Cash', amount: price.gross }])

  // Stock: exactly one fewer, and the invoice itself booked the -1.
  expect.soft(await api.stockQty(item.code, testData.warehouse), 'Stock is exactly 1 lower').toBe(stockBefore - 1)
  expect.soft(await api.stockMovements(sale.name), 'This invoice took exactly 1 of the item out of the warehouse').toEqual([
    { item_code: item.code, warehouse: testData.warehouse, actual_qty: -1 },
  ])
})

test('TC-POS-002 a cashier sells by UPI: the transaction ID is saved with the sale', { tag: ['@smoke'] }, async ({
  pos,
  counter,
  api,
  testData,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-011' })
  const item = counter.item
  const upiReference = testData.paymentDetails.upiReference

  await pos.addItem(item)
  await pos.checkout()
  await pos.payWith('UPI', String(item.sellingPrice))

  // Only the UPI field is shown.
  await expect(pos.field('UPI Transaction ID'), 'The UPI Transaction ID field is shown').toBeVisible()
  await expect(pos.field('Card Type'), 'No Card Type field for UPI').toBeHidden()
  await expect(pos.field('Card Last 4 Digits'), 'No Card Last 4 Digits field for UPI').toBeHidden()
  await expect(pos.field('Card Approval Code'), 'No Card Approval Code field for UPI').toBeHidden()

  await pos.setUpiReference(upiReference)
  const sale = await pos.completeOrder()
  expect(sale.accepted, 'The server accepted the sale').toBe(true)

  const invoice = await api.getDoc('Sales Invoice', sale.name)
  expect.soft(paidRows(invoice), 'Paid in full by UPI').toEqual([{ mode: 'UPI', amount: item.sellingPrice }])
  expect.soft(invoice, 'Saved invoice keeps the UPI transaction ID').toMatchObject({ docstatus: 1, grand_total: item.sellingPrice, rpi_upi_reference: upiReference })
  expect.soft(invoice.rpi_card_type || null, 'No card type saved').toBeNull()
  expect.soft(invoice.rpi_card_last4 || null, 'No card last 4 digits saved').toBeNull()
  expect.soft(invoice.rpi_card_approval_code || null, 'No card approval code saved').toBeNull()
})

test('TC-POS-003 a card payment without its last 4 digits is refused at Complete Order', { tag: ['@nightly'] }, async ({
  pos,
  counter,
  api,
}) => {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-012' })
  const item = counter.item

  await pos.addItem(item)
  await pos.checkout()
  await pos.payWith('Credit Card', String(item.sellingPrice))
  const sale = await pos.completeOrder()

  expect(sale.accepted, 'The server refused the sale').toBe(false)
  await expect(pos.errorDialog, "The screen asks for the card's last 4 digits").toContainText("Enter the card's last 4 digits for the card payment.")
  expect.soft((await api.getDoc('Sales Invoice', sale.name)).docstatus, 'The invoice is still a draft (not submitted)').toBe(0)
})

test('TC-POS-004 a card sale keeps the card type, last 4 digits and approval code', { tag: ['@nightly'] }, async ({
  pos,
  counter,
  api,
  testData,
}) => {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-012' })
  const item = counter.item
  const card = testData.paymentDetails.card

  await pos.addItem(item)
  await pos.checkout()
  await pos.payWith('Debit Card', String(item.sellingPrice))
  await pos.setCardDetails({ type: card.type, last4: card.last4, approval: card.approval })
  const sale = await pos.completeOrder()
  expect(sale.accepted, 'The server accepted the sale').toBe(true)

  const invoice = await api.getDoc('Sales Invoice', sale.name)
  expect.soft(paidRows(invoice), 'Paid in full by Debit Card').toEqual([{ mode: 'Debit Card', amount: item.sellingPrice }])
  expect.soft(invoice, 'Saved invoice keeps the card type, last 4 digits and approval code (in capitals)').toMatchObject({
    docstatus: 1,
    rpi_card_type: card.type,
    rpi_card_last4: card.last4,
    rpi_card_approval_code: card.approvalSaved,
  })
  expect.soft(invoice.rpi_upi_reference || null, 'No UPI transaction ID saved').toBeNull()
})

test('TC-POS-005 the number pad takes whole rupees and paise', { tag: ['@nightly'] }, async ({ pos, counter }) => {
  meta({ priority: 'P2', severity: 'major', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-010' })
  await pos.addItem(counter.item)
  await pos.checkout()
  await pos.tapMode('Cash')

  await pos.typeAmount('500')
  await expect(pos.amount('Cash'), 'Cash after 5 0 0').toHaveText(rupees(500))
  await pos.typeAmount('D')
  await expect(pos.amount('Cash'), 'Cash after Delete').toHaveText(rupees(50))
  await pos.typeAmount('.5')
  await expect(pos.amount('Cash'), 'Cash after . 5').toHaveText(rupees(50.5))

  await pos.tapMode('Cash')
  await pos.typeAmount('12.555')
  await expect(pos.amount('Cash'), 'Cash after tapping Cash again and 1 2 . 5 5 5 (2 decimals at most)').toHaveText(rupees(12.55))
  // Nothing is submitted: the order is not completed.
})

test('TC-POS-006 opening a shift asks only for the cash float', { tag: ['@nightly'] }, async ({
  posBeforeOpening,
  shifts,
  users,
}) => {
  meta({ priority: 'P3', severity: 'minor', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-003' })
  const { email, counter } = users.cashier

  await posBeforeOpening.chooseCounter(counter)

  await expect.poll(() => posBeforeOpening.openingRows(), { message: 'Opening balance: one row, Cash ₹0.00' }).toEqual([`Cash ${rupees(0)}`])
  await expect(posBeforeOpening.openingRowCheckboxes, 'No row checkboxes').toHaveCount(0)
  await expect(posBeforeOpening.openingRowActions, 'No Delete row / Duplicate row buttons').toHaveCount(0)

  // Nothing was submitted: the cashier still has no open shift.
  expect.soft(await shifts.openOf(email), 'Nothing was submitted: the cashier has no open shift').toEqual([])
})
