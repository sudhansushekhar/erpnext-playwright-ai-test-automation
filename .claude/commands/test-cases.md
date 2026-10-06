---
description: Draft test cases from a requirement document (BRD/PRD) in docs/requirements/
argument-hint: <docs/requirements/file.md> [REQ-ids or section]
---

Draft test cases from the requirement document: $ARGUMENTS

1. Read CLAUDE.md (especially "Test cases from requirements"), docs/test-cases/README.md (the format),
   docs/test-data.md (the only values you may use), and the requirement document.
2. If a test case file for this area already exists in docs/test-cases/, read it: add to it,
   never renumber or rewrite approved test cases. Continue the TC numbering.
3. For each requirement in scope, write at least one test case, plus the unhappy path as its own
   test case. Each names its requirement (`**Requirement:** REQ-...`), uses exact values from the
   document and docs/test-data.md, and checks the record the server saves, not only the screen.
4. Mark new test cases `Status: draft`. Do NOT write any test code.
5. Put everything unclear or contradictory under `## Open questions`, never guess.
6. End with a coverage table: every requirement ID in scope → its test cases, or "not covered: why".

Then show me: the file you wrote, the coverage table and the open questions, and stop for my review.
