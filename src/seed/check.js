/**
 * `npm run check`: is the site ready to test, by hand or by the tests?
 *
 * Read-only: it changes nothing. It compares the site with TEST_DATA (src/seed/seed.js) and
 * prints one line per prerequisite. If anything is missing, `npm run seed` fixes it.
 */
const { request } = require('@playwright/test')
const { FrappeClient } = require('../api/FrappeClient')
const { ENV } = require('../../config/env')
const { TEST_DATA: testData } = require('./data')

const results = []
const check = async (label, run) => {
  try {
    const detail = await run()
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
  } catch {
    results.push({ ok: false, label: 'ERPNext is running', detail: `${ENV.baseUrl} does not answer: start it from the retail_pos_india folder: npm run erp:up` })
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
      const company = await api.findDoc('Company', testData.company)
      expect(company, `company ${testData.company} missing (setup wizard not run)`)
      expect(company.default_currency === testData.currency && company.country === testData.country, `${testData.company} is ${company.country}/${company.default_currency}, expected ${testData.country}/${testData.currency}: rebuild it from the retail_pos_india folder: npm run erp:reset`)
      const today = new Date().toISOString().slice(0, 10)
      const years = await api.getList('Fiscal Year', {
        filters: [['year_start_date', '<=', today], ['year_end_date', '>=', today]],
        fields: ['name', 'year_start_date'],
        limit: 1,
      })
      expect(years.length, `no fiscal year covers today (${today})`)
      const sys = await api.getDoc('System Settings', 'System Settings')
      return `${testData.company}, ${company.country}, ${company.default_currency}, FY ${years[0].name} (from ${years[0].year_start_date}), ${sys.time_zone}, numbers ${sys.number_format}, dates ${sys.date_format}`
    })

    await check('Customers and suppliers', async () => {
      const customers = [testData.customer, ...testData.demo.customers]
      const suppliers = [testData.supplier, ...testData.demo.suppliers]
      for (const customer of customers) expect(await api.findDoc('Customer', customer.name), `customer ${customer.name} missing`)
      for (const supplier of suppliers) expect(await api.findDoc('Supplier', supplier.name), `supplier ${supplier.name} missing`)
      return `${customers.length} customers, ${suppliers.length} suppliers`
    })

    await check('Items, prices and GST slabs', async () => {
      const items = [...Object.values(testData.items), ...testData.billingCounters.slice(1).map((counter) => counter.item), ...testData.demo.items] // counter 1's item is items.stock
      for (const item of items) {
        const doc = await api.findDoc('Item', item.code)
        expect(doc, `item ${item.code} missing`)
        const prices = [[testData.sellingPriceList, item.sellingPrice], [testData.buyingPriceList, item.buyingPrice]]
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
          const want = testData.gst.slabs[item.gst]
          expect((doc.taxes || []).some((itemTax) => itemTax.item_tax_template === want), `${item.code} is not on ${want}`)
        }
      }
      const stock = testData.items.stock
      return `${items.length} items · e.g. ${stock.code} buy ${stock.buyingPrice} / sell ${stock.sellingPrice} incl. ${stock.gst}% GST`
    })

    await check('Stock on hand', async () => {
      const short = []
      for (const item of [...testData.billingCounters.map((counter) => counter.item), testData.items.data, ...testData.demo.items]) {
        const [bin] = await api.getList('Bin', {
          filters: [['item_code', '=', item.code], ['warehouse', '=', testData.warehouse]],
          fields: ['actual_qty'],
          limit: 1,
        })
        const qty = bin ? bin.actual_qty : 0
        if (qty < item.stockQty) short.push(`${item.code} has ${qty}, expected ${item.stockQty}`)
      }
      expect(!short.length, short.join('; '))
      return `${testData.billingCounters.map((counter) => counter.item.code).join(', ')}: ${testData.items.stock.stockQty} each, and every demo item topped up, in ${testData.warehouse}`
    })

    await check('GST', async () => {
      for (const template of Object.values(testData.gst.slabs)) expect(await api.findDoc('Item Tax Template', template), `item tax template ${template} missing`)
      const tpl = await api.findDoc('Sales Taxes and Charges Template', testData.gst.template)
      expect(tpl, `template ${testData.gst.template} missing`)
      expect((tpl.taxes || []).every((line) => line.included_in_print_rate), 'GST lines are not included in the price')
      const defaults = await api.getList('Sales Taxes and Charges Template', { filters: [['company', '=', testData.company], ['is_default', '=', 1]] })
      expect(defaults.length === 1 && defaults[0].name === testData.gst.template, `default template(s): ${defaults.map((template) => template.name).join(', ') || 'none'}, expected only ${testData.gst.template}`)
      return `${testData.gst.template} (CGST + SGST, included in prices) is the only default · slabs ${Object.keys(testData.gst.slabs).join('%, ')}%`
    })

    await check('Retail POS India app installed', async () => {
      const apps = await api.getDoc('Installed Applications', 'Installed Applications')
      const row = (apps.installed_applications || []).find((app) => app.app_name === 'retail_pos_india')
      expect(row, 'not installed: from the retail_pos_india folder run npm run erp:app')
      const settings = await api.getDoc('POS Settings', 'POS Settings')
      const shown = (settings.invoice_fields || []).map((field) => field.fieldname)
      for (const field of ['rpi_card_type', 'rpi_card_last4', 'rpi_card_approval_code', 'rpi_upi_reference']) {
        expect(shown.includes(field), `${field} missing from the POS payment screen: from the retail_pos_india folder run npm run erp:app`)
      }
      return `v${row.app_version}: number pad, card and UPI fields on the payment screen, wider cart`
    })

    await check('Surcharges', async () => {
      const templates = [testData.surcharges.sale.template, testData.surcharges.item.template]
      for (const template of templates) expect(await api.findDoc('Sales Taxes and Charges Template', template), `template ${template} missing`)
      const eco = await api.getDoc('Item', testData.items.eco.code)
      expect((eco.taxes || []).some((itemTax) => itemTax.item_tax_template === testData.surcharges.item.itemTaxTemplate), `${testData.items.eco.code} does not carry its eco fee`)
      return templates.join(' · ')
    })

    await check('Demo users and roles', async () => {
      const lines = []
      for (const user of testData.users) {
        const doc = await api.findDoc('User', user.email)
        expect(doc && doc.enabled, `${user.email} missing or disabled`)
        const has = (doc.roles || []).map((userRole) => userRole.role)
        const missing = testData.roles[user.role].filter((role) => !has.includes(role))
        expect(!missing.length, `${user.email} lacks ${missing.join(', ')}`)
        lines.push(`${user.first} (${user.role})`)
      }
      return lines.join(', ')
    })

    await check('Payment modes have accounts', async () => {
      const lines = []
      for (const { mode, account } of testData.paymentModes) {
        const doc = await api.getDoc('Mode of Payment', mode)
        const row = (doc.accounts || []).find((accountRow) => accountRow.company === testData.company)
        expect(row && row.default_account === account, `${mode} has no account for ${testData.company} (POS will refuse it)`)
        lines.push(`${mode} → ${account}`)
      }
      return lines.join(' · ')
    })

    await check(`POS Profile ${testData.posProfile.name}`, async () => {
      const profile = await api.findDoc('POS Profile', testData.posProfile.name)
      expect(profile, 'missing')
      expect(!profile.disabled, 'disabled')
      expect(profile.warehouse === testData.warehouse, `warehouse is ${profile.warehouse}`)
      expect((profile.applicable_for_users || []).some((allowed) => allowed.user === ENV.adminUser), `${ENV.adminUser} may not use it`)
      expect((profile.payments || []).filter((payment) => payment.default).length === 1, 'needs exactly one default payment mode')
      expect(profile.taxes_and_charges === testData.gst.template, `charges ${profile.taxes_and_charges || 'no tax'}, expected ${testData.gst.template}`)
      // QA POS is for Administrator, the manager and the admin; cashiers have their own counters.
      for (const user of testData.users.filter((allowed) => allowed.role !== 'Cashier')) expect((profile.applicable_for_users || []).some((allowed) => allowed.user === user.email), `${user.email} may not use it`)
      const offered = await api.call('frappe.desk.search.search_link', {
        doctype: 'POS Profile',
        txt: '',
        query: 'erpnext.accounts.doctype.pos_profile.pos_profile.pos_profile_query',
        filters: JSON.stringify({ company: testData.company }),
      })
      expect(offered.some((option) => option.value === testData.posProfile.name), 'not offered on the POS screen')
      return `${profile.warehouse}, ${profile.selling_price_list}, ${profile.customer}, pays ${profile.payments.map((payment) => payment.mode_of_payment + (payment.default ? ' (default)' : '')).join(', ')}`
    })

    await check('Billing counters for the cashiers', async () => {
      const lines = []
      for (const billingCounter of testData.billingCounters.map((counter) => ({ name: counter.name, users: [counter.cashier.email] }))) {
        const profile = await api.findDoc('POS Profile', billingCounter.name)
        expect(profile && !profile.disabled, `${billingCounter.name} missing or disabled`)
        for (const user of billingCounter.users) expect((profile.applicable_for_users || []).some((allowed) => allowed.user === user && allowed.default), `${user} is not on ${billingCounter.name}`)
        lines.push(`${billingCounter.name}: ${billingCounter.users.map((email) => email.split('@')[0]).join(', ')}`)
      }
      const [rule] = await api.getList('Custom DocPerm', {
        filters: [['parent', '=', 'POS Opening Entry'], ['role', '=', testData.cashierRole.name]],
        fields: ['if_owner', 'create', 'submit'],
        limit: 1,
      })
      expect(rule && rule.create && rule.submit && rule.if_owner, `role ${testData.cashierRole.name} cannot open its own POS session`)
      return `${lines.join(' · ')} · Cashier role opens/closes own sessions only`
    })

    await check('QA Testing page and landing page', async () => {
      expect(await api.findDoc('Workspace', testData.qaPage), `page ${testData.qaPage} missing`)
      const [sidebar] = await api.getList('Custom Sidebar', { filters: [['module', '=', testData.qaPage], ['user', 'is', 'not set']], limit: 1 })
      expect(sidebar, 'its sidebar is missing')
      const user = await api.getDoc('User', ENV.adminUser)
      expect(user.default_workspace === testData.landingWorkspace, `${ENV.adminUser} lands on ${user.default_workspace || 'the app launcher'}`)
      return `${ENV.adminUser} lands on ${testData.landingWorkspace} (${ENV.baseUrl}/desk/qa-testing)`
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
        ? open.map((entry) => `${entry.name} (${entry.user}, ${entry.pos_profile}, since ${entry.period_start_date})`).join(' · ')
        : 'none: the POS screen will ask you to open one (pick QA POS, enter the opening cash)',
    })
  } finally {
    await api.dispose()
  }
}

main()
  .catch((err) => results.push({ ok: false, label: 'Check', detail: err.message }))
  .finally(() => {
    for (const result of results) console.log(`${result.info ? 'ℹ️ ' : result.ok ? '✅' : '❌'} ${result.label}: ${result.detail}`)
    const failed = results.filter((result) => !result.ok).length
    console.log(failed ? `\n${failed} not ready. Run: npm run seed` : '\nReady to test.')
    process.exitCode = failed ? 1 : 0
  })
