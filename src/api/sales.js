/**
 * Sales: make POS sales and returns through the API: the prerequisite of a test about something
 * else (a sale to return on screen), or a test of what the server books (a return through the API).
 * Tests about the selling screens use the POS screen (CLAUDE.md rule 7).
 *
 *   const sales = new Sales(api, testData)
 *   const name = await sales.create({ counter: 'Billing Counter 1', lines: [{ itemCode, qty }], payment: { type: 'Cash', amount: 295 } })
 *   const returnName = await sales.createReturn({ against: name, lines: [{ itemCode, qty: -1 }], payment: { type: 'Cash', amount: -118 } })
 *
 * The sale is what the POS screen would have saved: a submitted Sales Invoice made at a POS
 * (is_created_using_pos, so Recent Orders lists it), GST from the counter's template, stock updated.
 */
const { step, note } = require('../report')

class Sales {
  /**
   * @param {import('./FrappeClient').FrappeClient} api
   * @param {object} testData  the seed's data (company, warehouse, customer, GST template)
   */
  constructor(api, testData) {
    this.api = api
    this.testData = testData
  }

  /** Make and submit a POS sale at `counter`. Returns the invoice's name. */
  async create({ counter, lines, payment }) {
    const what = lines.map((line) => `${line.qty} × ${line.itemCode}`).join(', ')
    return step(`Make a sale through the API at ${counter}: ${what}`, async () => {
      // Payment rows as the POS screen makes them: every payment mode of the counter, its default
      // marked, the amount on the mode paid with. A return copies these rows; with only the paid
      // mode and no default, the return's payment screen selected no mode at all.
      const profile = await this.api.getDoc('POS Profile', counter)
      const payments = profile.payments.map((row) => ({
        mode_of_payment: row.mode_of_payment,
        default: row.default,
        amount: row.mode_of_payment === payment.type ? payment.amount : 0,
      }))
      const draft = await this.api.insert('Sales Invoice', {
        is_pos: 1,
        is_created_using_pos: 1, // the POS screen sets it; Recent Orders lists only these
        pos_profile: counter,
        company: this.testData.company,
        customer: this.testData.posProfile.customer,
        update_stock: 1,
        set_warehouse: this.testData.warehouse,
        taxes_and_charges: this.testData.gst.template,
        taxes: await this.api.salesTaxRows(this.testData.gst.template),
        items: lines.map((line) => ({ item_code: line.itemCode, qty: line.qty })),
        payments,
      })
      await this.api.call('frappe.client.submit', { doc: JSON.stringify(draft) })
      await note(`Sale ${draft.name} made through the API: ${what}, grand total ₹ ${draft.grand_total}`)
      return draft.name
    })
  }

  /**
   * Return a POS sale through the API, as the POS screen's Return does: ERPNext's own
   * make_sales_return maps the sale into a return (is_return, return_against, negative lines),
   * then each returned line gets its quantity (negative) and the refund goes on `payment.type`.
   * Lines of the sale not in `lines` are not returned. Returns the return's name.
   */
  async createReturn({ against, lines, payment }) {
    const what = lines.map((line) => `${line.qty} × ${line.itemCode}`).join(', ')
    return step(`Return sale ${against} through the API: ${what}`, async () => {
      const mapped = await this.api.call('erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return', { source_name: against })
      const quantities = new Map(lines.map((line) => [line.itemCode, line.qty]))
      mapped.items = mapped.items
        .filter((item) => quantities.has(item.item_code))
        .map((item) => ({ ...item, qty: quantities.get(item.item_code), stock_qty: undefined }))
      mapped.payments = mapped.payments.map((row) => ({ ...row, amount: row.mode_of_payment === payment.type ? payment.amount : 0 }))
      const draft = await this.api.insert('Sales Invoice', mapped)
      await this.api.call('frappe.client.submit', { doc: JSON.stringify(draft) })
      await note(`Return ${draft.name} of ${against} made through the API: ${what}, grand total ₹ ${draft.grand_total}`)
      return draft.name
    })
  }
}

module.exports = { Sales }
