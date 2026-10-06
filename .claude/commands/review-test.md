---
description: Review a spec file against CLAUDE.md rules and the review checklist; change nothing
argument-hint: <tests/.../file.spec.js>
---

Review, without changing any file: $ARGUMENTS

Read CLAUDE.md, the spec, the test case file it names, and the page objects it uses. Then check
each item and answer PASS or FAIL with the line number and the reason:

1. Title matches a test case heading exactly; first line names the test case file.
2. `test` and `expect` come from src/fixtures.js.
3. It checks the record the server saved, read back **by name** (not "the latest", not a count).
4. No locators in the spec; page-object locators use role, label or visible text (CSS only with a reason).
5. No `waitForTimeout`, `.skip`, `.only`, `.fixme`, `.fail`, retries.
6. Values come from `testData`, not typed literals; amounts match docs/test-data.md.
7. Exactly one tag (@smoke / @nightly / @quarantine with owner, issue, end date).
8. Anything it opens (a POS session, a draft) is closed or cleaned up.
9. Would it fail if the feature broke? Name the one assertion that would catch it, or say it has none.
10. Every check in the test case is asserted; nothing asserted that the test case does not say.

End with: the FAIL items as a short to-do list, ordered by risk.
