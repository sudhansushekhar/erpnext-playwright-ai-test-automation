/**
 * The sign-in screen (/login). Locators come from the page's accessibility tree
 * (ERPNext v16): textboxes "Email" and "Password", button "Continue", and an
 * alert in the form after a refused sign-in.
 */
class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page
    this.email = page.getByRole('textbox', { name: 'Email' })
    this.password = page.getByRole('textbox', { name: 'Password' })
    this.continueButton = page.getByRole('button', { name: 'Continue' })
    this.alert = page.getByRole('form').getByRole('alert')
  }

  async open() {
    await this.page.goto('/login')
    await this.email.waitFor()
  }

  /**
   * Fill the form and press Continue. Returns the server's answer to the sign-in
   * request, so a test can check what the server decided, not only what the screen shows.
   */
  async signIn(user, password) {
    await this.email.fill(user)
    await this.password.fill(password)
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().endsWith('/api/method/login') && r.request().method() === 'POST'),
      this.continueButton.click(),
    ])
    return response
  }
}

module.exports = { LoginPage }
