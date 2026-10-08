/**
 * The sign-in screen (/login). Locators come from the page's accessibility tree
 * (ERPNext v16): textboxes "Email" and "Password", button "Continue", and an
 * alert in the form after a refused sign-in.
 *
 * In the report: each action is a named step (src/report.js) and each element has a readable name.
 */
const { step, note } = require('../report')

class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page
    this.email = page.getByRole('textbox', { name: 'Email' }).describe('Email field')
    this.password = page.getByRole('textbox', { name: 'Password' }).describe('Password field')
    this.continueButton = page.getByRole('button', { name: 'Continue' }).describe('Continue button')
    this.alert = page.getByRole('form').getByRole('alert').describe('Sign-in message')
  }

  async open() {
    await step('Open the sign-in screen', async () => {
      await this.page.goto('/login')
      await this.email.waitFor()
    })
  }

  /**
   * Sign in without the screen, through the API on the browser's own session (page.request shares
   * its cookies). For tests that are not about the sign-in screen.
   */
  async signInThroughApi(user, password) {
    await step(`Sign in as ${user} (through the API)`, async () => {
      const res = await this.page.request.post('/api/method/login', { form: { usr: user, pwd: password } })
      if (!res.ok()) throw new Error(`Sign-in as ${user} failed: HTTP ${res.status()}`)
    })
  }

  /**
   * Fill the form and press Continue. Returns the server's answer to the sign-in
   * request, so a test can check what the server decided, not only what the screen shows.
   */
  async signIn(user, password) {
    return step(`Sign in as ${user} on the sign-in screen`, async () => {
      await this.email.fill(user)
      await this.password.fill(password)
      const [response] = await Promise.all([
        this.page.waitForResponse((r) => r.url().endsWith('/api/method/login') && r.request().method() === 'POST'),
        this.continueButton.click(),
      ])
      await note(`The server answered the sign-in with HTTP ${response.status()}`)
      return response
    })
  }
}

module.exports = { LoginPage }
