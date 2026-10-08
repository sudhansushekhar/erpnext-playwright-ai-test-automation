/**
 * The seed: prepares the test and demo data through the REST API, before any test runs.
 * Like setting the table before the guests arrive. Every value comes from ./data.js.
 *
 * Rules:
 *   - Safe to run before every run: it creates what is missing, corrects what drifted (prices,
 *     roles, settings), tops up stock, and never assumes a clean site.
 *   - Tests never set up data through the screens; they use the `testData` fixture
 *     (.results/test-data.json, written here).
 */
const fs = require('fs')
const path = require('path')
const { FrappeClient } = require('../api/FrappeClient')
const { ENV } = require('../../config/env')
const { TEST_DATA, ABBR } = require('./data')

const testData = TEST_DATA

async function seed({ log = console.log } = {}) {
  const api = await FrappeClient.signIn(ENV.baseUrl, ENV.adminUser, ENV.adminPassword)
  try {
    await ensureSetupComplete(api, log)

    // Taxes and charges first: items point at their templates.
    await ensureGst(api, log)
    await ensureSaleSurcharge(api, log)
    await ensureItemSurcharge(api, log)

    // Parties.
    await ensureCustomer(api, log, testData.customer)
    for (const customer of testData.demo.customers) await ensureCustomer(api, log, customer)
    await ensureSupplier(api, log, testData.supplier)
    for (const supplier of testData.demo.suppliers) await ensureSupplier(api, log, supplier)

    // Items, prices, stock.
    for (const group of testData.demo.itemGroups) await ensureItemGroup(api, log, group)
    for (const counter of testData.billingCounters) await ensureItem(api, log, counter.item, { isStock: true }) // one per billing counter
    await ensureItem(api, log, testData.items.service, { isStock: false })
    await ensureItem(api, log, testData.items.data, { isStock: true })
    await ensureItem(api, log, testData.items.eco, { isStock: false, itemTaxTemplate: testData.surcharges.item.itemTaxTemplate })
    for (const item of testData.demo.items) await ensureItem(api, log, { uom: 'Nos', ...item }, { isStock: true })
    for (const item of [...testData.billingCounters.map((counter) => counter.item), testData.items.data, ...testData.demo.items]) await ensureStock(api, log, item)

    // Point of sale, people, page.
    await ensurePaymentModes(api, log)
    await ensureCashierRole(api, log)
    for (const user of testData.users) await ensureUser(api, log, user)
    await ensureSessionLimits(api, log)
    await ensurePosProfile(api, log)
    await ensureQaPage(api, log)
    await ensureLandingPage(api, log)

    const built = { ...TEST_DATA, builtAt: new Date().toISOString() }
    fs.mkdirSync(path.dirname(ENV.testDataFile), { recursive: true })
    fs.writeFileSync(ENV.testDataFile, JSON.stringify(built, null, 2))
    log(`SEED ok: ${ENV.testDataFile}`)
    return built
  } finally {
    await api.dispose()
  }
}

// ── Company ────────────────────────────────────────────────────────────────────────────────

/** A fresh ERPNext site has no company until its setup wizard runs. Run it headlessly, once. */
async function ensureSetupComplete(api, log) {
  const companies = await api.getList('Company', { limit: 1 })
  if (companies.length) return
  log('SEED: completing the setup wizard for India (first run on this site)')
  const now = new Date()
  const startYear = now.getMonth() + 1 >= testData.fiscalYearStartMonth ? now.getFullYear() : now.getFullYear() - 1
  const month = String(testData.fiscalYearStartMonth).padStart(2, '0')
  const end = new Date(startYear + 1, testData.fiscalYearStartMonth - 1, 0) // the day before the next start
  // On a brand-new site this takes more than the default 30 s request timeout.
  await api.call(
    'frappe.desk.page.setup_wizard.setup_wizard.setup_complete',
    {
      args: JSON.stringify({
        language: 'English',
        country: testData.country,
        timezone: testData.timezone,
        currency: testData.currency,
        company_name: testData.company,
        company_abbr: testData.companyAbbr,
        chart_of_accounts: 'Standard',
        fy_start_date: `${startYear}-${month}-01`,
        fy_end_date: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
        setup_demo: 0,
      }),
    },
    { timeout: 5 * 60 * 1000 },
  )
}

// ── GST and surcharges ─────────────────────────────────────────────────────────────────────

/**
 * GST, split into CGST + SGST (a sale within the state). ERPNext v16 ships no GST setup (that is
 * the separate India Compliance app), so this builds a simple one:
 *   - two tax accounts under Duties and Taxes,
 *   - one Item Tax Template per slab (CGST and SGST at half the rate each),
 *   - a sales template with both lines at 0%, INCLUDED in the price; each item's slab sets the rate.
 * The sales template is the only default, so every new sale on the screens gets GST.
 */
async function ensureGst(api, log) {
  const gst = testData.gst
  await ensureAccount(api, log, { account: gst.cgstAccount, label: 'Output Tax CGST', parent: `Duties and Taxes - ${ABBR}`, type: 'Tax', rate: 0 })
  await ensureAccount(api, log, { account: gst.sgstAccount, label: 'Output Tax SGST', parent: `Duties and Taxes - ${ABBR}`, type: 'Tax', rate: 0 })

  for (const [rate, name] of Object.entries(gst.slabs)) {
    const half = Number(rate) / 2
    await ensureItemTaxTemplate(api, log, name, `GST ${rate}%`, [
      { tax_type: gst.cgstAccount, tax_rate: half },
      { tax_type: gst.sgstAccount, tax_rate: half },
    ])
  }

  const line = (account, label) => ({ charge_type: 'On Net Total', account_head: account, description: label, rate: 0, included_in_print_rate: 1 })
  await ensureSalesTemplate(api, log, gst.template, 'GST In-State', [line(gst.cgstAccount, 'CGST'), line(gst.sgstAccount, 'SGST')])

  const defaults = await api.getList('Sales Taxes and Charges Template', { filters: [['company', '=', testData.company], ['is_default', '=', 1]], limit: 20 })
  for (const { name } of defaults) {
    if (name === gst.template) continue
    log(`SEED: ${name} is no longer the default sales tax`)
    await api.update('Sales Taxes and Charges Template', name, { is_default: 0 })
  }
  const template = await api.getDoc('Sales Taxes and Charges Template', gst.template)
  if (!template.is_default) {
    log(`SEED: making ${gst.template} the default sales tax`)
    await api.update('Sales Taxes and Charges Template', gst.template, { is_default: 1 })
  }
}

/** Sale surcharge: a fixed amount on the whole sale, booked as income. */
async function ensureSaleSurcharge(api, log) {
  const { label, amount, account, template } = testData.surcharges.sale
  await ensureAccount(api, log, { account, label, parent: `Indirect Income - ${ABBR}`, type: 'Chargeable' })
  await ensureSalesTemplate(api, log, template, label, [
    { charge_type: 'Actual', account_head: account, description: label, tax_amount: amount },
  ])
}

/**
 * Item surcharge: the sale template carries the eco fee line at 0%, and the eco item's own
 * Item Tax Template raises it to `rate` for that item's lines. Other items pay nothing.
 */
async function ensureItemSurcharge(api, log) {
  const { label, rate, account, itemTaxTemplate, template } = testData.surcharges.item
  await ensureAccount(api, log, { account, label, parent: `Duties and Taxes - ${ABBR}`, type: 'Tax', rate: 0 })
  await ensureItemTaxTemplate(api, log, itemTaxTemplate, `${label} ${rate}%`, [{ tax_type: account, tax_rate: rate }])
  await ensureSalesTemplate(api, log, template, 'QA Item Surcharge', [
    { charge_type: 'On Net Total', account_head: account, description: label, rate: 0 },
  ])
}

async function ensureAccount(api, log, { account, label, parent, type, rate }) {
  if (await api.findDoc('Account', account)) return
  log(`SEED: creating account ${account}`)
  await api.insert('Account', {
    account_name: label,
    parent_account: parent,
    company: testData.company,
    account_type: type,
    ...(rate !== undefined ? { tax_rate: rate } : {}),
  })
}

async function ensureItemTaxTemplate(api, log, name, title, taxes) {
  if (await api.findDoc('Item Tax Template', name)) return
  log(`SEED: creating item tax template ${name}`)
  await api.insert('Item Tax Template', { title, company: testData.company, taxes })
}

async function ensureSalesTemplate(api, log, name, title, taxes) {
  if (await api.findDoc('Sales Taxes and Charges Template', name)) return
  log(`SEED: creating sales taxes and charges template ${name}`)
  await api.insert('Sales Taxes and Charges Template', { title, company: testData.company, taxes })
}

// ── Parties ────────────────────────────────────────────────────────────────────────────────

async function ensureCustomer(api, log, { name, group, type, city, state }) {
  if (!(await api.findDoc('Customer', name))) {
    log(`SEED: creating customer ${name}`)
    await api.insert('Customer', { customer_name: name, customer_type: type || 'Company', customer_group: group, territory: testData.territory })
  }
  if (!city) return
  const [address] = await api.getList('Address', { filters: [['address_title', '=', name]], limit: 1 })
  if (address) return
  await api.insert('Address', {
    address_title: name,
    address_type: 'Billing',
    address_line1: 'Demo address (not real)',
    city,
    state,
    country: testData.country,
    links: [{ link_doctype: 'Customer', link_name: name }],
  })
}

async function ensureSupplier(api, log, { name, group }) {
  if (await api.findDoc('Supplier', name)) return
  log(`SEED: creating supplier ${name}`)
  await api.insert('Supplier', { supplier_name: name, supplier_type: 'Company', supplier_group: group })
}

// ── Items, prices, stock ───────────────────────────────────────────────────────────────────

async function ensureItemGroup(api, log, name) {
  if (await api.findDoc('Item Group', name)) return
  log(`SEED: creating item group ${name}`)
  await api.insert('Item Group', { item_group_name: name, parent_item_group: 'All Item Groups', is_group: 0 })
}

/** An item, its tax template (its GST slab, or a given one), and its prices. */
async function ensureItem(api, log, item, { isStock, itemTaxTemplate }) {
  const taxTemplate = itemTaxTemplate || (item.gst !== undefined ? testData.gst.slabs[item.gst] : undefined)
  const taxes = taxTemplate ? [{ item_tax_template: taxTemplate }] : []
  const existing = await api.findDoc('Item', item.code)
  if (!existing) {
    log(`SEED: creating item ${item.code} ${item.name}`)
    await api.insert('Item', {
      item_code: item.code,
      item_name: item.name,
      item_group: item.group,
      stock_uom: item.uom,
      is_stock_item: isStock ? 1 : 0,
      valuation_rate: item.buyingPrice || 0,
      taxes,
    })
  } else {
    const current = (existing.taxes || []).map((itemTax) => itemTax.item_tax_template)
    if (current.join() !== taxes.map((itemTax) => itemTax.item_tax_template).join()) {
      log(`SEED: correcting the tax template of ${item.code} to ${taxTemplate || 'none'}`)
      await api.update('Item', item.code, { taxes })
    }
  }
  await ensureItemPrice(api, log, item.code, testData.sellingPriceList, item.sellingPrice)
  if (item.buyingPrice) await ensureItemPrice(api, log, item.code, testData.buyingPriceList, item.buyingPrice)
}

/** One price per item and price list, set to the value in data.js (corrected if someone changed it). */
async function ensureItemPrice(api, log, itemCode, priceList, rate) {
  const [existing] = await api.getList('Item Price', {
    filters: [['item_code', '=', itemCode], ['price_list', '=', priceList]],
    fields: ['name', 'price_list_rate'],
    limit: 1,
  })
  if (existing && existing.price_list_rate === rate) return
  if (existing) {
    log(`SEED: correcting ${priceList} price of ${itemCode} to ${rate}`)
    await api.update('Item Price', existing.name, { price_list_rate: rate })
    return
  }
  log(`SEED: setting ${priceList} price of ${itemCode} to ${rate}`)
  await api.insert('Item Price', { item_code: itemCode, price_list: priceList, price_list_rate: rate })
}

/** Top a stock item back up to stockQty in the warehouse, at its buying price. */
async function ensureStock(api, log, item) {
  const [bin] = await api.getList('Bin', {
    filters: [['item_code', '=', item.code], ['warehouse', '=', testData.warehouse]],
    fields: ['actual_qty'],
    limit: 1,
  })
  const onHand = bin ? bin.actual_qty : 0
  if (onHand >= item.stockQty) return
  const qty = item.stockQty - onHand
  log(`SEED: receiving ${qty} × ${item.code} into ${testData.warehouse} (had ${onHand})`)
  const entry = await api.insert('Stock Entry', {
    stock_entry_type: 'Material Receipt',
    company: testData.company,
    remarks: 'QA seed: stock top-up',
    items: [{ item_code: item.code, qty, t_warehouse: testData.warehouse, basic_rate: item.buyingPrice }],
  })
  await api.call('frappe.client.submit', { doc: JSON.stringify(entry) })
}

// ── Point of sale ──────────────────────────────────────────────────────────────────────────

/**
 * Every payment mode the POS Profile offers needs a default account for the company, or the
 * profile is refused ("Please set default Cash or Bank account in Mode of Payment").
 * The setup wizard makes Cash (linked to Cash - QAR) and Credit Card; UPI and Debit Card are new.
 */
async function ensurePaymentModes(api, log) {
  await ensureAccount(api, log, { account: testData.bankAccount, label: 'QA Bank', parent: `Bank Accounts - ${ABBR}`, type: 'Bank' })
  for (const { mode, type, account } of testData.paymentModes) {
    const doc = await api.findDoc('Mode of Payment', mode)
    if (!doc) {
      log(`SEED: creating payment mode ${mode}`)
      await api.insert('Mode of Payment', {
        mode_of_payment: mode,
        type,
        enabled: 1,
        accounts: [{ company: testData.company, default_account: account }],
      })
      continue
    }
    const rows = doc.accounts || []
    const mine = rows.find((row) => row.company === testData.company)
    if (mine && mine.default_account === account) continue
    log(`SEED: linking payment mode ${mode} to ${account}`)
    const others = rows.filter((row) => row.company !== testData.company).map(({ company, default_account }) => ({ company, default_account }))
    await api.update('Mode of Payment', mode, { accounts: [...others, { company: testData.company, default_account: account }] })
  }
}

/**
 * The Cashier role: may open, close and read its OWN POS sessions ("Only If Creator").
 * Uses ERPNext's permission manager, which first copies a doctype's standard permissions into
 * custom ones, so adding a role never drops the existing rules.
 */
async function ensureCashierRole(api, log) {
  const { name: role, doctypes, rights, homePage } = testData.cashierRole
  const existing = await api.findDoc('Role', role)
  if (!existing) {
    log(`SEED: creating role ${role}`)
    await api.insert('Role', { role_name: role, desk_access: 1, home_page: homePage })
  } else if (existing.home_page !== homePage) {
    log(`SEED: ${role} signs in to ${homePage}`)
    await api.update('Role', role, { home_page: homePage })
  }
  const permissionManager = 'frappe.core.page.permission_manager.permission_manager'
  for (const doctype of doctypes) {
    let [rule] = await api.getList('Custom DocPerm', {
      filters: [['parent', '=', doctype], ['role', '=', role], ['permlevel', '=', 0]],
      fields: ['name', 'if_owner', ...rights],
      limit: 1,
    })
    if (!rule) {
      log(`SEED: letting ${role} open, close and read its own ${doctype}`)
      await api.call(`${permissionManager}.add`, { parent: doctype, role, permlevel: 0 })
      await api.call(`${permissionManager}.update`, { doctype, role, permlevel: 0, ptype: 'if_owner', value: '1', if_owner: 0 })
      rule = { if_owner: 1 }
    }
    if (!rule.if_owner) await api.call(`${permissionManager}.update`, { doctype, role, permlevel: 0, ptype: 'if_owner', value: '1', if_owner: 0 })
    for (const ptype of rights) {
      if (rule[ptype]) continue
      await api.call(`${permissionManager}.update`, { doctype, role, permlevel: 0, ptype, value: '1', if_owner: 1 })
    }
  }
}

/**
 * One device at a time: "Allow only one session per user" on, so each user keeps at most their
 * Simultaneous Sessions (cashiers 1, set in ensureUser). Administrator keeps several, because the
 * seed, the api fixture and the browser each sign in as Administrator.
 */
async function ensureSessionLimits(api, log) {
  const settings = await api.getDoc('System Settings', 'System Settings')
  if (Boolean(settings.deny_multiple_sessions) !== testData.sessions.denyMultiple) {
    log('SEED: one session per user (System Settings > Allow only one session per user)')
    await api.update('System Settings', 'System Settings', { deny_multiple_sessions: testData.sessions.denyMultiple ? 1 : 0 })
  }
  const admin = await api.getDoc('User', ENV.adminUser)
  if (admin.simultaneous_sessions !== testData.sessions.others) {
    await api.update('User', ENV.adminUser, { simultaneous_sessions: testData.sessions.others })
  }
}

/** A demo user with the ERPNext roles of their demo role; password from DEMO_USER_PASSWORD. */
async function ensureUser(api, log, user) {
  const roles = testData.roles[user.role].map((role) => ({ role }))
  const fields = {
    first_name: user.first,
    last_name: user.last,
    user_type: 'System User',
    enabled: 1,
    roles,
    new_password: ENV.demoUserPassword,
    simultaneous_sessions: user.role === 'Cashier' ? testData.sessions.cashier : testData.sessions.others,
  }
  if (await api.findDoc('User', user.email)) {
    await api.update('User', user.email, fields)
    return
  }
  log(`SEED: creating user ${user.email} (${user.role})`)
  await api.insert('User', { email: user.email, send_welcome_email: 0, ...fields })
}

/**
 * The POS Profiles: "QA POS" and one per billing counter. ERPNext allows ONE open session per
 * profile, so each cashier gets a counter of their own. Managers and admins may use every profile; QA POS is
 * their default, a cashier's counter is the cashier's default.
 */
async function ensurePosProfile(api, log) {
  const qaProfile = testData.posProfile
  const supervisors = testData.users.filter((user) => user.role !== 'Cashier').map((user) => user.email)
  const profiles = [
    { name: qaProfile.name, users: [ENV.adminUser, ...supervisors], defaultFor: [ENV.adminUser, ...supervisors] },
    ...testData.billingCounters.map((counter) => ({ name: counter.name, users: [counter.cashier.email, ...supervisors], defaultFor: [counter.cashier.email] })),
  ]
  for (const { name, users, defaultFor } of profiles) {
    const profile = {
      company: testData.company,
      currency: testData.currency,
      warehouse: testData.warehouse,
      selling_price_list: testData.sellingPriceList,
      customer: qaProfile.customer,
      taxes_and_charges: testData.gst.template,
      // A sale discount on Net Total lowers the GST with the price; on Grand Total it does not
      // (measured: 2 x 118.00 less 10% -> GST 32.40 on Net Total, but 36.00 on Grand Total).
      apply_discount_on: 'Net Total',
      cost_center: testData.costCenter,
      write_off_account: qaProfile.writeOffAccount,
      write_off_cost_center: testData.costCenter,
      write_off_limit: qaProfile.writeOffLimit,
      update_stock: 1,
      allow_rate_change: 1,
      allow_discount_change: 1,
      payments: testData.paymentModes.map((paymentMode) => ({ mode_of_payment: paymentMode.mode, default: paymentMode.default ? 1 : 0 })),
      applicable_for_users: users.map((user) => ({ user, default: defaultFor.includes(user) ? 1 : 0 })),
    }
    if (await api.findDoc('POS Profile', name)) {
      await api.update('POS Profile', name, profile)
      continue
    }
    log(`SEED: creating POS Profile ${name}`)
    // POS Profile is named by the user ("Prompt"), so the name is passed in.
    await api.insert('POS Profile', { ...profile, name, __newname: name })
  }
}

// ── The QA Testing page ────────────────────────────────────────────────────────────────────

/**
 * The QA Testing page: one place in ERPNext to see the test data and open every record.
 * Rebuilt from data.js on every run so the page never goes stale:
 *   - a Module Def "QA Testing" (ERPNext v16 builds one sidebar per module),
 *   - a Workspace in that module (the page itself, at /desk/qa-testing),
 *   - a Custom Sidebar for that module (its left menu, as a site customization).
 *
 * In v16.50 the older Workspace Sidebar records are a read-only archive, and a module's own
 * Sidebar can only be edited in developer mode, so the menu is added as a site customization.
 */
async function ensureQaPage(api, log) {
  const name = testData.qaPage
  const { stock, service, eco } = testData.items
  const { sale, item } = testData.surcharges
  const money = (amount) => `${testData.currencySymbol}${amount.toFixed(2)}`

  const shortcuts = [
    ['Point of Sale', 'Page', 'point-of-sale'],
    ['Item', 'DocType'], ['Item Price', 'DocType'], ['Customer', 'DocType'], ['Supplier', 'DocType'],
    ['Sales Invoice', 'DocType'], ['Stock Balance', 'Report'], ['User', 'DocType'],
  ].map(([label, type, linkTo]) => ({ label, type, link_to: linkTo || label, doc_view: type === 'DocType' ? 'List' : '' }))

  const para = (html) => ({ type: 'paragraph', data: { text: html, col: 12 } })
  const users = testData.users.map((user) => `${user.first} ${user.last} (${user.role}, ${user.email})`).join(' · ')
  const content = [
    { type: 'header', data: { text: `<span class="h4"><b>${name}</b></span>`, col: 12 } },
    para('Test and demo data prepared by the seed before every test run. Every value: <code>docs/test-data.md</code> in the repository.'),
    para(`<b>Company</b> ${testData.company} (${testData.country}, ${testData.currency}) · <b>Warehouse</b> ${testData.warehouse} · <b>POS</b> ${testData.posProfile.name}, pays ${testData.paymentModes.map((paymentMode) => paymentMode.mode).join(', ')}`),
    para(`<b>GST</b> ${testData.gst.template}: CGST + SGST, included in prices, slabs ${Object.keys(testData.gst.slabs).join('%, ')}% · <b>Sale surcharge</b> ${sale.label} ${money(sale.amount)} · <b>Item surcharge</b> ${item.rate}% ${item.label} on ${eco.code}`),
    para(`<b>Test items</b> ${stock.code} ${money(stock.sellingPrice)} (GST ${stock.gst}%, ${stock.stockQty} in stock) · ${service.code} ${money(service.sellingPrice)} (GST ${service.gst}%) · ${eco.code} ${money(eco.sellingPrice)}`),
    para(`<b>Demo items</b> ${testData.demo.items.length} grocery, personal care, home care, electronics and apparel items · <b>Demo customers</b> ${testData.demo.customers.map((customer) => customer.name).join(', ')}`),
    para(`<b>Users</b> ${users}. Password: DEMO_USER_PASSWORD in your <code>.env</code>.`),
    { type: 'header', data: { text: '<span class="h5"><b>Open</b></span>', col: 12 } },
    ...shortcuts.map((shortcut) => ({ type: 'shortcut', data: { shortcut_name: shortcut.label, col: 3 } })),
  ].map((block, index) => ({ id: `qa${index}`, ...block }))

  if (!(await api.findDoc('Module Def', name))) {
    log(`SEED: creating module ${name}`)
    await api.insert('Module Def', { module_name: name, app_name: 'erpnext', custom: 1 })
  }

  const workspace = { label: name, title: name, module: name, public: 1, type: 'Workspace', content: JSON.stringify(content), shortcuts }
  if (await api.findDoc('Workspace', name)) await api.update('Workspace', name, workspace)
  else {
    log(`SEED: creating the ${name} page`)
    await api.insert('Workspace', workspace)
  }

  // The module's own sidebar already has Home (its workspace); these rows are added under it.
  const link = (label, linkType = 'DocType', linkTo = label) => ({ type: 'Link', label, link_type: linkType, link_to: linkTo, child: 1, added: 1 })
  const section = (label, icon) => ({ type: 'Section Break', label, icon, indent: 1, added: 1 })
  const sidebarItems = [
    section('Selling', 'store'),
    link('Point of Sale', 'Page', 'point-of-sale'), link('Sales Invoice'), link('POS Profile'),
    section('Test data', 'database'),
    link('Item'), link('Item Price'), link('Customer'), link('Supplier'),
    section('Taxes and charges', 'percent'),
    link('Sales Taxes and Charges Template'), link('Item Tax Template'),
    section('Stock', 'package'),
    link('Stock Entry'), link('Stock Balance', 'Report'),
    section('Accounts and people', 'users'),
    link('General Ledger', 'Report'), link('User'),
  ]
  const [custom] = await api.getList('Custom Sidebar', { filters: [['module', '=', name], ['user', 'is', 'not set']], limit: 1 })
  const sidebar = { module: name, label: name, header_icon: 'clipboard-check', sidebar_items: sidebarItems }
  if (custom) await api.update('Custom Sidebar', custom.name, sidebar)
  else await api.insert('Custom Sidebar', { ...sidebar, user: '' })
}

/**
 * Fix where Administrator lands after sign-in, so every run starts from the same screen.
 *
 * In ERPNext v16 a system user who signs in goes to their Default Workspace if they have one,
 * otherwise to the app launcher (/desk). The "Default App" setting (User or System Settings)
 * does NOT change this for system users: the sign-in code only uses it for portal users
 * (frappe/auth.py, set_user_info). So the setting that works is User → Default Workspace.
 *
 * ⚠ This changes the site and leaves it changed: Administrator now lands on the QA Testing page.
 */
async function ensureLandingPage(api, log) {
  const user = await api.getDoc('User', ENV.adminUser)
  if (user.default_workspace === testData.landingWorkspace) return
  log(`SEED: setting ${ENV.adminUser}'s Default Workspace to ${testData.landingWorkspace}`)
  await api.update('User', ENV.adminUser, { default_workspace: testData.landingWorkspace })
}

module.exports = { seed, TEST_DATA }
