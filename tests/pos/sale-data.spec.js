// Test case: docs/test-cases/sale-data.md (TC-SALE-101 to TC-SALE-103, TC-RET-201 to TC-RET-203)
// Sales and returns whose values are in Excel or JSON (testdata/sales/), read by src/utils/dataReader.js.
// Each test names its data (file, sheet for Excel, Test Case ID) and spells out its own steps on the
// screen; the data gives the values. Data may be written before its test: `npm run lint` lists it.
// Each test runs at the worker's billing counter, in the cashier's shift.
const { test, expect } = require('../../src/fixtures')
const { readTestData } = require('../../src/utils/dataReader')
const { reportTestData } = require('../../src/utils/testDataReport')
const { itemOf, keptAndReturned, checkSavedInvoice } = require('../../src/utils/saleHelpers')
const { rupees } = require('../../src/utils/money')

const EXCEL_FILE = 'testdata/sales/SaleTestData.xlsx'
const JSON_FILE = 'testdata/sales/SaleTestData.json'

test('TC-SALE-101 two different items, paid in cash', { tag: ['@smoke'] }, async ({ pos, api, testData }) => {
  const testCase = readTestData({ file: EXCEL_FILE, sheet: 'Sales', testCaseId: 'TC-SALE-101' })
  await reportTestData(testCase, testData)
  const [sale] = testCase.transactions // this test case has one transaction: the sale
  const [firstLine, secondLine] = sale.lines

  // Add both items to the cart, one of each
  await pos.addItem(itemOf(firstLine))
  await pos.addItem(itemOf(secondLine))
  // The cart shows each line total and the grand total
  await expect(pos.cartLineTotal(itemOf(firstLine)), `Cart: line total of ${firstLine.itemCode}`).toHaveText(rupees(firstLine.lineTotal))
  await expect(pos.cartLineTotal(itemOf(secondLine)), `Cart: line total of ${secondLine.itemCode}`).toHaveText(rupees(secondLine.lineTotal))
  await expect(pos.cartTotal('Grand Total'), 'Cart: grand total').toHaveText(rupees(sale.grandTotal))

  // Pay the full amount and complete the order
  await pos.checkout()
  await pos.payWith(sale.paymentType, String(sale.payAmount))
  const result = await pos.completeOrder()
  expect(result.accepted, 'The server accepted the sale').toBe(true)

  // The saved invoice, read back by its name: lines, totals, payment and stock as in the data
  await checkSavedInvoice(api, result.name, sale)
})

test('TC-SALE-102 two of one item, paid by UPI', { tag: ['@nightly'] }, async ({ pos, api, testData }) => {
  const testCase = readTestData({ file: JSON_FILE, testCaseId: 'TC-SALE-102' })
  await reportTestData(testCase, testData)
  const [sale] = testCase.transactions // this test case has one transaction: the sale
  const [line] = sale.lines

  // Add the item and set its quantity
  await pos.addItem(itemOf(line))
  await pos.setQty(itemOf(line), line.qty)
  // The cart shows the line total and the grand total
  await expect(pos.cartLineTotal(itemOf(line)), `Cart: line total of ${line.qty} × ${line.itemCode}`).toHaveText(rupees(line.lineTotal))
  await expect(pos.cartTotal('Grand Total'), 'Cart: grand total').toHaveText(rupees(sale.grandTotal))

  // Pay by UPI with its transaction ID, and complete the order
  await pos.checkout()
  await pos.payWith(sale.paymentType, String(sale.payAmount))
  await pos.setUpiReference(String(sale.upiTransactionId))
  const result = await pos.completeOrder()
  expect(result.accepted, 'The server accepted the sale').toBe(true)

  // The saved invoice, read back by its name: lines, totals, payment and stock as in the data
  const invoice = await checkSavedInvoice(api, result.name, sale)
  expect.soft(invoice.rpi_upi_reference, 'The UPI transaction ID is saved with the sale').toBe(String(sale.upiTransactionId))
})

test('TC-SALE-103 three of a service item, paid by debit card', { tag: ['@nightly'] }, async ({ pos, api, testData }) => {
  const testCase = readTestData({ file: JSON_FILE, testCaseId: 'TC-SALE-103' })
  await reportTestData(testCase, testData)
  const [sale] = testCase.transactions // this test case has one transaction: the sale
  const [line] = sale.lines

  // Add the item and set its quantity
  await pos.addItem(itemOf(line))
  await pos.setQty(itemOf(line), line.qty)
  // The cart shows the line total and the grand total
  await expect(pos.cartLineTotal(itemOf(line)), `Cart: line total of ${line.qty} × ${line.itemCode}`).toHaveText(rupees(line.lineTotal))
  await expect(pos.cartTotal('Grand Total'), 'Cart: grand total').toHaveText(rupees(sale.grandTotal))

  // Pay by card with its details, and complete the order
  await pos.checkout()
  await pos.payWith(sale.paymentType, String(sale.payAmount))
  await pos.setCardDetails({ type: sale.cardType, last4: String(sale.cardLast4), approval: sale.cardApprovalCode })
  const result = await pos.completeOrder()
  expect(result.accepted, 'The server accepted the sale').toBe(true)

  // The saved invoice, read back by its name: lines, totals, payment and stock as in the data
  const invoice = await checkSavedInvoice(api, result.name, sale)
  expect.soft(invoice, 'The card details are saved with the sale (last 4 digits only)').toMatchObject({
    rpi_card_type: sale.cardType,
    rpi_card_last4: String(sale.cardLast4),
    rpi_card_approval_code: sale.cardApprovalCode,
  })
})

test('TC-RET-201 one item of a sale is returned, refunded in cash', { tag: ['@nightly'] }, async ({ pos, shift, sales, api, testData }) => {
  const testCase = readTestData({ file: EXCEL_FILE, sheet: 'Sales', testCaseId: 'TC-RET-201' })
  await reportTestData(testCase, testData)
  const [sale, saleReturn] = testCase.transactions // two transactions: the sale, then its return
  const [keptLine, returnedLine] = keptAndReturned(sale, saleReturn)
  const [returnLine] = saleReturn.lines

  // SALE, through the API: a prerequisite here (the screen under test is the return; TC-RET-202
  // makes its sale on screen). Saved as the POS screen saves it, at this billing counter.
  const payment = { type: sale.paymentType, amount: sale.payAmount }
  const soldInvoice = { name: await sales.create({ counter: shift.counter, lines: sale.lines, payment }) }
  await checkSavedInvoice(api, soldInvoice.name, sale)

  // RETURN: search the sale by its invoice number in Recent Orders, and start its return
  await pos.openPastOrder(soldInvoice.name)
  await pos.startReturn()
  // The cart now holds every line of the sale, negative: remove the kept item, set the returned quantity
  await pos.removeLine(itemOf(keptLine))
  await pos.setQty(itemOf(returnedLine), returnLine.qty)
  // The return cart shows the returned line and the refund total
  await expect(pos.cartLineTotal(itemOf(returnedLine)), `Return cart: line total of ${returnLine.itemCode}`).toHaveText(rupees(returnLine.lineTotal))
  await expect(pos.cartTotal('Grand Total'), 'Return cart: grand total').toHaveText(rupees(saleReturn.grandTotal))

  // Refund in cash and complete the return
  await pos.checkout()
  await expect(pos.amount(saleReturn.paymentType), `Refund shown on the ${saleReturn.paymentType} tile`).toHaveText(rupees(saleReturn.payAmount))
  const returnInvoice = await pos.completeOrder()
  expect(returnInvoice.accepted, 'The server accepted the return').toBe(true)

  // The saved return, read back by its name, booked against the sale
  const invoice = await checkSavedInvoice(api, returnInvoice.name, saleReturn)
  expect.soft(invoice, 'The return is booked against the sale').toMatchObject({ is_return: 1, return_against: soldInvoice.name })
})

test('TC-RET-202 every item of a sale is returned, refunded in cash', { tag: ['@nightly'] }, async ({ pos, api, testData }) => {
  test.slow() // a sale and its return, both on screen: two transactions in one test
  const testCase = readTestData({ file: JSON_FILE, testCaseId: 'TC-RET-202' })
  await reportTestData(testCase, testData)
  const [sale, saleReturn] = testCase.transactions // two transactions: the sale, then its return
  const [firstLine, secondLine] = sale.lines

  // SALE, on screen: add both items, pay, and keep the invoice number
  await pos.addItem(itemOf(firstLine))
  await pos.addItem(itemOf(secondLine))
  await expect(pos.cartTotal('Grand Total'), 'Cart: grand total of the sale').toHaveText(rupees(sale.grandTotal))
  await pos.checkout()
  await pos.payWith(sale.paymentType, String(sale.payAmount))
  const soldInvoice = await pos.completeOrder()
  expect(soldInvoice.accepted, 'The server accepted the sale').toBe(true)
  await checkSavedInvoice(api, soldInvoice.name, sale)
  await pos.newOrder()

  // RETURN: search the sale by its invoice number in Recent Orders, and start its return
  await pos.openPastOrder(soldInvoice.name)
  await pos.startReturn()
  // Every line comes back at its full quantity, negative: nothing to change in the cart
  for (const returnLine of saleReturn.lines) {
    await expect(pos.cartLineTotal(itemOf(returnLine)), `Return cart: line total of ${returnLine.itemCode}`).toHaveText(rupees(returnLine.lineTotal))
  }
  await expect(pos.cartTotal('Grand Total'), 'Return cart: grand total').toHaveText(rupees(saleReturn.grandTotal))

  // Refund in cash and complete the return
  await pos.checkout()
  await expect(pos.amount(saleReturn.paymentType), `Refund shown on the ${saleReturn.paymentType} tile`).toHaveText(rupees(saleReturn.payAmount))
  const returnInvoice = await pos.completeOrder()
  expect(returnInvoice.accepted, 'The server accepted the return').toBe(true)

  // The saved return, read back by its name, booked against the sale
  const invoice = await checkSavedInvoice(api, returnInvoice.name, saleReturn)
  expect.soft(invoice, 'The return is booked against the sale').toMatchObject({ is_return: 1, return_against: soldInvoice.name })
})

test('TC-RET-203 one of two units is returned, sale and return through the API', { tag: ['@nightly'] }, async ({ shift, sales, api, testData }) => {
  const testCase = readTestData({ file: JSON_FILE, testCaseId: 'TC-RET-203' })
  await reportTestData(testCase, testData)
  const [sale, saleReturn] = testCase.transactions // two transactions: the sale, then its return

  // SALE, through the API, at this billing counter
  const soldInvoiceName = await sales.create({ counter: shift.counter, lines: sale.lines, payment: { type: sale.paymentType, amount: sale.payAmount } })
  await checkSavedInvoice(api, soldInvoiceName, sale)

  // RETURN, through the API, as the screen's Return does: against the sale, at the data's quantities
  const returnName = await sales.createReturn({ against: soldInvoiceName, lines: saleReturn.lines, payment: { type: saleReturn.paymentType, amount: saleReturn.payAmount } })

  // The saved return, read back by its name, booked against the sale
  const invoice = await checkSavedInvoice(api, returnName, saleReturn)
  expect.soft(invoice, 'The return is booked against the sale').toMatchObject({ is_return: 1, return_against: soldInvoiceName })
})
