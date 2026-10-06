/** `npm run seed`: prepare the test data without running tests. */
const { seed } = require('./seed')

seed().catch((err) => {
  console.error(`SEED FAILED: ${err.message}`)
  process.exit(1)
})
