// Test case: docs/test-cases/sign-in.md (TC-SIGNIN-001 to TC-SIGNIN-005)
const { test, expect, meta } = require('../../src/fixtures')
const { FrappeClient } = require('../../src/api/FrappeClient')
const { closeOpenTillsOf } = require('../../src/api/till')
const { LoginPage } = require('../../src/pages/LoginPage')
const { DeskPage } = require('../../src/pages/DeskPage')
const { PosPage } = require('../../src/pages/PosPage')

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

test('TC-SIGNIN-002 Administrator signs in and lands on the QA Testing page', { tag: ['@smoke'] }, async ({
  loginPage,
  desk,
  session,
  env,
  testData,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'Access' })
  await loginPage.open()

  const response = await loginPage.signIn(env.adminUser, env.adminPassword)

  expect(response.status()).toBe(200)
  await expect(loginPage.page).toHaveURL(new RegExp(`/desk/${testData.landingWorkspace.toLowerCase().replace(/ /g, '-')}$`))
  await expect(desk.qaTestingIntro).toBeVisible()
  await expect(desk.serverError).toBeHidden()
  expect(await session.sessionUser()).toBe(env.adminUser)
})

test('TC-SIGNIN-003 a cashier signs in straight to the Point of Sale, ready to open the till', { tag: ['@smoke'] }, async ({
  loginPage,
  page,
  session,
  api,
  env,
  testData,
}) => {
  meta({ priority: 'P0', severity: 'blocker', owner: 'sudhansushekhar', feature: 'Access', story: 'REQ-POS-017' })
  const cashier = testData.tills[0].users[0] // Anjali, Till 1
  await closeOpenTillsOf(api, cashier, { timeZone: testData.timezone }) // her till must not be open
  const pos = new PosPage(page)
  await loginPage.open()

  const response = await loginPage.signIn(cashier, env.demoUserPassword)

  expect(response.status()).toBe(200)
  await expect(page).toHaveURL(/\/desk\/selling\/point-of-sale$/)
  await expect(pos.openingDialog).toBeVisible()
  expect(await session.sessionUser()).toBe(cashier)
})

test('TC-SIGNIN-004 a cashier stays on the Point of Sale: other desk pages send them back', { tag: ['@nightly'] }, async ({
  loginPage,
  desk,
  page,
  secondDevice,
  env,
  testData,
}) => {
  meta({ priority: 'P2', severity: 'major', owner: 'sudhansushekhar', feature: 'Access', story: 'REQ-POS-018' })
  const cashier = testData.users.find((u) => u.role === 'Cashier').email
  const manager = testData.users.find((u) => u.role === 'Store Manager').email
  await loginPage.signInThroughApi(cashier, env.demoUserPassword)

  for (const path of ['/desk', '/desk/item', '/desk/sales-invoice']) {
    await desk.open(path)
    await expect(page, `${path} sends the cashier back`).toHaveURL(/\/point-of-sale/)
    await expect(desk.cashierMessage).toBeVisible()
  }

  // Closing the till is allowed.
  await desk.open('/desk/pos-closing-entry/new')
  await desk.shows('New POS Closing Entry')
  await expect(page).toHaveURL(/\/pos-closing-entry\/new/)

  // A manager is not redirected.
  const managerLogin = new LoginPage(secondDevice)
  const managerDesk = new DeskPage(secondDevice)
  await managerLogin.signInThroughApi(manager, env.demoUserPassword)
  await managerDesk.open('/desk/item')
  await managerDesk.shows('Item')
  await expect(secondDevice).toHaveURL(/\/item/)
})

test('TC-SIGNIN-005 a cashier signed in on a second device is signed out of the first', { tag: ['@nightly'] }, async ({
  loginPage,
  page,
  secondDevice,
  env,
  testData,
}) => {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'Access', story: 'REQ-POS-019' })
  const cashier = testData.users.find((u) => u.role === 'Cashier').email
  const deviceA = FrappeClient.fromContext(page.request)
  const deviceB = FrappeClient.fromContext(secondDevice.request)

  await loginPage.signInThroughApi(cashier, env.demoUserPassword)
  expect(await deviceA.sessionUser()).toBe(cashier)
  await new LoginPage(secondDevice).signInThroughApi(cashier, env.demoUserPassword)

  expect(await deviceB.sessionUser()).toBe(cashier)
  expect(await deviceA.sessionStatus()).toBe(401)
})
