/**
 * Any page of the ERPNext desk (/desk/...), as far as the sign-in tests need it: open a page by
 * its path, and read what it shows.
 */
class DeskPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page
    // The QA Testing page (Administrator's landing page) introduces itself with this text (seed).
    this.qaTestingIntro = page.getByText('Test and demo data prepared by the seed')
    this.serverError = page.getByText('Server Error')
    // Shown by Retail POS India's cashier guard when it sends a cashier back to the POS.
    this.cashierMessage = page.getByText('Cashiers use the Point of Sale.')
  }

  /** Open a desk page by its path, e.g. "/desk/item". */
  async open(path) {
    await this.page.goto(path)
  }

  /** Wait until the desk shows a page titled `title` (the browser tab's title), e.g. "Item". */
  async shows(title) {
    await this.page.waitForFunction((t) => document.title.startsWith(t), title)
  }
}

module.exports = { DeskPage }
