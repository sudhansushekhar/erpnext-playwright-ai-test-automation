---
description: Write the Playwright test for an approved test case, run it, and prove it can fail
argument-hint: <docs/test-cases/file.md> <TC-<AREA>-nnn>
---

Write the test for: $ARGUMENTS

1. Read CLAUDE.md (all rules), the test case, docs/test-data.md, src/fixtures.js and every page
   object in src/pages/. The test case must be `Status: approved` (or written by a tester);
   if it is a draft, stop and tell me.
2. If anything in the test case is ambiguous, stop and ask. Do not invent values or rules.
3. Find locators from the real page (its accessibility tree), not from memory. New user actions
   become page-object methods; the spec holds steps and checks only.
4. Write the spec: title = the test case heading, first line names the test case file, values
   from `testData`, the saved record read back by name with `api.getDoc`.
5. Run it: `npx playwright test <spec> --project=chromium`. Report the real result.
6. Mutation check: break one expected value, run, show the failure, restore it, run again.
7. If you made a mistake on the way that review or a run caught, add it to docs/ai-review-log.md.

Show me: the files changed, both run results, and anything you were unsure about. Do not commit.
