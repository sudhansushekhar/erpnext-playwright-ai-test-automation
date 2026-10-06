/**
 * `npm run check`: is the site ready to test, by hand or by the tests?
 *
 * Read-only: it changes nothing. It compares the site with TEST_DATA (src/seed/seed.js) and
 * prints one line per prerequisite. If anything is missing, `npm run seed` fixes it.
 */
const { request } = require('@playwright/test')
const { FrappeClient } = require('../api/FrappeClient')
const { ENV } = require('../../config/env')
const { TEST_DATA: d } = require('./data')

const results = []
const check = async (label, fn) => {
  try {
    const detail = await fn()
    results.push({ ok: true, label, detail })
  } catch (err) {
    results.push({ ok: false, label, detail: err.message })
  }
}
const expect = (condition, problem) => {
  if (!condition) throw new Error(problem)
}

async function main() {
  const ping = await request.newContext({ baseURL: ENV.baseUrl })
  try {
    const res = await ping.get('/api/method/ping', { timeout: 10000 })
    expect(res.ok(), `HTTP ${res.status()}`)
    results.push({ ok: true, label: 'ERPNext is running', detail: ENV.baseUrl })
  } catch (err) {
    results.push({ ok: false, label: 'ERPNext is running', detail: `${ENV.baseUrl} does not answer: start it with npm run erp:up` })
    return
  } finally {
    await ping.dispose()
  }

  let api
  try {
    api = await FrappeClient.signIn(ENV.baseUrl, ENV.adminUser, ENV.adminPassword)
    results.push({ ok: true, label: `Sign in as ${ENV.adminUser}`, detail: 'password from .env works' })
  } catch (err) {
    results.push({ ok: false, label: `Sign in as ${ENV.adminUser}`, detail: err.message })
    return
  }

  try {
    await check('Company, India settings', async () => {
      const company = await api.findDoc('Company', d.company)
      expect(company, `company ${d.company} missing (setup wizard not run)`)
      expect(company.default_currency === d.currency && company.country === d.country, `${d.company} is ${company.country}/${company.default_currency}, expected ${d.country}/${d.currency}: rebuild with npm run erp:reset`)
      const today = new Date().toISOString().slice(0, 10)
      const years = await api.getList('Fiscal Year', {
        filters: [['year_start_date', '<=', today], ['year_end_date', '>=', today]],
        fields: ['name', 'year_start_date'],
        limit: 1,
      })
      expect(years.length, `no fiscal year covers today (${today})`)
      const sys = await api.getDoc('System Settings', 'System Settings')
      return `${d.company}, ${company.country}, ${company.default_currency}, FY ${years[0].name} (from ${years[0].year_start_date}), ${sys.time_zone}, numbers ${sys.number_format}, dates ${sys.date_format}`
    })

    await check('Customers and suppliers', async () => {
      const customers = [d.customer, ...d.demo.customers]
      const suppliers = [d.supplier, ...d.demo.suppliers]
      for (const c of customers) expect(await api.findDoc('Customer', c.name), `customer ${c.name} missing`)
      for (const s of suppliers) expect(await api.findDoc('Supplier', s.name), `supplier ${s.name} missing`)
      return `${customers.length} customers, ${suppliers.length} suppliers`
    })

    await check('Items, prices and GST slabs', async () => {
      const items = [...Object.values(d.items), ...d.demo.items]
      for (const item of items) {
        const doc = await api.findDoc('Item', item.code)
        expect(doc, `item ${item.code} missing`)
        const prices = [[d.sellingPriceList, item.sellingPrice], [d.buyingPriceList, item.buyingPrice]]
        for (const [list, want] of prices) {
          if (want === undefined) continue
          const [row] = await api.getList('Item Price', {
            filters: [['item_code', '=', item.code], ['price_list', '=', list]],
            fields: ['price_list_rate'],
            limit: 1,
          })
          expect(row && row.price_list_rate === want, `${item.code} ${list} is ${row ? row.price_list_rate : 'missing'}, expected ${want}`)
        }
        if (item.gst !== undefined) {
          const want = d.gst.slabs[item.gst]
          expect((doc.taxes || []).some((t) => t.item_tax_template === want), `${item.code} is not on ${want}`)
        }
      }
      const s = d.items.stock
      return `${items.length} items · e.g. ${s.code} buy ${s.buyingPrice} / sell ${s.sellingPrice} incl. ${s.gst}% GST`
    })

    await check('Stock on hand', async () => {
      const short = []
      for (const item of [d.items.stock, ...d.demo.items]) {
        const [bin] = await api.getList('Bin', {
          filters: [['item_code', '=', item.code], ['warehouse', '=', d.warehouse]],
          fields: ['actual_qty'],
          limit: 1,
        })
        const qty = bin ? bin.actual_qty : 0
        if (qty < item.stockQty) short.push(`${item.code} has ${qty}, expected ${item.stockQty}`)
      }
      expect(!short.length, short.join('; '))
      return `${d.items.stock.code}: ${d.items.stock.stockQty} and every demo item topped up, in ${d.warehouse}`
    })

    await check('GST', async () => {
      for (const t of Object.values(d.gst.slabs)) expect(await api.findDoc('Item Tax Template', t), `item tax template ${t} missing`)
      const tpl = await api.findDoc('Sales Taxes and Charges Template', d.gst.template)
      expect(tpl, `template ${d.gst.template} missing`)
      expect((tpl.taxes || []).every((t) => t.included_in_print_rate), 'GST lines are not included in the price')
      const defaults = await api.getList('Sales Taxes and Charges Template', { filters: [['company', '=', d.company], ['is_default', '=', 1]] })
      expect(defaults.length === 1 && defaults[0].name === d.gst.template, `default template(s): ${defaults.map((t) => t.name).join(', ') || 'none'}, expected only ${d.gst.template}`)
      return `${d.gst.template} (CGST + SGST, included in prices) is the only default · slabs ${Object.keys(d.gst.slabs).join('%, ')}%`
    })

    await check('Retail POS India app installed', async () => {
      const apps = await api.getDoc('Installed Applications', 'Installed Applications')
      const row = (apps.installed_applications || []).find((a) => a.app_name === 'retail_pos_india')
      expect(row, 'not installed: run npm run erp:apps')
      const settings = await api.getDoc('POS Settings', 'POS Settings')
      const shown = (settings.invoice_fields || []).map((f) => f.fieldname)
      for (const f of ['rpi_card_type', 'rpi_card_last4', 'rpi_card_approval_code', 'rpi_upi_reference']) {
        expect(shown.includes(f), `${f} missing from the POS payment screen: run npm run erp:apps`)
      }
      return `v${row.app_version}: number pad, card and UPI fields on the payment screen, wider cart`
    })

    await check('Surcharges', async () => {
      const templates = [d.surcharges.sale.template, d.surcharges.item.template]
      for (const t of templates) expect(await api.findDoc('Sales Taxes and Charges Template', t), `template ${t} missing`)
      const eco = await api.getDoc('Item', d.items.eco.code)
      expect((eco.taxes || []).some((r) => r.item_tax_template === d.surcharges.item.itemTaxTemplate), `${d.items.eco.code} does not carry its eco fee`)
      return templates.join(' · ')
    })

    await check('Demo users and roles', async () => {
      const lines = []
      for (const u of d.users) {
        const doc = await api.findDoc('User', u.email)
        expect(doc && doc.enabled, `${u.email} missing or disabled`)
        const has = (doc.roles || []).map((r) => r.role)
        const missing = d.roles[u.role].filter((r) => !has.includes(r))
        expect(!missing.length, `${u.email} lacks ${missing.join(', ')}`)
        lines.push(`${u.first} (${u.role})`)
      }
      return lines.join(', ')
    })

    await check('Payment modes have accounts', async () => {
      const lines = []
      for (const { mode, account } of d.paymentModes) {
        const doc = await api.getDoc('Mode of Payment', mode)
        const row = (doc.accounts || []).find((r) => r.company === d.company)
        expect(row && row.default_account === account, `${mode} has no account for ${d.company} (POS will refuse it)`)
        lines.push(`${mode} → ${account}`)
      }
      return lines.join(' · ')
    })

    await check(`POS Profile ${d.posProfile.name}`, async () => {
      const p = await api.findDoc('POS Profile', d.posProfile.name)
      expect(p, 'missing')
      expect(!p.disabled, 'disabled')
      expect(p.warehouse === d.warehouse, `warehouse is ${p.warehouse}`)
      expect((p.applicable_for_users || []).some((u) => u.user === ENV.adminUser), `${ENV.adminUser} may not use it`)
      expect((p.payments || []).filter((r) => r.default).length === 1, 'needs exactly one default payment mode')
      expect(p.taxes_and_charges === d.gst.template, `charges ${p.taxes_and_charges || 'no tax'}, expected ${d.gst.template}`)
      // QA POS is for Administrator, the manager and the admin; cashiers have their own tills.
      for (const u of d.users.filter((x) => x.role !== 'Cashier')) expect((p.applicable_for_users || []).some((x) => x.user === u.email), `${u.email} may not use it`)
      const offered = await api.call('frappe.desk.search.search_link', {
        doctype: 'POS Profile',
        txt: '',
        query: 'erpnext.accounts.doctype.pos_profile.pos_profile.pos_profile_query',
        filters: JSON.stringify({ company: d.company }),
      })
      expect(offered.some((o) => o.value === d.posProfile.name), 'not offered on the POS screen')
      return `${p.warehouse}, ${p.selling_price_list}, ${p.customer}, pays ${p.payments.map((r) => r.mode_of_payment + (r.default ? ' (default)' : '')).join(', ')}`
    })

    await check('Tills for the cashiers', async () => {
      const lines = []
      for (const t of d.tills) {
        const p = await api.findDoc('POS Profile', t.name)
        expect(p && !p.disabled, `${t.name} missing or disabled`)
        for (const u of t.users) expect((p.applicable_for_users || []).some((x) => x.user === u && x.default), `${u} is not on ${t.name}`)
        lines.push(`${t.name}: ${t.users.map((u) => u.split('@')[0]).join(', ')}`)
      }
      const [rule] = await api.getList('Custom DocPerm', {
        filters: [['parent', '=', 'POS Opening Entry'], ['role', '=', d.cashierRole.name]],
        fields: ['if_owner', 'create', 'submit'],
        limit: 1,
      })
      expect(rule && rule.create && rule.submit && rule.if_owner, `role ${d.cashierRole.name} cannot open its own POS session`)
      return `${lines.join(' · ')} · Cashier role opens/closes own sessions only`
    })

    await check('QA Testing page and landing page', async () => {
      expect(await api.findDoc('Workspace', d.qaPage), `page ${d.qaPage} missing`)
      const [sidebar] = await api.getList('Custom Sidebar', { filters: [['module', '=', d.qaPage], ['user', 'is', 'not set']], limit: 1 })
      expect(sidebar, 'its sidebar is missing')
      const user = await api.getDoc('User', ENV.adminUser)
      expect(user.default_workspace === d.landingWorkspace, `${ENV.adminUser} lands on ${user.default_workspace || 'the app launcher'}`)
      return `${ENV.adminUser} lands on ${d.landingWorkspace} (${ENV.baseUrl}/desk/qa-testing)`
    })

    // Information, not a failure: an open POS session is normal while testing by hand.
    const open = await api.getList('POS Opening Entry', {
      filters: [['status', '=', 'Open'], ['docstatus', '=', 1]],
      fields: ['name', 'user', 'pos_profile', 'period_start_date'],
      limit: 10,
    })
    results.push({
      ok: true,
      info: true,
      label: 'Open POS sessions',
      detail: open.length
        ? open.map((o) => `${o.name} (${o.user}, ${o.pos_profile}, since ${o.period_start_date})`).join(' · ')
        : 'none: the POS screen will ask you to open one (pick QA POS, enter the opening cash)',
    })
  } finally {
    await api.dispose()
  }
}

main()
  .catch((err) => results.push({ ok: false, label: 'Check', detail: err.message }))
  .finally(() => {
    for (const r of results) console.log(`${r.info ? 'ℹ️ ' : r.ok ? '✅' : '❌'} ${r.label}: ${r.detail}`)
    const failed = results.filter((r) => !r.ok).length
    console.log(failed ? `\n${failed} not ready. Run: npm run seed` : '\nReady to test.')
    process.exitCode = failed ? 1 : 0
  })
