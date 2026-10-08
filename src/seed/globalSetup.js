/** Playwright globalSetup: prepare the test data once before the run, then warm the server up. */
const { seed } = require('./seed')
const { warmUp } = require('./warmUp')

module.exports = async () => {
  const testData = await seed()
  await warmUp(testData)
}
