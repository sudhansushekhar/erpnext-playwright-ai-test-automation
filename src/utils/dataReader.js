/**
 * Read test data from an Excel (.xlsx) or JSON (.json) file, for any module: sales, returns,
 * purchases... Every column is read; there is no column list and no per-module code.
 *
 *   const { readTestData } = require('../../src/utils/dataReader')
 *   readTestData({ file: 'testdata/sales/SaleTestData.xlsx', sheet: 'Sales', testCaseId: 'TC-SALE-101' })
 *   readTestData({ file: 'testdata/sales/SaleTestData.json', testCaseId: 'TC-SALE-102' })
 *   readTestData({ file: 'testdata/sales/SaleTestData.json' })   every test case of the file (a list)
 *
 * Both formats give the same shape:
 *
 *   { testCaseId, title, requirement, tag, ..., where,
 *     transactions: [ { transactionType, grandTotal, ..., where,
 *       lines: [ { itemCode, qty, ..., where } ] } ] }
 *
 * `where` says where each part is written (file › sheet › row), for error messages.
 *
 * JSON is written in that shape by hand: { "testCases": [ ... ] }.
 *
 * Excel has a header row, then one row per line. Each header becomes a camelCase key
 * ("Item Code" → itemCode). On a row:
 *   - a "Test Case ID" starts a new test case; it takes the columns before "Transaction Type".
 *   - a "Transaction Type" starts a new transaction; it takes that column and every one after it.
 *   - the columns after "Transaction Type" are also the row's line.
 * Blank cells below a test case or transaction belong to it (merged cells keep their value in the
 * top cell). Blank rows are skipped.
 */
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const cache = new Map() // file → its test cases; each file is read once, however many tests use it

function readTestData({ file, sheet, testCaseId } = {}) {
  if (!file) throw new Error('readTestData needs { file } (and sheet for an Excel file, testCaseId for one test case)')
  const isExcel = file.toLowerCase().endsWith('.xlsx')
  if (!isExcel && sheet) throw new Error(`${file}: a JSON file has no sheets; remove sheet: '${sheet}'`)
  if (isExcel && testCaseId && !sheet) throw new Error(`${file}: an Excel file needs its sheet: readTestData({ file, sheet: 'Sales', testCaseId: '${testCaseId}' })`)

  if (!cache.has(file)) cache.set(file, loadFile(file, isExcel))
  const allTestCases = cache.get(file)

  const testCases = sheet ? allTestCases.filter((testCase) => testCase.sheet === sheet) : allTestCases
  if (sheet && !testCases.length) throw new Error(`${file}: no sheet "${sheet}" with test cases`)
  if (!testCaseId) return testCases

  const found = testCases.find((testCase) => testCase.testCaseId === testCaseId)
  if (!found) throw new Error(`${file}: no test case ${testCaseId} (it has: ${testCases.map((testCase) => testCase.testCaseId).join(', ')})`)
  return found
}

function loadFile(file, isExcel) {
  if (!fs.existsSync(file)) throw new Error(`Test data file ${file} does not exist`)
  const testCases = isExcel ? readExcel(file) : readJson(file)
  check(testCases)
  return testCases
}

// ── JSON: already in the right shape; only add `file` and `where` ──────────────────────

function readJson(file) {
  const name = path.basename(file)
  let testCases
  try {
    testCases = JSON.parse(fs.readFileSync(file, 'utf8')).testCases
  } catch (error) {
    throw new Error(`${name}: not valid JSON (${error.message})`, { cause: error })
  }
  if (!Array.isArray(testCases)) throw new Error(`${name}: needs { "testCases": [ ... ] }`)

  testCases.forEach((testCase, caseIndex) => {
    testCase.file = name
    testCase.where = `${name} › testCases[${caseIndex}]`
    testCase.transactions = testCase.transactions || []
    testCase.transactions.forEach((transaction, transactionIndex) => {
      transaction.where = `${testCase.where}.transactions[${transactionIndex}]`
      transaction.lines = transaction.lines || []
      transaction.lines.forEach((line, lineIndex) => {
        line.where = `${transaction.where}.lines[${lineIndex}]`
      })
    })
  })
  return testCases
}

// ── Excel: every sheet, row by row ──────────────────────────────────────────────────────

function readExcel(file) {
  const workbook = XLSX.readFile(file)
  return workbook.SheetNames.flatMap((sheet) => readSheet(workbook.Sheets[sheet], sheet, path.basename(file)))
}

function readSheet(worksheet, sheet, name) {
  const [header, ...rows] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, blankrows: true })
  if (!header) return [] // an empty sheet

  const keys = header.map(toCamelCase)
  const caseColumn = keys.indexOf('testCaseId')
  const typeColumn = keys.indexOf('transactionType')
  if (caseColumn < 0 || typeColumn < 0) throw new Error(`${name} › ${sheet}: needs the columns "Test Case ID" and "Transaction Type"`)

  // The filled cells of a row, from one column up to (not including) another, as { key: value }.
  const cellsOf = (row, fromColumn, toColumn = keys.length) => {
    const cells = {}
    for (let column = fromColumn; column < toColumn; column++) {
      if (keys[column] && isFilled(row[column])) cells[keys[column]] = trim(row[column])
    }
    return cells
  }

  const testCases = []
  rows.forEach((row, index) => {
    const where = `${name} › ${sheet} › row ${index + 2}` // Excel's row number: the header is row 1
    if (!row.some(isFilled)) return // a blank row

    if (isFilled(row[caseColumn])) {
      testCases.push({ ...cellsOf(row, 0, typeColumn), file: name, sheet, where, transactions: [] })
    }
    const testCase = testCases.at(-1)
    if (!testCase) throw new Error(`${where}: comes before any "Test Case ID"`)

    if (isFilled(row[typeColumn])) {
      testCase.transactions.push({ ...cellsOf(row, typeColumn), where, lines: [] })
    }
    const transaction = testCase.transactions.at(-1)
    if (!transaction) throw new Error(`${where}: comes before any "Transaction Type" in ${testCase.testCaseId}`)

    const line = cellsOf(row, typeColumn + 1)
    if (Object.keys(line).length) transaction.lines.push({ ...line, where })
  })
  return testCases
}

/** "UPI Transaction ID" → "upiTransactionId", "Credit Date/ExpiryDate" → "creditDateExpiryDate". */
function toCamelCase(header) {
  const words = String(header || '').split(/[^A-Za-z0-9]+/).filter(Boolean)
  return words.map((word, index) => (index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase())).join('')
}

// ── Checks, the same for both formats ──────────────────────────────────────────────────

function check(testCases) {
  const seen = new Set()
  for (const testCase of testCases) {
    const { testCaseId, where } = testCase
    if (!isFilled(testCaseId)) throw new Error(`${where}: a test case without "Test Case ID"`)
    if (seen.has(testCaseId)) throw new Error(`${where}: Test Case ID ${testCaseId} is used twice in the file`)
    seen.add(testCaseId)
    if (!testCase.transactions.length) throw new Error(`${where}: ${testCaseId} has no transactions`)
    rejectSecrets(testCase)

    for (const transaction of testCase.transactions) {
      if (!isFilled(transaction.transactionType)) throw new Error(`${transaction.where}: a transaction without "Transaction Type"`)
      if (!transaction.lines.length) throw new Error(`${transaction.where}: a transaction without lines`)
      rejectSecrets(transaction)
      transaction.lines.forEach(rejectSecrets)
    }
  }
}

/** Passwords and tokens belong in .env, never in test data (CLAUDE.md rule 11). */
function rejectSecrets(record) {
  const key = Object.keys(record).find((name) => /password|secret|token/i.test(name) && isFilled(record[name]))
  if (key) throw new Error(`${record.where} › ${key}: secrets never go in test data: use .env`)
}

const isFilled = (value) => value !== null && value !== undefined && String(value).trim() !== ''
const trim = (value) => (typeof value === 'string' ? value.trim() : value)

module.exports = { readTestData }
