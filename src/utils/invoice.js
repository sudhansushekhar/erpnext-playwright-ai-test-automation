/**
 * Reading a Sales Invoice read back with `api.getDoc('Sales Invoice', name)`.
 * Pure functions: no browser, no server.
 */

/** The payment rows that took money, e.g. [{ mode: 'Cash', amount: 118 }]. A POS sale lists every
 * payment mode of its POS Profile; the unused ones are kept at 0 and left out here. */
const paidRows = (invoice) =>
  invoice.payments.filter((p) => p.amount).map((p) => ({ mode: p.mode_of_payment, amount: p.amount }))

/** The amount booked on one tax account, e.g. taxOn(invoice, 'Output Tax CGST - QAR') → 9. */
const taxOn = (invoice, account) => invoice.taxes.find((t) => t.account_head === account)?.tax_amount

module.exports = { paidRows, taxOn }
