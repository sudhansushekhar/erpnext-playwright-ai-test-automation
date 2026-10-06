/**
 * Opening and closing a POS till (a POS session) through the API, for test setup and teardown.
 * Tests about the POS screens should not spend their time on the opening dialog or the closing
 * form (CLAUDE.md rule 7); the tests that ARE about them use the screens.
 *
 * Closing does what ERPNext's POS Closing Entry form does in the browser: fetch the session's
 * invoices (get_invoices), start each payment mode at its opening amount, add what each mode
 * took, count the closing amount as expected (no difference), then save and submit.
 */

/** Open a session on `posProfile` for `user`, with `openingCash` in the drawer. Returns its name. */
async function openTill(api, { company, posProfile, user, openingCash, timeZone }) {
  const now = await api.serverNow(timeZone)
  const entry = await api.insert('POS Opening Entry', {
    company,
    pos_profile: posProfile,
    user,
    period_start_date: now,
    posting_date: now.slice(0, 10),
    balance_details: [{ mode_of_payment: 'Cash', opening_amount: openingCash }],
  })
  await api.call('frappe.client.submit', { doc: JSON.stringify(entry) })
  return entry.name
}

/** Close an open session as its cashier would: counted cash = expected. Returns the closing entry's name. */
async function closeTill(api, openingName, { timeZone }) {
  const opening = await api.getDoc('POS Opening Entry', openingName)
  const end = await api.serverNow(timeZone)
  const data = await api.call('erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry.get_invoices', {
    start: opening.period_start_date,
    end,
    pos_profile: opening.pos_profile,
    user: opening.user,
  })

  const reconciliation = opening.balance_details.map((b) => ({
    mode_of_payment: b.mode_of_payment,
    opening_amount: b.opening_amount,
    expected_amount: b.opening_amount,
    closing_amount: b.opening_amount,
  }))
  for (const p of data.payments) {
    let row = reconciliation.find((r) => r.mode_of_payment === p.mode_of_payment)
    if (!row) reconciliation.push((row = { mode_of_payment: p.mode_of_payment, opening_amount: 0, expected_amount: 0, closing_amount: 0 }))
    row.expected_amount += p.amount
    row.closing_amount = row.expected_amount
  }
  const sum = (key) => data.invoices.reduce((total, inv) => total + (inv[key] || 0), 0)

  const closing = await api.insert('POS Closing Entry', {
    pos_opening_entry: opening.name,
    company: opening.company,
    pos_profile: opening.pos_profile,
    user: opening.user,
    period_start_date: opening.period_start_date,
    period_end_date: end,
    posting_date: end.slice(0, 10),
    posting_time: end.slice(11),
    sales_invoices: data.invoices.map((inv) => ({
      sales_invoice: inv.name,
      posting_date: inv.posting_date,
      grand_total: inv.grand_total,
      customer: inv.customer,
      is_return: inv.is_return,
      return_against: inv.return_against,
    })),
    payment_reconciliation: reconciliation,
    taxes: data.taxes.map((t) => ({ account_head: t.account_head, amount: t.tax_amount })),
    grand_total: sum('grand_total'),
    net_total: sum('net_total'),
    total_quantity: sum('total_qty'),
    total_taxes_and_charges: sum('total_taxes_and_charges'),
  })
  await api.call('frappe.client.submit', { doc: JSON.stringify(closing) })
  return closing.name
}

/** Close every open session of `user` (left over by a crashed run). Returns how many were closed. */
async function closeOpenTillsOf(api, user, { timeZone }) {
  const open = await api.getList('POS Opening Entry', {
    filters: [['user', '=', user], ['status', '=', 'Open'], ['docstatus', '=', 1]],
    limit: 20,
  })
  for (const { name } of open) await closeTill(api, name, { timeZone })
  return open.length
}

module.exports = { openTill, closeTill, closeOpenTillsOf }
