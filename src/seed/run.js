/** `npm run seed`: prepare the test data without running tests. */
const { seed } = require('./seed')

seed().catch((error) => {
  console.error(`SEED FAILED: ${error.message}`)
  process.exit(1)
})
