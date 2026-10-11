/**
 * Playwright globalSetup, once before the workers start: prepare the test data, warm the server up,
 * and sign the automation user in once for every worker's API session.
 */
const { seed } = require('./seed')
const { warmUp } = require('./warmUp')
const { saveApiSession } = require('./apiSession')

module.exports = async () => {
  const testData = await seed()
  await warmUp(testData)
  await saveApiSession(testData)
}
