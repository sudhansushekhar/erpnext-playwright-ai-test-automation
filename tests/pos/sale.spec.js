// Test case: docs/test-cases/pos-sale.md (TC-POS-001 to TC-POS-006)
// Every sale runs as the cashier on her till: the `till` fixture opens it before the test and
// closes it after (src/fixtures/pos.js).
const { test, expect, meta } = require('../../src/fixtures')
const { rupees, gstSplit } = require('../../src/utils/money')
const { paidRows, taxOn } = require('../../src/utils/invoice')

test('TC-POS-001 a cashier sells one item for cash: GST included, booked as a POS sales invoice', { tag: ['@smoke'] }, async ({
  pos,
  till,
  api,
  testData,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-004' })
  const item = testData.items.stock
  const price = gstSplit(item)
  const stockBefore = await api.stockQty(item.code, testData.warehouse)

  await pos.addItem(item)
  expect(await pos.totals()).toMatchObject({
    'Net Total': rupees(price.net),
    CGST: rupees(price.halfGst),
    SGST: rupees(price.halfGst),
    'Grand Total': rupees(price.gross),
  })
  await pos.checkout()
  await pos.payWith('Cash', String(price.gross))
  const sale = await pos.completeOrder()
  expect(sale.accepted).toBe(true)

  const invoice = await api.getDoc('Sales Invoice', sale.name)
  expect(invoice).toMatchObject({
    is_pos: 1,
    docstatus: 1,
    customer: testData.posProfile.customer,
    net_total: price.net,
    grand_total: price.gross,
    owner: till.cashier,
    pos_profile: till.name,
  })
  expect(taxOn(invoice, testData.gst.cgstAccount)).toBe(price.halfGst)
  expect(taxOn(invoice, testData.gst.sgstAccount)).toBe(price.halfGst)
  expect(paidRows(invoice)).toEqual([{ mode: 'Cash', amount: price.gross }])

  // Stock: exactly one fewer, and the invoice itself booked the -1.
  expect(await api.stockQty(item.code, testData.warehouse)).toBe(stockBefore - 1)
  expect(await api.stockMovements(sale.name)).toEqual([
    { item_code: item.code, warehouse: testData.warehouse, actual_qty: -1 },
  ])
})

test('TC-POS-002 a cashier sells by UPI: the transaction ID is saved with the sale', { tag: ['@smoke'] }, async ({
  pos,
  api,
  testData,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-011' })
  const item = testData.items.stock
  const utr = testData.paymentDetails.upiReference

  await pos.addItem(item)
  await pos.checkout()
  await pos.payWith('UPI', String(item.sellingPrice))

  // Only the UPI field is shown.
  await expect(pos.field('UPI Transaction ID')).toBeVisible()
  await expect(pos.field('Card Type')).toBeHidden()
  await expect(pos.field('Card Last 4 Digits')).toBeHidden()
  await expect(pos.field('Card Approval Code')).toBeHidden()

  await pos.setUpiReference(utr)
  const sale = await pos.completeOrder()
  expect(sale.accepted).toBe(true)

  const invoice = await api.getDoc('Sales Invoice', sale.name)
  expect(paidRows(invoice)).toEqual([{ mode: 'UPI', amount: item.sellingPrice }])
  expect(invoice).toMatchObject({ docstatus: 1, grand_total: item.sellingPrice, rpi_upi_reference: utr })
  expect(invoice.rpi_card_type || null).toBeNull()
  expect(invoice.rpi_card_last4 || null).toBeNull()
  expect(invoice.rpi_card_approval_code || null).toBeNull()
})

test('TC-POS-003 a card payment without its last 4 digits is refused at Complete Order', { tag: ['@nightly'] }, async ({
  pos,
  api,
  testData,
}) => {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-012' })
  const item = testData.items.stock

  await pos.addItem(item)
  await pos.checkout()
  await pos.payWith('Credit Card', String(item.sellingPrice))
  const sale = await pos.completeOrder()

  expect(sale.accepted).toBe(false)
  await expect(pos.errorDialog).toContainText("Enter the card's last 4 digits for the card payment.")
  expect((await api.getDoc('Sales Invoice', sale.name)).docstatus).toBe(0)
})

test('TC-POS-004 a card sale keeps the card type, last 4 digits and approval code', { tag: ['@nightly'] }, async ({
  pos,
  api,
  testData,
}) => {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-012' })
  const item = testData.items.stock
  const card = testData.paymentDetails.card

  await pos.addItem(item)
  await pos.checkout()
  await pos.payWith('Debit Card', String(item.sellingPrice))
  await pos.setCardDetails({ type: card.type, last4: card.last4, approval: card.approval })
  const sale = await pos.completeOrder()
  expect(sale.accepted).toBe(true)

  const invoice = await api.getDoc('Sales Invoice', sale.name)
  expect(paidRows(invoice)).toEqual([{ mode: 'Debit Card', amount: item.sellingPrice }])
  expect(invoice).toMatchObject({
    docstatus: 1,
    rpi_card_type: card.type,
    rpi_card_last4: card.last4,
    rpi_card_approval_code: card.approvalSaved,
  })
  expect(invoice.rpi_upi_reference || null).toBeNull()
})

test('TC-POS-005 the number pad takes whole rupees and paise', { tag: ['@nightly'] }, async ({ pos, testData }) => {
  meta({ priority: 'P2', severity: 'major', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-010' })
  await pos.addItem(testData.items.stock)
  await pos.checkout()
  await pos.tapMode('Cash')

  await pos.typeAmount('500')
  await expect(pos.amount('Cash')).toHaveText(rupees(500))
  await pos.typeAmount('D')
  await expect(pos.amount('Cash')).toHaveText(rupees(50))
  await pos.typeAmount('.5')
  await expect(pos.amount('Cash')).toHaveText(rupees(50.5))

  await pos.tapMode('Cash')
  await pos.typeAmount('12.555')
  await expect(pos.amount('Cash')).toHaveText(rupees(12.55))
  // Nothing is submitted: the order is not completed.
})

test('TC-POS-006 opening the till asks only for the cash float', { tag: ['@nightly'] }, async ({
  posWithoutTill,
  tills,
  users,
}) => {
  meta({ priority: 'P3', severity: 'minor', owner: 'sudhansushekhar', feature: 'POS', story: 'REQ-POS-003' })
  const { email, till } = users.secondCashier

  await posWithoutTill.chooseTill(till)

  await expect.poll(() => posWithoutTill.openingRows()).toEqual([`Cash ${rupees(0)}`])
  await expect(posWithoutTill.openingRowCheckboxes).toHaveCount(0)
  await expect(posWithoutTill.openingRowActions).toHaveCount(0)

  // Nothing was submitted: the second cashier still has no open till.
  expect(await tills.openOf(email)).toEqual([])
})
