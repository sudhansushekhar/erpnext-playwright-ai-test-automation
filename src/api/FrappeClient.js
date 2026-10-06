/**
 * FrappeClient: a small REST client for ERPNext (Frappe).
 *
 * Used by the seed to prepare test data, and by tests to read back the record
 * the screen booked, by its name. Never "the latest" or a count: the site keeps
 * every run's data, so those can match another run's record.
 *
 *   const api = await FrappeClient.signIn(baseUrl, user, password)
 *   const inv = await api.getDoc('Sales Invoice', name)
 */
const { request } = require('@playwright/test')

class FrappeClient {
  /** @param {import('@playwright/test').APIRequestContext} ctx */
  constructor(ctx) {
    this.ctx = ctx
  }

  /** A new API session signed in as `user`. Call dispose() when done. */
  static async signIn(baseUrl, user, password) {
    const ctx = await request.newContext({ baseURL: baseUrl })
    const res = await ctx.post('/api/method/login', { data: { usr: user, pwd: password } })
    if (!res.ok()) {
      await ctx.dispose()
      throw new Error(`Sign-in as ${user} failed: HTTP ${res.status()}`)
    }
    return new FrappeClient(ctx)
  }

  /** Wrap an existing request context, e.g. page.request, which shares the browser's session. */
  static fromContext(ctx) {
    return new FrappeClient(ctx)
  }

  async dispose() {
    await this.ctx.dispose()
  }

  async getDoc(doctype, name) {
    return this._json(await this.ctx.get(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`))
  }

  /** The doc, or null when it does not exist. */
  async findDoc(doctype, name) {
    const res = await this.ctx.get(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`)
    if (res.status() === 404) return null
    return this._json(res)
  }

  async insert(doctype, doc) {
    return this._json(await this.ctx.post(`/api/resource/${encodeURIComponent(doctype)}`, { data: doc }))
  }

  /**
   * The tax lines of a Sales Taxes and Charges Template, ready to put in a document's `taxes`.
   * Through the API, setting `taxes_and_charges` alone adds NO tax (the screen copies the lines
   * in for you; the API does not), so pass both:
   *   { taxes_and_charges: name, taxes: await api.salesTaxRows(name) }
   */
  async salesTaxRows(templateName) {
    const tpl = await this.getDoc('Sales Taxes and Charges Template', templateName)
    return tpl.taxes.map(({ charge_type, account_head, description, rate, tax_amount, included_in_print_rate }) =>
      charge_type === 'Actual'
        ? { charge_type, account_head, description, tax_amount } // a fixed amount, e.g. a delivery charge
        : { charge_type, account_head, description, rate, included_in_print_rate }, // e.g. GST inside the MRP
    )
  }

  /** Change some fields of an existing record. */
  async update(doctype, name, fields) {
    return this._json(
      await this.ctx.put(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, { data: fields }),
    )
  }

  async getList(doctype,{ filters = [], fields = ['name'], limit = 20 } = {}) {
    const params = new URLSearchParams({
      filters: JSON.stringify(filters),
      fields: JSON.stringify(fields),
      limit_page_length: String(limit),
    })
    return this._json(await this.ctx.get(`/api/resource/${encodeURIComponent(doctype)}?${params}`))
  }

  /**
   * The user this session is signed in as, or null when the server refuses because there is
   * no session (a Guest gets 403 from this endpoint in ERPNext v16).
   */
  async sessionUser() {
    const res = await this.ctx.get('/api/method/frappe.auth.get_logged_user')
    if (res.status() === 401 || res.status() === 403) return null
    const body = await this._body(res)
    if (!res.ok()) throw new Error(`get_logged_user: HTTP ${res.status()} ${shortError(body)}`)
    return body.message
  }

  /** Call a whitelisted server method: POST /api/method/<path>. Returns `message`. */
  async call(method, args = {}, { timeout } = {}) {
    const res = await this.ctx.post(`/api/method/${method}`, { form: args, ...(timeout ? { timeout } : {}) })
    const body = await this._body(res)
    if (!res.ok()) throw new Error(`${method}: HTTP ${res.status()} ${shortError(body)}`)
    return body.message
  }

  async _json(res) {
    const body = await this._body(res)
    if (!res.ok()) throw new Error(`${res.url()}: HTTP ${res.status()} ${shortError(body)}`)
    return body.data
  }

  async _body(res) {
    const text = await res.text()
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
