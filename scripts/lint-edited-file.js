/**
 * Claude Code hook (.claude/settings.json, PostToolUse on Edit|Write): after an AI agent edits a
 * .js file under tests/ or src/, lint that file. On a finding it exits 2 and prints the lint
 * output on stderr, which Claude Code hands back to the agent to fix at once.
 * The same rules run for people in `npm run lint` and in CI.
 */
const path = require('path')
const { execFileSync } = require('child_process')

let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  let file
  try {
    const event = JSON.parse(input)
    file = event.tool_input?.file_path || event.tool_response?.filePath
  } catch {
    return // not a hook payload: nothing to do
  }
  if (!file) return
  const root = path.resolve(__dirname, '..')
  const rel = path.relative(root, path.resolve(file)).split(path.sep).join('/')
  if (!/^(tests|src)\/.*\.js$/.test(rel)) return

  try {
    execFileSync(process.execPath, [path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js'), rel], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    process.stderr.write(`Lint (CLAUDE.md rules) failed for ${rel}; fix it before going on:\n${err.stdout || ''}${err.stderr || ''}`)
    process.exit(2)
  }
})
