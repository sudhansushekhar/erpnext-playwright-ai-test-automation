/**
 * Show a data-driven test case in the report, for any module: which file (and sheet, row) it comes
 * from, as a "testdata" label, and its rows as a table. Also checks the data fits the test.
 *
 *   const testCase = readTestData({ file: JSON_FILE, testCaseId: 'TC-SALE-102' })
 *   await reportTestData(testCase, testData)
 */
const { test, expect, meta, reportData } = require('../fixtures')

/**
 * Report `testCase` (read by src/utils/dataReader.js) and check that it fits the running test:
 *   - the data's Test Case ID and Title are the test's title;
 *   - no line uses a billing counter's own item (that counter's tests count its stock exactly).
 */
async function reportTestData(testCase, testData) {
  meta({ priority: 'P1', severity: 'critical', owner: 'sudhansushekhar', feature: 'POS', story: testCase.requirement, testdata: testCase.where })
  const rows = testCase.transactions.flatMap((transaction) =>
    transaction.lines.map(({ where, ...line }) => ({ transaction: transaction.transactionType, ...line, row: where })))
  await reportData(rows, `${testCase.testCaseId} (${testCase.where})`)

  expect(`${testCase.testCaseId} ${testCase.title}`, `${testCase.where}: the data's Test Case ID and Title match the test's title`).toBe(test.info().title)
  const counterItems = new Set(testData.billingCounters.map((counter) => counter.item.code))
  for (const row of rows.filter((line) => line.itemCode)) {
    expect(counterItems.has(row.itemCode), `${row.row}: ${row.itemCode} is a billing counter's own item; use QA-DATA-001`).toBe(false)
  }
}

module.exports = { reportTestData }
