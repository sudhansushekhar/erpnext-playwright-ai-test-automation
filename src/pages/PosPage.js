/**
 * The Point of Sale screen (ERPNext v16 + Retail POS India), as a cashier uses it.
 *
 * Locators: by role and name where the screen has them (search box, dialogs, buttons with text,
 * our card/UPI fields). ERPNext's item cards, cart totals, payment tiles and number pad keys are
 * plain elements with no accessible name, so those use CSS, each marked "CSS:" with the reason.
 */
const { LoginPage } = require('./LoginPage')

// Payment tiles are keyed by ERPNext's "sanitized" mode name.
const MODE_KEY = { Cash: 'cash', UPI: 'upi', 'Debit Card': 'debit_card', 'Credit Card': 'credit_card' }

class PosPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page
    this.search = page.getByRole('textbox', { name: 'Search by item code, serial number or barcode' })
    // CSS: the cart's totals box has no accessible name.
    this.cartTotals = page.locator('.cart-totals-section')
    // The cart has two "Checkout" keys: its own button and one on the (hidden) quantity number pad.
    this.checkoutButton = page.getByText('Checkout', { exact: true }).filter({ visible: true })
    this.completeOrderButton = page.getByText('Complete Order', { exact: true })
    // CSS: the number pad keys have no accessible name.
    this.numpadKeys = page.locator('.payment-container .numpad-btn')
    this.paymentFields = page.locator('.rpi-fields')
    this.openingDialog = page.getByRole('dialog').filter({ hasText: 'Create POS Opening Entry' })
    // An error shown by ERPNext (msgprint) after an action.
    this.errorDialog = page.getByRole('dialog').filter({ has: page.locator('.msgprint') })
  }

  /**
   * Sign `email` in through the API (the browser shares its cookies) and open the Point of Sale.
   * Tests about signing in use the sign-in screen; the POS tests start already signed in.
   */
  async open(email, password) {
    const res = await this.page.request.post('/api/method/login', { form: { usr: email, pwd: password } })
    if (!res.ok()) throw new Error(`Sign-in as ${email} failed: HTTP ${res.status()}`)
    await this.page.goto('/desk/point-of-sale')
  }

  /** Sign in; a cashier lands on the Point of Sale. Waits for the till screen or the opening dialog. */
  async signIn(email, password) {
    const login = new LoginPage(this.page)
    await login.open()
    await login.signIn(email, password)
    await this.page.waitForURL(/point-of-sale/)
  }

  /** Wait until the item list is ready (the cashier's till is open). */
  async ready() {
    await this.search.waitFor()
  }

  /** Add one unit of an item to the cart: search its code, tap its card. */
  async addItem(item) {
    await this.search.fill(item.code)
    // CSS-free: the card shows the item name as text.
    await this.page.getByText(item.name, { exact: true }).first().click()
    await this.cartTotals.getByText(item.name).or(this.page.locator('.cart-item-wrapper').getByText(item.name)).first().waitFor()
  }

  /** The cart's totals as shown, e.g. { 'Net Total': '₹ 100.00', CGST: '₹ 9.00', ... }. */
  async totals() {
    // The box shows each label on one line and its value on the next.
    const lines = (await this.cartTotals.innerText()).split('\n').map((l) => l.trim()).filter(Boolean)
    const totals = {}
    for (let i = 0; i < lines.length - 1; i++) if (lines[i + 1].startsWith('₹')) totals[lines[i]] = lines[i + 1]
    return totals
  }

  /** Go to payment; waits until ERPNext has selected the default payment mode (Cash). */
  async checkout() {
    await this.checkoutButton.click()
    await this.numpadKeys.first().waitFor()
    // CSS: ERPNext marks the selected tile with a class only.
    await this.page.locator('.mode-of-payment.border-primary').waitFor()
  }

  /** CSS: a payment tile has no accessible name; data-mode is ERPNext's own key for it. */
  tile(mode) {
    return this.page.locator(`.mode-of-payment[data-mode=${MODE_KEY[mode]}]`)
  }

  /** The amount shown on a payment tile, e.g. "₹ 118.00". */
  amount(mode) {
    return this.tile(mode).locator(`.${MODE_KEY[mode]}-amount`)
  }

  /** Tap a payment mode's tile (starts a new amount for it). */
  async tapMode(mode) {
    await this.tile(mode).click()
  }

  /** Type on the payment number pad, e.g. "118", "12.5"; "D" is the Delete key. */
  async typeAmount(keys) {
    for (const k of keys) {
      const value = k === 'D' ? 'delete' : k
      await this.numpadKeys.and(this.page.locator(`[data-button-value="${value}"]`)).click()
    }
  }

  /** Make `mode` the selected payment mode: tap its tile unless it is selected already. */
  async selectMode(mode) {
    // CSS: ERPNext marks the selected tile with a class only.
    if (!(await this.tile(mode).evaluate((el) => el.classList.contains('border-primary')))) await this.tapMode(mode)
  }

  /** Pay the whole amount with one mode: Cash is set to 0 first when paying another way. */
  async payWith(mode, keys) {
    if (mode !== 'Cash') {
      await this.selectMode('Cash')
      await this.typeAmount('0')
    }
    await this.selectMode(mode)
    await this.typeAmount(keys)
  }

  /** A card or UPI detail field, by its label (Retail POS India gives each one an accessible name). */
  field(label) {
    return this.paymentFields.getByRole(label === 'Card Type' ? 'combobox' : 'textbox', { name: label })
  }

  async setCardDetails({ type, last4, approval }) {
    if (type) await this.field('Card Type').selectOption(type)
    if (last4) await this.field('Card Last 4 Digits').fill(last4)
    if (approval) await this.field('Card Approval Code').fill(approval)
    await this.page.keyboard.press('Tab')
  }

  async setUpiReference(utr) {
    await this.field('UPI Transaction ID').fill(utr)
    await this.page.keyboard.press('Tab')
  }

  /**
   * Complete Order, and Yes to "Permanently Submit?". Returns the sale's name as the screen's own
   * request (savedocs, action Submit) sent it, and whether the server accepted it.
   */
  async completeOrder() {
    const submit = this.page.waitForResponse(
      (r) => r.url().includes('/api/method/frappe.desk.form.save.savedocs') && (r.request().postData() || '').includes('action=Submit'),
    )
    await this.completeOrderButton.click()
    await this.page.getByRole('button', { name: 'Yes' }).click()
    const res = await submit
    const doc = JSON.parse(new URLSearchParams(res.request().postData()).get('doc'))
    return { name: doc.name, accepted: res.ok() }
  }

  // ── Opening the till (the dialog shown when the cashier's till is not open) ──────────────

  /** CSS: the dialog's POS Profile box has no accessible name (its label is not linked to it). */
  get openingProfile() {
    return this.openingDialog.locator('[data-fieldname="pos_profile"] input')
  }

  /** Choose the till (POS Profile). ERPNext fills it in already when the cashier has only one. */
  async chooseTill(name) {
    await this.openingProfile.waitFor()
    if ((await this.openingProfile.inputValue()) !== name) {
      await this.openingProfile.fill(name)
      await this.page.getByRole('option', { name }).first().click()
    }
    // The payment rows load from the till's profile.
    await this.openingDialog.getByText('Mode of Payment').waitFor()
  }

  /** Row checkboxes shown in the opening dialog's table. */
  get openingRowCheckboxes() {
    return this.openingDialog.getByRole('checkbox').filter({ visible: true })
  }

  /** The table's "Delete" / "Duplicate" row buttons, when shown. */
  get openingRowActions() {
    return this.openingDialog.getByRole('button', { name: /^(Delete|Duplicate)/ }).filter({ visible: true })
  }

  /** The Opening Balance Details rows, e.g. ["Cash ₹ 0.00"]. */
  async openingRows() {
    // CSS: grid rows have no accessible role in ERPNext's dialog table.
    const rows = this.openingDialog.locator('.grid-body .grid-row')
    return (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
  }
}

module.exports = { PosPage, MODE_KEY }
