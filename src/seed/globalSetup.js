/** Playwright globalSetup: prepare the test data once before the run. */
const { seed } = require('./seed')

module.exports = async () => {
  await seed()
}
