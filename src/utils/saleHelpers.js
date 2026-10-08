/**
 * Helpers for sales and returns whose values come from test data (testdata/sales/). No screen steps
 * here: a test calls the POS page object's actions itself. These turn data into what the page object
 * takes, and read back what the server saved.
 *
 *   await pos.addItem(itemOf(line))
 *   await checkSavedInvoice(api, invoiceName, sale)
 */
const { expect } = require('../fixtures')
const { paidRows, lineTax, lineOf } = require('./invoice')

/** The item of a data line, as the page object takes it: its code, and its name as shown on screen. */
const itemOf = (line) => ({ code: line.itemCode, name: line.itemName })

/** A partial return: [the sale's line that is kept, the sale's line that is returned], one each. */
function keptAndReturned(sale, saleReturn) {
  const returnedCodes = saleReturn.lines.map((line) => line.itemCode)
  const kept = sale.lines.filter((line) => !returnedCodes.includes(line.itemCode))
  const returned = sale.lines.filter((line) => returnedCodes.includes(line.itemCode))
  expect(kept.length === 1 && returned.length === 1, `${saleReturn.where}: one of the sale's two items is returned`).toBe(true)
  return [kept[0], returned[0]]
}

/**
 * Read the saved Sales Invoice (a sale or a return) by its name and compare it with the transaction's
 * data: soft checks, every mismatch reported. Returns the invoice for the test's own extra checks.
 */
async function checkSavedInvoice(api, name, transaction) {
  const invoice = await api.getDoc('Sales Invoice', name)
  expect.soft(invoice.docstatus, `${name} is submitted`).toBe(1)
  if (transaction.customerName) expect.soft(invoice.customer, 'Customer').toBe(transaction.customerName)
  for (const line of transaction.lines) {
    const saved = lineOf(invoice, line.itemCode)
    expect.soft(saved, `${name} has a line for ${line.itemCode}`).toBeTruthy()
    if (!saved) continue
    expect.soft(saved.qty, `${line.itemCode}: quantity`).toBe(line.qty)
    if (line.price !== undefined) expect.soft(saved.rate, `${line.itemCode}: price`).toBe(line.price)
    expect.soft(saved.amount, `${line.itemCode}: line total`).toBe(line.lineTotal)
    if (line.tax !== undefined) expect.soft(lineTax(invoice, saved), `${line.itemCode}: tax on the line`).toBe(line.tax)
    if (transaction.wareHouse) expect.soft(saved.warehouse, `${line.itemCode}: warehouse`).toBe(transaction.wareHouse)
  }
  expect.soft(invoice.items, `${name} has exactly the lines of the data`).toHaveLength(transaction.lines.length)
  if (transaction.totalTax !== undefined) expect.soft(invoice.total_taxes_and_charges, 'Total tax').toBe(transaction.totalTax)
  if (transaction.subTotal !== undefined) expect.soft(invoice.net_total, 'Sub total (before tax)').toBe(transaction.subTotal)
  expect.soft(invoice.grand_total, 'Grand total').toBe(transaction.grandTotal)
  expect.soft(paidRows(invoice), `Paid by ${transaction.paymentType}`).toEqual([{ mode: transaction.paymentType, amount: transaction.payAmount }])

  // Stock: each stock item moved by exactly its quantity (out on a sale, back in on a return).
  const expected = []
  for (const line of transaction.lines) {
    const item = await api.findDoc('Item', line.itemCode)
    if (item && item.is_stock_item) expected.push({ item: line.itemCode, qty: -line.qty })
  }
  const byItem = (first, second) => first.item.localeCompare(second.item)
  const moves = (await api.stockMovements(name)).map((movement) => ({ item: movement.item_code, qty: movement.actual_qty }))
  expect.soft(moves.sort(byItem), 'Stock moved by exactly the quantities').toEqual(expected.sort(byItem))
  return invoice
}

module.exports = { itemOf, keptAndReturned, checkSavedInvoice }
