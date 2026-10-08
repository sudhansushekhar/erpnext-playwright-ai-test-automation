/**
 * The Point of Sale screen (ERPNext v16 + Retail POS India), as a cashier uses it.
 *
 * Locators: by role and name where the screen has them (search box, dialogs, buttons with text,
 * our card/UPI fields). ERPNext's item cards, cart totals, payment tiles and number pad keys are
 * plain elements with no accessible name, so those use CSS, each marked "CSS:" with the reason.
 *
 * In the report: every user action is a named step (src/report.js), every element has a readable
 * name (.describe), and the values a test relies on (totals, the invoice's name) are noted.
 */
const { LoginPage } = require('./LoginPage')
const { step, note } = require('../report')

// Payment tiles are keyed by ERPNext's "sanitized" mode name.
const MODE_KEY = { Cash: 'cash', UPI: 'upi', 'Debit Card': 'debit_card', 'Credit Card': 'credit_card' }

class PosPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page
    this.search = page.getByRole('textbox', { name: 'Search by item code, serial number or barcode' }).describe('Item search')
    // CSS: the cart's totals box has no accessible name.
    this.cartTotals = page.locator('.cart-totals-section').describe('Cart totals')
    // The cart has two "Checkout" keys: its own button and one on the (hidden) quantity number pad.
    this.checkoutButton = page.getByText('Checkout', { exact: true }).filter({ visible: true }).describe('Checkout button')
    this.completeOrderButton = page.getByText('Complete Order', { exact: true }).describe('Complete Order button')
    // CSS: the number pad keys have no accessible name.
    this.numpadKeys = page.locator('.payment-container .numpad-btn').describe('Number pad')
    this.paymentFields = page.locator('.rpi-fields').describe('Card / UPI fields')
    this.openingDialog = page.getByRole('dialog').filter({ hasText: 'Create POS Opening Entry' }).describe('Opening dialog')
    // An error shown by ERPNext (msgprint) after an action.
    this.errorDialog = page.getByRole('dialog').filter({ has: page.locator('.msgprint') }).describe('Error message')
  }

  /**
   * Sign `email` in through the API (the browser shares its cookies) and open the Point of Sale.
   * Tests about signing in use the sign-in screen; the POS tests start already signed in.
   */
  async open(email, password) {
    await step(`Open the Point of Sale as ${email}`, async () => {
      await new LoginPage(this.page).signInThroughApi(email, password)
      await this.page.goto('/desk/point-of-sale')
    })
  }

  /**
   * Wait until a new sale has started for `customer` (the POS Profile's default customer). The search box
   * shows first, but ERPNext sets the sale up in steps (the invoice, the POS Profile's price list, then the
   * cart with its customer); searching before the last step breaks the page (a TypeError in
   * ERPNext's item search, seen under load with parallel workers). The customer in the cart is drawn last.
   */
  async ready(customer) {
    await step(`Wait until a new sale has started for ${customer}`, async () => {
      await this.search.waitFor()
      await this.page.getByText(customer, { exact: true }).filter({ visible: true }).first().describe(`Customer "${customer}" in the cart`).waitFor()
    })
  }

  /** Add one unit of an item to the cart: search its code, tap its card. */
  async addItem(item) {
    await step(`Add 1 × ${item.name} (${item.code}) to the cart`, async () => {
      await this.search.fill(item.code)
      // CSS-free: the card shows the item name as text.
      await this.page.getByText(item.name, { exact: true }).first().describe(`Item card "${item.name}"`).click()
      await this.cartTotals.getByText(item.name).or(this.page.locator('.cart-item-wrapper').getByText(item.name)).first()
        .describe(`"${item.name}" in the cart`).waitFor()
    })
  }

  /**
   * One of the cart's totals, by its label as shown: "Net Total", "CGST", "SGST", "Grand Total".
   * Check it as an element, e.g. expect(pos.cartTotal('Grand Total')).toHaveText('₹ 118.00'): the
   * check waits for the screen, and a failure names and highlights this element in the trace.
   */
  cartTotal(label) {
    // XPath: the cart shows each total as a label followed by its value, with no accessible name
    // tying them together; the value is the label's next element.
    return this.cartTotals.getByText(label, { exact: true }).locator('xpath=following-sibling::*[1]').describe(`Cart ${label}`)
  }

  /** Go to payment; waits until ERPNext has selected the default payment mode (Cash). */
  async checkout() {
    await step('Checkout', async () => {
      await this.checkoutButton.click()
      await this.numpadKeys.first().waitFor()
      // CSS: ERPNext marks the selected tile with a class only.
      await this.page.locator('.mode-of-payment.border-primary').describe('Selected payment mode').waitFor()
    })
  }

  /** CSS: a payment tile has no accessible name; data-mode is ERPNext's own key for it. */
  tile(mode) {
    return this.page.locator(`.mode-of-payment[data-mode=${MODE_KEY[mode]}]`).describe(`${mode} tile`)
  }

  /** The amount shown on a payment tile, e.g. "₹ 118.00". */
  amount(mode) {
    return this.tile(mode).locator(`.${MODE_KEY[mode]}-amount`).describe(`${mode} amount`)
  }

  /** Tap a payment mode's tile (starts a new amount for it). */
  async tapMode(mode) {
    await step(`Tap ${mode}`, async () => {
      await this.tile(mode).click()
    })
  }

  /** Type on the payment number pad, e.g. "118", "12.5"; "D" is the Delete key. */
  async typeAmount(keys) {
    const shown = [...keys].map((k) => (k === 'D' ? 'Delete' : k)).join(' ')
    await step(`Type ${shown} on the number pad`, async () => {
      for (const k of keys) {
        const value = k === 'D' ? 'delete' : k
        await this.numpadKeys.and(this.page.locator(`[data-button-value="${value}"]`)).describe(`Key ${k === 'D' ? 'Delete' : k}`).click()
      }
    })
  }

  /** Make `mode` the selected payment mode: tap its tile unless it is selected already. */
  async selectMode(mode) {
    await step(`Select ${mode}`, async () => {
      // CSS: ERPNext marks the selected tile with a class only.
      if (await this.tile(mode).evaluate((el) => el.classList.contains('border-primary'))) {
        await note(`${mode} was already selected`)
      } else {
        await this.tapMode(mode)
      }
    })
  }

  /** Pay the whole amount with one mode: Cash is set to 0 first when paying another way. */
  async payWith(mode, keys) {
    await step(`Pay ₹${keys} by ${mode}`, async () => {
      if (mode !== 'Cash') {
        await this.selectMode('Cash')
        await this.typeAmount('0')
      }
      await this.selectMode(mode)
      await this.typeAmount(keys)
    })
  }

  /** A card or UPI detail field, by its label (Retail POS India gives each one an accessible name). */
  field(label) {
    return this.paymentFields.getByRole(label === 'Card Type' ? 'combobox' : 'textbox', { name: label }).describe(`${label} field`)
  }

  /** The card's details (the values are masked in the report). */
  async setCardDetails({ type, last4, approval }) {
    await step('Enter the card details', async () => {
      if (type) await this.field('Card Type').selectOption(type)
      if (last4) await this.field('Card Last 4 Digits').fill(last4)
      if (approval) await this.field('Card Approval Code').fill(approval)
      await this.page.keyboard.press('Tab')
    })
  }

  async setUpiReference(utr) {
    await step('Enter the UPI transaction ID', async () => {
      await this.field('UPI Transaction ID').fill(utr)
      await this.page.keyboard.press('Tab')
    })
  }

  /**
   * Complete Order, and Yes to "Permanently Submit?". Returns the sale's name as the screen's own
   * request (savedocs, action Submit) sent it, and whether the server accepted it.
   */
  async completeOrder() {
    return step('Complete the order', async () => {
      const submit = this.page.waitForResponse(
        (r) => r.url().includes('/api/method/frappe.desk.form.save.savedocs') && (r.request().postData() || '').includes('action=Submit'),
      )
      await this.completeOrderButton.click()
      await this.page.getByRole('button', { name: 'Yes' }).describe('Yes (Permanently Submit?)').click()
      const res = await submit
      const doc = JSON.parse(new URLSearchParams(res.request().postData()).get('doc'))
      await note(res.ok()
        ? `Sales Invoice ${doc.name} submitted`
        : `Sales Invoice ${doc.name} refused by the server (HTTP ${res.status()})`)
      return { name: doc.name, accepted: res.ok() }
    })
  }

  // ── Opening a shift (the dialog shown when the cashier has no open shift) ──────────────

  /** CSS: the dialog's POS Profile box has no accessible name (its label is not linked to it). */
  get openingProfile() {
    return this.openingDialog.locator('[data-fieldname="pos_profile"] input').describe('POS Profile box')
  }

  /** Choose the billing counter (its POS Profile). ERPNext fills it in already when the cashier has only one. */
  async chooseCounter(name) {
    await step(`Choose ${name} in the opening dialog`, async () => {
      await this.openingProfile.waitFor()
      if ((await this.openingProfile.inputValue()) !== name) {
        await this.openingProfile.fill(name)
        await this.page.getByRole('option', { name }).first().describe(`Option "${name}"`).click()
      } else {
        await note(`${name} was already filled in`)
      }
      // The payment rows load from the counter's POS Profile.
      await this.openingDialog.getByText('Mode of Payment').describe('Opening balance table').waitFor()
    })
  }

  /** Row checkboxes shown in the opening dialog's table. */
  get openingRowCheckboxes() {
    return this.openingDialog.getByRole('checkbox').filter({ visible: true }).describe('Row checkboxes')
  }

  /** The table's "Delete" / "Duplicate" row buttons, when shown. */
  get openingRowActions() {
    return this.openingDialog.getByRole('button', { name: /^(Delete|Duplicate)/ }).filter({ visible: true }).describe('Delete / Duplicate row buttons')
  }

  /** The Opening Balance Details rows, e.g. ["Cash ₹ 0.00"]. Read often by expect.poll: no step. */
  async openingRows() {
    // CSS: grid rows have no accessible role in ERPNext's dialog table.
    const rows = this.openingDialog.locator('.grid-body .grid-row').describe('Opening balance rows')
    return (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
  }
}

module.exports = { PosPage, MODE_KEY }
