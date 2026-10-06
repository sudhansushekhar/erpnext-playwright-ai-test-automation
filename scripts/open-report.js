/** `npm run report`: open the reporting-labs report of the last run in the default browser. */
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')

const file = path.join(__dirname, '..', '.results', 'reporting-labs', 'index.html')
if (!fs.existsSync(file)) {
  console.error(`No report yet (${file}). Run the tests first: npm test`)
  process.exitCode = 1
} else {
  const open = process.platform === 'win32' ? `start "" "${file}"` : process.platform === 'darwin' ? `open "${file}"` : `xdg-open "${file}"`
  exec(open)
  console.log(`Opened ${file}`)
}
