/**
 * Read test data from an Excel (.xlsx) or JSON (.json) file, for any module: sales, returns,
 * purchases... One function, the same call for both formats. Every column is read; no column list
 * and no per-module code.
 *
 *   const { readTestData } = require('../../src/utils/dataReader')
 *   readTestData({ file: 'testdata/sales/SaleTestData.xlsx', sheet: 'Sales', testCaseId: 'TC-SALE-101' })
 *   readTestData({ file: 'testdata/sales/SaleTestData.json', testCaseId: 'TC-SALE-102' })
 *   readTestData({ file: 'testdata/sales/SaleTestData.json' })   every test case of the file (a list)
 *
 * With a testCaseId it returns that test case; an Excel file needs its sheet, a JSON file has none.
 * It stops with a clear message if the file has problems, or the sheet or test case is not there.
 *
 * A test case: { testCaseId, title, requirement, tag, ..., transactions: [ { transactionType, ..., lines: [ {...} ] } ] }
 *
 * Excel: a header row, then one row per line. A header becomes a key in camelCase: "Item Code" →
 * itemCode, "Pay Amount" → payAmount, "UPI Transaction ID" → upiTransactionId.
 *
 *   - "Test Case ID" starts a test case. The columns BEFORE "Transaction Type" (Title, Requirement,
 *     Tag...) belong to the test case, from its first row.
 *   - "Transaction Type" starts a transaction in that test case. It gets every column from its first
 *     row (totals, payment...: merged cells keep their value in the top cell).
 *   - Every row of a transaction is one of its `lines`, with that row's own values.
 *   Blank cells below a test case or transaction belong to the same one; blank rows are skipped.
 *
 * JSON: the same shape, with the same keys, written by hand:
 *
 *   { "testCases": [ { "testCaseId": "TC-SALE-102", "title": "...", "requirement": "REQ-POS-011", "tag": "@nightly",
 *       "transactions": [ { "transactionType": "Sale", "grandTotal": 236, "paymentType": "UPI", "payAmount": 236,
 *         "lines": [ { "itemCode": "QA-DATA-001", "itemName": "QA Data Item", "qty": 2, "lineTotal": 236 } ] } ] } ] }
 *
 * Every test case, transaction and line keeps `where` it was written (file › sheet › row), for messages.
 * Checked here, for every module: each test case has an ID (unique in its file) and transactions;
 * card numbers, expiry dates, CVVs and passwords are never accepted (PCI, secrets). What the values must
 * be is the test's business: it uses them in its steps and checks.
 */
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const CASE_ID = 'testCaseId'
const TRANSACTION_TYPE = 'transactionType'

// Columns never accepted, in any module: payment card data and secrets.
const FORBIDDEN = [
  { pattern: /card(no|number)$/i, reason: 'a full card number is never stored (PCI): use the last 4 digits' },
  { pattern: /(expiry|expiration|cvv|cvc)/i, reason: 'card expiry dates and CVVs are never stored (PCI)' },
  { pattern: /(password|secret|token)/i, reason: 'secrets never go in test data: use .env' },
]

/** "UPI Transaction ID" → "upiTransactionId", "Credit Date/ExpiryDate" → "creditDateExpiryDate". */
function keyOf(header) {
  const words = String(header || '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  return words.map((word, index) => (index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase())).join('')
}

const fileCache = new Map() // each file is read once, however many tests use it

function readTestData({ file, sheet, testCaseId } = {}) {
  if (!file) throw new Error('readTestData needs { file } (and sheet for an Excel file, testCaseId for one test case)')
  const isExcel = /\.xlsx$/i.test(file)
  if (!isExcel && sheet) throw new Error(`${file}: a JSON file has no sheets; remove sheet: '${sheet}'`)
  if (!fileCache.has(file)) fileCache.set(file, readFile(file))
  let testCases = fileCache.get(file)

  if (sheet) {
    if (!testCases.some((testCase) => testCase.sheet === sheet)) {
      const sheets = [...new Set(testCases.map((testCase) => testCase.sheet))].join(', ') || 'none'
      throw new Error(`${file}: no sheet "${sheet}" with test cases (sheets with test cases: ${sheets})`)
    }
    testCases = testCases.filter((testCase) => testCase.sheet === sheet)
  }
  if (!testCaseId) return testCases

  if (isExcel && !sheet) throw new Error(`${file}: an Excel file needs its sheet: readTestData({ file, sheet: 'Sales', testCaseId: '${testCaseId}' })`)
  const found = testCases.find((testCase) => testCase[CASE_ID] === testCaseId)
  if (!found) {
    const known = testCases.map((testCase) => testCase[CASE_ID]).join(', ') || 'none'
    throw new Error(`${file}${sheet ? ` › ${sheet}` : ''}: no test case ${testCaseId} (it has: ${known})`)
  }
  return found
}

/** Every test case of one file. Stops with every problem found in it. */
function readFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Test data file ${file} does not exist`)
  const problems = []
  const name = path.basename(file)
  const testCases = /\.json$/i.test(file) ? readJson(file, name, problems) : readExcel(file, name, problems)
  checkShape(testCases, problems)
  if (problems.length) throw new Error(`Test data ${file} has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`)
  return testCases
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────

function readJson(file, name, problems) {
  let data
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    problems.push(`${name}: not valid JSON (${error.message})`)
    return []
  }
  if (!Array.isArray(data.testCases)) {
    problems.push(`${name}: needs { "testCases": [ ... ] }`)
    return []
  }
  return data.testCases.map((testCase, caseIndex) => {
    const caseAt = `${name} › testCases[${caseIndex}]`
    rejectForbidden(testCase, caseAt, problems)
    return {
      ...testCase,
      file: name,
      where: caseAt,
      transactions: (testCase.transactions || []).map((transaction, transactionIndex) => {
        const transactionAt = `${caseAt}.transactions[${transactionIndex}]`
        rejectForbidden(transaction, transactionAt, problems)
        return {
          ...transaction,
          where: transactionAt,
          lines: (transaction.lines || []).map((line, lineIndex) => {
            const lineAt = `${transactionAt}.lines[${lineIndex}]`
            rejectForbidden(line, lineAt, problems)
            return { ...line, where: lineAt }
          }),
        }
      }),
    }
  })
}

function readExcel(file, name, problems) {
  const book = XLSX.readFile(file)
  const testCases = []
  for (const sheet of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: true })
    if (!rows.length) continue
    const keys = rows[0].map(keyOf)
    const caseColumn = keys.indexOf(CASE_ID)
    const typeColumn = keys.indexOf(TRANSACTION_TYPE)
    if (caseColumn < 0 || typeColumn < 0) {
      problems.push(`${name} › ${sheet}: needs the columns "Test Case ID" and "Transaction Type"`)
      continue
    }
    keys.forEach((key, column) => {
      const rule = FORBIDDEN.find((forbidden) => forbidden.pattern.test(key))
      if (rule && rows.slice(1).some((row) => isFilled(row[column]))) problems.push(`${name} › ${sheet} › column "${rows[0][column]}": ${rule.reason}`)
    })

    let testCase = null
    let transaction = null
    rows.slice(1).forEach((row, rowIndex) => {
      const place = `${name} › ${sheet} › row ${rowIndex + 2}` // Excel's row number: the header is row 1
      const valuesOf = (fromColumn, toColumn = keys.length) => Object.fromEntries(
        keys.slice(fromColumn, toColumn)
          .map((key, offset) => [key, row[fromColumn + offset]])
          .filter(([key, value]) => key && isFilled(value))
          .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
      )
      if (!Object.keys(valuesOf(0)).length) return // a blank row

      if (isFilled(row[caseColumn])) {
        testCase = { ...valuesOf(0, typeColumn), file: name, sheet, where: place, transactions: [] }
        transaction = null
        testCases.push(testCase)
      } else if (!testCase) {
        problems.push(`${place}: comes before any "Test Case ID"`)
        return
      }
      if (isFilled(row[typeColumn])) {
        transaction = { ...valuesOf(typeColumn), where: place, lines: [] }
        testCase.transactions.push(transaction)
      } else if (!transaction) {
        problems.push(`${place}: comes before any "Transaction Type" in ${testCase[CASE_ID]}`)
        return
      }
      const line = valuesOf(typeColumn + 1)
      if (Object.keys(line).length) transaction.lines.push({ ...line, where: place })
    })
  }
  return testCases
}

const isFilled = (value) => value !== null && value !== undefined && String(value).trim() !== ''

function rejectForbidden(record, place, problems) {
  for (const key of Object.keys(record)) {
    const rule = FORBIDDEN.find((forbidden) => forbidden.pattern.test(key))
    if (rule && isFilled(record[key])) problems.push(`${place} › ${key}: ${rule.reason}`)
  }
}

function checkShape(testCases, problems) {
  const firstPlace = new Map()
  for (const testCase of testCases) {
    const id = testCase[CASE_ID]
    if (!isFilled(id)) problems.push(`${testCase.where}: a test case without "Test Case ID"`)
    else if (firstPlace.has(id)) problems.push(`${testCase.where}: Test Case ID ${id} is also at ${firstPlace.get(id)}`)
    else firstPlace.set(id, testCase.where)
    if (!testCase.transactions || !testCase.transactions.length) problems.push(`${testCase.where}: ${id} has no transactions`)
    for (const transaction of testCase.transactions || []) {
      if (!isFilled(transaction[TRANSACTION_TYPE])) problems.push(`${transaction.where}: a transaction without "Transaction Type"`)
      if (!transaction.lines || !transaction.lines.length) problems.push(`${transaction.where}: a transaction without lines`)
    }
  }
}

module.exports = { readTestData }
