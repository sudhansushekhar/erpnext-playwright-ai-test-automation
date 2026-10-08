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

  /** An item's line in the cart (the sale's, or a return's). CSS: cart lines have no accessible role. */
  cartLine(item) {
    return this.page.locator('.cart-item-wrapper').filter({ has: this.page.getByText(item.name, { exact: true }) }).describe(`Cart line "${item.name}"`)
  }

  /**
   * The line's total as shown, e.g. "₹ 236.00" for 2 × ₹118. Check it as an element.
   * CSS: ERPNext names the line total "item-rate" (and the unit rate "item-amount").
   */
  cartLineTotal(item) {
    return this.cartLine(item).locator('.item-rate').describe(`Line total of "${item.name}"`)
  }

  /** CSS: the line's details panel (quantity, rate, discount) has fields with no accessible name. */
  get lineDetails() {
    return this.page.locator('.item-details-container').describe('Line details')
  }

  /** Change an item's quantity in the cart, through its line's details (−1 on a return returns one). */
  async setQty(item, qty) {
    await step(`Set the quantity of ${item.name} to ${qty}`, async () => {
      await this.cartLine(item).click()
      const box = this.lineDetails.locator('[data-fieldname="qty"] input').describe('Quantity box')
      await box.fill(String(qty))
      await box.press('Tab')
      // CSS: the line's quantity ("2 Nos", "-1 Nos") has no accessible name.
      await this.cartLine(item).locator('.item-qty').filter({ hasText: new RegExp(`^\\s*${String(qty).replace('-', '\\-')}\\s`) })
        .describe(`Quantity ${qty} on the line`).waitFor()
      await this.lineDetails.locator('.close-btn').describe('Close (line details)').click()
    })
  }

  /** Take an item off the cart (e.g. an item not returned): its line, then Remove. */
  async removeLine(item) {
    await step(`Remove ${item.name} from the cart`, async () => {
      await this.cartLine(item).click()
      // Quantity 0 does not remove a line (ERPNext even errors for a service item); Remove does.
      await this.page.getByText('Remove', { exact: true }).filter({ visible: true }).describe('Remove key').click()
      await this.cartLine(item).waitFor({ state: 'detached' })
    })
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
    const shown = [...keys].map((key) => (key === 'D' ? 'Delete' : key)).join(' ')
    await step(`Type ${shown} on the number pad`, async () => {
      for (const key of keys) {
        const value = key === 'D' ? 'delete' : key
        await this.numpadKeys.and(this.page.locator(`[data-button-value="${value}"]`)).describe(`Key ${key === 'D' ? 'Delete' : key}`).click()
      }
    })
  }

  /** Make `mode` the selected payment mode: tap its tile unless it is selected already. */
  async selectMode(mode) {
    await step(`Select ${mode}`, async () => {
      // CSS: ERPNext marks the selected tile with a class only.
      if (await this.tile(mode).evaluate((element) => element.classList.contains('border-primary'))) {
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
        (response) => response.url().includes('/api/method/frappe.desk.form.save.savedocs') && (response.request().postData() || '').includes('action=Submit'),
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

  // ── After a sale, and returns ──────────────────────────────────────────────────────────

  /**
   * The next customer: "New Order" on the summary shown after a sale. (The top bar's "New Invoice"
   * does nothing in that state, and Recent Orders would hide the past order's summary.)
   */
  async newOrder() {
    await step('New order (the next customer)', async () => {
      await this.page.getByText('New Order', { exact: true }).filter({ visible: true }).describe('New Order button').click()
      await this.search.waitFor()
    })
  }

  /** Open a past sale from Recent Orders: status Paid, search its name, open it. */
  async openPastOrder(name) {
    await step(`Open past order ${name} (Recent Orders)`, async () => {
      await this.page.getByRole('button', { name: 'Recent Orders' }).describe('Recent Orders button').click()
      await this.page.getByRole('combobox').filter({ has: this.page.getByRole('option', { name: 'Paid' }) })
        .describe('Order status').selectOption('Paid')
      // Every refresh of the list resets the opened order's summary, so wait for the list's answer
      // to this search before opening the order (clicking during an earlier refresh was undone).
      const searched = this.page.waitForResponse((response) => response.url().includes('get_past_order_list') &&
        decodeURIComponent((response.request().postData() || '') + response.url()).includes(name))
      await this.page.getByRole('textbox', { name: 'Search by invoice id or customer name' }).describe('Order search').fill(name)
      await searched
      // CSS: an order row has no accessible name; data-invoice-name is ERPNext's own key for it.
      // (Its text also appears in the "created" toast, so text would match the toast too.)
      await this.page.locator(`.invoice-wrapper[data-invoice-name="${name}"]`).describe(`Order ${name}`).click()
      await this.returnButton.waitFor()
    })
  }

  /** CSS: the order summary's Return has no accessible role; .return-btn is ERPNext's own class. */
  get returnButton() {
    return this.page.locator('.return-btn').filter({ visible: true }).describe('Return button')
  }

  /** Return the open past order: the cart fills with its lines, as negative quantities. */
  async startReturn() {
    await step('Start a return of the order', async () => {
      await this.returnButton.click()
      await this.checkoutButton.waitFor()
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
    return (await rows.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim())
  }
}

module.exports = { PosPage, MODE_KEY }
