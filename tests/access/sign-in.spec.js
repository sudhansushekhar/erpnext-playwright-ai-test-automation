// Test case: docs/test-cases/sign-in.md (TC-SIGNIN-001 to TC-SIGNIN-005)
const { test, expect, meta } = require('../../src/fixtures')

test('TC-SIGNIN-001 a wrong password is refused and starts no session', { tag: ['@smoke'] }, async ({
  loginPage,
  session,
  context,
  users,
}) => {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'Access' })
  await loginPage.open()

  const response = await loginPage.signIn(users.admin.email, `not-the-password-${Date.now()}`)

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

test('TC-SIGNIN-002 Administrator signs in and lands on the QA Testing page', { tag: ['@smoke'] }, async ({
  loginPage,
  deskPage,
  session,
  users,
  testData,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'Access' })
  await loginPage.open()

  const response = await loginPage.signIn(users.admin.email, users.admin.password)

  expect(response.status()).toBe(200)
  await expect(deskPage.page).toHaveURL(new RegExp(`${deskPage.pathOf(testData.landingWorkspace)}$`))
  await expect(deskPage.qaTestingIntro).toBeVisible()
  await expect(deskPage.serverError).toBeHidden()
  expect(await session.sessionUser()).toBe(users.admin.email)
})

test('TC-SIGNIN-003 a cashier signs in straight to the Point of Sale, ready to open the till', { tag: ['@smoke'] }, async ({
  loginPage,
  posPage,
  session,
  tills,
  users,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'Access', story: 'REQ-POS-017' })
  const { cashier } = users
  await tills.closeAllOf(cashier.email) // her till must not be open
  await loginPage.open()

  const response = await loginPage.signIn(cashier.email, cashier.password)

  expect(response.status()).toBe(200)
  await expect(posPage.page).toHaveURL(/\/desk\/selling\/point-of-sale$/)
  await expect(posPage.openingDialog).toBeVisible()
  expect(await session.sessionUser()).toBe(cashier.email)
})

test('TC-SIGNIN-004 a cashier stays on the Point of Sale: other desk pages send them back', { tag: ['@nightly'] }, async ({
  loginPage,
  deskPage,
  secondDevice,
  users,
}) => {
  meta({ priority: 'P2', severity: 'major', owner: 'sudhansushekhar', feature: 'Access', story: 'REQ-POS-018' })
  const { cashier, manager } = users
  await loginPage.signInThroughApi(cashier.email, cashier.password)

  for (const path of ['/desk', '/desk/item', '/desk/sales-invoice']) {
    await deskPage.open(path)
    await expect(deskPage.page, `${path} sends the cashier back`).toHaveURL(/\/point-of-sale/)
    await expect(deskPage.cashierMessage).toBeVisible()
  }

  // Closing the till is allowed.
  await deskPage.open('/desk/pos-closing-entry/new')
  await deskPage.shows('New POS Closing Entry')
  await expect(deskPage.page).toHaveURL(/\/pos-closing-entry\/new/)

  // A manager is not redirected.
  await secondDevice.loginPage.signInThroughApi(manager.email, manager.password)
  await secondDevice.deskPage.open('/desk/item')
  await secondDevice.deskPage.shows('Item')
  await expect(secondDevice.page).toHaveURL(/\/item/)
})

test('TC-SIGNIN-005 a cashier signed in on a second device is signed out of the first', { tag: ['@nightly'] }, async ({
  loginPage,
  session,
  secondDevice,
  users,
}) => {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'Access', story: 'REQ-POS-019' })
  const { cashier } = users

  // Device A
  await loginPage.signInThroughApi(cashier.email, cashier.password)
  expect(await session.sessionUser()).toBe(cashier.email)
  // Device B
  await secondDevice.loginPage.signInThroughApi(cashier.email, cashier.password)

  expect(await secondDevice.session.sessionUser()).toBe(cashier.email)
  expect(await session.sessionStatus()).toBe(401)
})
