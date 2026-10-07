/**
 * Tills: open and close a POS till (a POS session) through the API, for test setup and teardown.
 * Tests about the POS screens should not spend their time on the opening dialog or the closing
 * form (CLAUDE.md rule 7); the tests that ARE about them use the screens.
 *
 *   const tills = new Tills(api, { company, timeZone, openingCash })
 *   const opening = await tills.open({ till: 'Till 1', user: 'anjali.verma@qa-retail.test' })
 *   await tills.close(opening)
 *
 * Closing does what ERPNext's POS Closing Entry form does in the browser: fetch the session's
 * invoices (get_invoices), start each payment mode at its opening amount, add what each mode
 * took, count the closing amount as expected (no difference), then save and submit.
 */
class Tills {
  /**
   * @param {import('./FrappeClient').FrappeClient} api  signed in as a user who may open any till
   * @param {{ company: string, timeZone: string, openingCash: number }} options
   */
  constructor(api, { company, timeZone, openingCash }) {
    this.api = api
    this.company = company
    this.timeZone = timeZone
    this.openingCash = openingCash
  }

  /** Open a session on `till` for `user`, with the opening cash in the drawer. Returns its name. */
  async open({ till, user, openingCash = this.openingCash }) {
    const now = await this.api.serverNow(this.timeZone)
    const entry = await this.api.insert('POS Opening Entry', {
      company: this.company,
      pos_profile: till,
      user,
      period_start_date: now,
      posting_date: now.slice(0, 10),
      balance_details: [{ mode_of_payment: 'Cash', opening_amount: openingCash }],
    })
    await this.api.call('frappe.client.submit', { doc: JSON.stringify(entry) })
    return entry.name
  }

  /** Close an open session as its cashier would: counted cash = expected. Returns the closing entry's name. */
  async close(openingName) {
    const opening = await this.api.getDoc('POS Opening Entry', openingName)
    const end = await this.api.serverNow(this.timeZone)
    const data = await this.api.call('erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry.get_invoices', {
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

    const closing = await this.api.insert('POS Closing Entry', {
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
    await this.api.call('frappe.client.submit', { doc: JSON.stringify(closing) })
    return closing.name
  }

  /** The names of `user`'s open sessions. */
  async openOf(user) {
    const open = await this.api.getList('POS Opening Entry', {
      filters: [['user', '=', user], ['status', '=', 'Open'], ['docstatus', '=', 1]],
      limit: 20,
    })
    return open.map((o) => o.name)
  }

  /** Close every open session of `user` (left over by a crashed run). Returns how many were closed. */
  async closeAllOf(user) {
    const open = await this.openOf(user)
    for (const name of open) await this.close(name)
    return open.length
  }

  /** A session's status: "Open" or "Closed". */
  async status(openingName) {
    return (await this.api.getDoc('POS Opening Entry', openingName)).status
  }
}

module.exports = { Tills }
