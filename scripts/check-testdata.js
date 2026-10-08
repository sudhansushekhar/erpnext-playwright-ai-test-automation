// Test data and tests, side by side. Part of `npm run lint` (and so of CI).
//   - A test that reads a test case no file has (renamed, deleted, mistyped) fails the lint.
//   - The same Test Case ID in two files fails the lint.
//   - A test case with data but no test yet is fine (the test may be written later): it is listed,
//     so nothing is forgotten, but the lint passes.
//
//   node scripts/check-testdata.js
const fs = require('fs')
const path = require('path')
const { readTestData } = require('../src/utils/dataReader')

const DATA_ROOT = 'testdata'
const TESTS_ROOT = 'tests'

/** Every file under `folder` (recursively) whose name matches `pattern`, with forward slashes. */
function filesIn(folder, pattern) {
  if (!fs.existsSync(folder)) return []
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = `${folder}/${entry.name}`
    if (entry.isDirectory()) return filesIn(full, pattern)
    return pattern.test(entry.name) && !entry.name.startsWith('~$') ? [full] : []
  })
}

// The test cases in the data: every .xlsx and .json file under testdata/.
const dataCases = new Map() // Test Case ID → where it is written
const problems = []
for (const file of filesIn(DATA_ROOT, /\.(xlsx|json)$/i)) {
  try {
    for (const testCase of readTestData({ file })) {
      const where = `${path.dirname(file)}/${testCase.where}`
      if (dataCases.has(testCase.testCaseId)) problems.push(`${where}: Test Case ID ${testCase.testCaseId} is also in ${dataCases.get(testCase.testCaseId)}`)
      else dataCases.set(testCase.testCaseId, where)
    }
  } catch (error) {
    problems.push(error.message)
  }
}

// The test cases the tests read: readTestData({ file, sheet, testCaseId: 'TC-...' }).
const usedCases = new Map() // Test Case ID → the spec that reads it
for (const spec of filesIn(TESTS_ROOT, /\.spec\.js$/)) {
  const source = fs.readFileSync(spec, 'utf8')
  for (const match of source.matchAll(/readTestData\(\{[^}]*testCaseId:\s*['"`]([^'"`]+)['"`]/g)) {
    usedCases.set(match[1], spec)
  }
}

for (const [testCaseId, spec] of usedCases) {
  if (!dataCases.has(testCaseId)) problems.push(`${spec} reads ${testCaseId}, which is in no file of ${DATA_ROOT}/`)
}
if (problems.length) {
  console.error(`check-testdata: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}`)
  process.exit(1)
}

const withoutTest = [...dataCases].filter(([testCaseId]) => !usedCases.has(testCaseId))
console.log(`check-testdata: ${dataCases.size} test case(s) in ${DATA_ROOT}/, ${dataCases.size - withoutTest.length} with a test`)
if (withoutTest.length) {
  console.log(`  No test yet (fine until it is scripted):\n${withoutTest.map(([testCaseId, where]) => `    ${testCaseId}  ${where}`).join('\n')}`)
}
