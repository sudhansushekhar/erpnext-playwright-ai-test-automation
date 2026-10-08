/**
 * FrappeClient: a small REST client for ERPNext (Frappe).
 *
 * Used by the seed to prepare test data, and by tests to read back the record
 * the screen booked, by its name. Never "the latest" or a count: the site keeps
 * every run's data, so those can match another run's record.
 *
 *   const api = await FrappeClient.signIn(baseUrl, user, password)
 *   const invoice = await api.getDoc('Sales Invoice', name)
 */
const { request } = require('@playwright/test')
const { step, note } = require('../report')

class FrappeClient {
  /** @param {import('@playwright/test').APIRequestContext} requestContext */
  constructor(requestContext) {
    this.requestContext = requestContext
  }

  /** A new API session signed in as `user`. Call dispose() when done. */
  static async signIn(baseUrl, user, password) {
    const requestContext = await request.newContext({ baseURL: baseUrl })
    const response = await requestContext.post('/api/method/login', { data: { usr: user, pwd: password } })
    if (!response.ok()) {
      await requestContext.dispose()
      throw new Error(`Sign-in as ${user} failed: HTTP ${response.status()}`)
    }
    return new FrappeClient(requestContext)
  }

  /** Wrap an existing request context, e.g. page.request, which shares the browser's session. */
  static fromContext(requestContext) {
    return new FrappeClient(requestContext)
  }

  async dispose() {
    await this.requestContext.dispose()
  }

  async getDoc(doctype, name) {
    return step(`Read ${doctype} ${name} from the server`, async () =>
      this._json(await this.requestContext.get(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`)))
  }

  /** The doc, or null when it does not exist. */
  async findDoc(doctype, name) {
    const response = await this.requestContext.get(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`)
    if (response.status() === 404) return null
    return this._json(response)
  }

  async insert(doctype, doc) {
    return this._json(await this.requestContext.post(`/api/resource/${encodeURIComponent(doctype)}`, { data: doc }))
  }

  /**
   * The tax lines of a Sales Taxes and Charges Template, ready to put in a document's `taxes`.
   * Through the API, setting `taxes_and_charges` alone adds NO tax (the screen copies the lines
   * in for you; the API does not), so pass both:
   *   { taxes_and_charges: name, taxes: await api.salesTaxRows(name) }
   */
  async salesTaxRows(templateName) {
    const template = await this.getDoc('Sales Taxes and Charges Template', templateName)
    return template.taxes.map(({ charge_type, account_head, description, rate, tax_amount, included_in_print_rate }) =>
      charge_type === 'Actual'
        ? { charge_type, account_head, description, tax_amount } // a fixed amount, e.g. a delivery charge
        : { charge_type, account_head, description, rate, included_in_print_rate }, // e.g. GST inside the MRP
    )
  }

  /** Stock of an item in a warehouse now (its Bin), 0 when it never had any. */
  async stockQty(itemCode, warehouse) {
    return step(`Read the stock of ${itemCode} in ${warehouse}`, async () => {
      const [bin] = await this.getList('Bin', {
        filters: [['item_code', '=', itemCode], ['warehouse', '=', warehouse]],
        fields: ['actual_qty'],
      })
      const qty = bin ? bin.actual_qty : 0
      await note(`Stock of ${itemCode} in ${warehouse}: ${qty}`)
      return qty
    })
  }

  /** The stock movements a document booked (its Stock Ledger Entries), e.g. a sales invoice's. */
  async stockMovements(voucherNo) {
    return step(`Read the stock movements of ${voucherNo}`, async () => {
      const moves = await this.getList('Stock Ledger Entry', {
        filters: [['voucher_no', '=', voucherNo], ['is_cancelled', '=', 0]],
        fields: ['item_code', 'warehouse', 'actual_qty'],
      })
      await note(`Stock moved by ${voucherNo}: ${moves.map((move) => `${move.actual_qty} × ${move.item_code} (${move.warehouse})`).join(', ') || 'nothing'}`)
      return moves
    })
  }

  /** Change some fields of an existing record. */
  async update(doctype, name, fields) {
    return this._json(
      await this.requestContext.put(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { data: fields }),
    )
  }

  async getList(doctype,{ filters = [], fields = ['name'], limit = 20 } = {}) {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters),
      fields: JSON.stringify(fields),
      limit_page_length: String(limit),
    })
    return this._json(await this.requestContext.get(`/api/resource/${encodeURIComponent(doctype)}?${params}`))
  }

  /**
   * The user this session is signed in as, or null when the server refuses because there is
   * no session (a Guest gets 403 from this endpoint in ERPNext v16).
   */
  async sessionUser() {
    return step('Ask the server who is signed in', async () => {
      const response = await this.requestContext.get('/api/method/frappe.auth.get_logged_user')
      if (response.status() === 401 || response.status() === 403) return null
      const body = await this._body(response)
      if (!response.ok()) throw new Error(`get_logged_user: HTTP ${response.status()} ${shortError(body)}`)
      return body.message
    })
  }

  /** The HTTP status the server answers "who is signed in?" with: 200 signed in, 401 session ended. */
  async sessionStatus() {
    return step('Ask the server whether this session is still signed in', async () =>
      (await this.requestContext.get('/api/method/frappe.auth.get_logged_user')).status())
  }

  /** Call a whitelisted server method: POST /api/method/<path>. Returns `message`. */
  async call(method, args = {}, { timeout } = {}) {
    const response = await this.requestContext.post(`/api/method/${method}`, { form: args, ...(timeout ? { timeout } : {}) })
    const body = await this._body(response)
    if (!response.ok()) throw new Error(`${method}: HTTP ${response.status()} ${shortError(body)}`)
    return body.message
  }

  /**
   * The server's clock as a site datetime ("YYYY-MM-DD HH:mm:ss" in the site's time zone), from
   * the HTTP Date header: correct even when this machine runs in another time zone (e.g. CI in UTC).
   */
  async serverNow(timeZone) {
    const response = await this.requestContext.get('/api/method/ping')
    const serverTime = new Date(response.headers()['date'])
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(serverTime).map((part) => [part.type, part.value]),
    )
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
  }

  async _json(response) {
    const body = await this._body(response)
    if (!response.ok()) throw new Error(`${response.url()}: HTTP ${response.status()} ${shortError(body)}`)
    return body.data
  }

  async _body(response) {
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text.slice(0, 300) }
    }
  }
}

function shortError(body) {
  return String(body.exception || body.exc_type || body._server_messages || body.raw || '').slice(0, 300)
}

module.exports = { FrappeClient }
