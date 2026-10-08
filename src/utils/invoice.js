/**
 * Reading a Sales Invoice read back with `api.getDoc('Sales Invoice', name)`.
 * Pure functions: no browser, no server.
 */

/** The payment rows that took money, e.g. [{ mode: 'Cash', amount: 118 }]. A POS sale lists every
 * payment mode of its POS Profile; the unused ones are kept at 0 and left out here. */
const paidRows = (invoice) =>
  invoice.payments.filter((payment) => payment.amount).map((payment) => ({ mode: payment.mode_of_payment, amount: payment.amount }))

/** The amount booked on one tax account, e.g. taxOn(invoice, 'Output Tax CGST - QAR') → 9. */
const taxOn = (invoice, account) => invoice.taxes.find((tax) => tax.account_head === account)?.tax_amount

/** The tax (all GST lines together) booked on one invoice line, from its item-wise tax details. */
const lineTax = (invoice, line) =>
  Math.round((invoice.item_wise_tax_details || []).filter((tax) => tax.item_row === line.name).reduce((sum, tax) => sum + tax.amount, 0) * 100) / 100

/** The invoice line of an item, e.g. lineOf(invoice, 'QA-STOCK-001'). */
const lineOf = (invoice, itemCode) => invoice.items.find((item) => item.item_code === itemCode)

module.exports = { paidRows, taxOn, lineTax, lineOf }
