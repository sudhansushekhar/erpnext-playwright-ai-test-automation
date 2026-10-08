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
  expect(response.status(), 'The server refuses the sign-in (HTTP 401)').toBe(401)
  // ...the screen says so and stays on the sign-in screen...
  await expect(loginPage.alert, 'The screen says the credentials are invalid').toHaveText('Invalid credentials, try again.')
  await expect(loginPage.page, 'Still on the sign-in screen').toHaveURL(/\/login$/)
  // ...and this browser holds no signed-in session: the server set it to Guest,
  // and refuses a request that needs a signed-in user.
  const cookies = Object.fromEntries((await context.cookies()).map((cookie) => [cookie.name, cookie.value]))
  expect.soft(cookies.user_id, "The browser's session is Guest").toBe('Guest')
  expect.soft(await session.sessionUser(), 'The server sees nobody signed in').toBeNull()
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

  expect(response.status(), 'The server accepts the sign-in').toBe(200)
  await expect(deskPage.page, 'Lands on the QA Testing page').toHaveURL(new RegExp(`${deskPage.pathOf(testData.landingWorkspace)}$`))
  await expect(deskPage.qaTestingIntro, 'The QA Testing page is shown').toBeVisible()
  await expect(deskPage.serverError, 'No "Server Error" page').toBeHidden()
  expect.soft(await session.sessionUser(), 'Signed in as Administrator').toBe(users.admin.email)
})

test('TC-SIGNIN-003 a cashier signs in straight to the Point of Sale, ready to open a shift', { tag: ['@smoke'] }, async ({
  loginPage,
  posPage,
  session,
  shifts,
  users,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'Access', story: 'REQ-POS-017' })
  const { cashier } = users
  await shifts.closeAllOf(cashier.email) // she must have no open shift
  await loginPage.open()

  const response = await loginPage.signIn(cashier.email, cashier.password)

  expect(response.status(), 'The server accepts the sign-in').toBe(200)
  await expect(posPage.page, 'Lands on the Point of Sale').toHaveURL(/\/desk\/selling\/point-of-sale$/)
  await expect(posPage.openingDialog, 'The opening dialog asks to open a shift').toBeVisible()
  expect.soft(await session.sessionUser(), 'Signed in as the cashier').toBe(cashier.email)
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
    await expect(deskPage.cashierMessage, 'The message "Cashiers use the Point of Sale." is shown').toBeVisible()
  }

  // Closing the shift is allowed.
  await deskPage.open('/desk/pos-closing-entry/new')
  await deskPage.shows('New POS Closing Entry')
  await expect(deskPage.page, 'Stays on the POS Closing Entry form').toHaveURL(/\/pos-closing-entry\/new/)

  // A manager is not redirected.
  await secondDevice.loginPage.signInThroughApi(manager.email, manager.password)
  await secondDevice.deskPage.open('/desk/item')
  await secondDevice.deskPage.shows('Item')
  await expect(secondDevice.page, 'The manager stays on the Item list').toHaveURL(/\/item/)
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
  expect(await session.sessionUser(), 'Device A is signed in as the cashier').toBe(cashier.email)
  // Device B
  await secondDevice.loginPage.signInThroughApi(cashier.email, cashier.password)

  expect.soft(await secondDevice.session.sessionUser(), 'Device B is signed in as the cashier').toBe(cashier.email)
  expect.soft(await session.sessionStatus(), "Device A's session has ended (HTTP 401)").toBe(401)
})
