// Test case: docs/test-cases/sign-in.md (TC-SIGNIN-001)
const { test, expect, meta } = require('../../src/fixtures')

test('TC-SIGNIN-001 a wrong password is refused and starts no session', { tag: ['@smoke'] }, async ({
  loginPage,
  session,
  context,
  env,
}) => {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'Access' })
  await loginPage.open()

  const response = await loginPage.signIn(env.adminUser, `not-the-password-${Date.now()}`)

  // The server refused it...
  expect(response.status()).toBe(401)
  // ...the screen says so and stays on the sign-in screen...
  await expect(loginPage.alert).toHaveText('Invalid credentials, try again.')
  await expect(loginPage.page).toHaveURL(/\/login$/)
  // ...and this browser holds no signed-in session: the server set it to Guest,
  // and refuses a request that needs a signed-in user.
  const cookies = Object.fromEntries((await context.cookies()).map((c) => [c.name, c.value]))
  expect(cookies.user_id).toBe('Guest')
  expect(await session.sessionUser()).toBeNull()
})
