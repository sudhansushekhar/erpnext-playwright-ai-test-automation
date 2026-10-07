# Working with AI: the daily loop

The tester decides **what** to test and judges the result; the AI agent (Claude Code) writes the
code under the rules in [`CLAUDE.md`](../CLAUDE.md). Open Claude Code in this folder; the slash
commands below are in `.claude/commands/` and work in any session here.

```
requirement (BRD/PRD)  ──/test-cases──▶  test case (draft)  ──you review──▶  test case (approved)
        docs/requirements/                docs/test-cases/                          │
                                                                                     ▼
 pull request ◀── commit ◀── /mutation-check ◀── /review-test + your review ◀── /write-test
                                                                              tests/, src/pages/
```

## The loop

| # | Step | Command / where | Who |
|---|---|---|---|
| 1 | Start ERPNext (retail_pos_india: `npm run erp:up`), check it is ready | `npm run check` | you |
| 2 | Requirements in, with IDs | `docs/requirements/<feature>.md` | you (or a BA) |
| 3 | Draft test cases from them | `/test-cases docs/requirements/pos-sale-prd.md REQ-POS-009..013` | AI |
| 4 | **Review the draft**: right values? missing cases? answer the open questions; set `Status: approved` | `docs/test-cases/<area>.md` | **you** |
| 5 | Write the test, run it, prove it can fail | `/write-test docs/test-cases/pos-sale.md TC-POS-001` | AI |
| 6 | **Review the test** against the checklist | `/review-test tests/pos/sale.spec.js` + read it yourself | AI + **you** |
| 7 | Watch it, read the report | `npm run test:headed`, `npm run report` | you |
| 8 | Log what the AI got wrong, add the rule | `docs/ai-review-log.md`, `CLAUDE.md` | AI, **you approve** |
| 9 | Branch, commit; push only after you say yes; pull request on GitHub | `git switch -c feature/...` | AI asks, **you decide** |

Steps 4, 6 and 8 are the tester's job and the point of this repository: the AI writes fast,
you make sure it tests the right thing.

## The commands

| Command | Does | Changes files? |
|---|---|---|
| `/test-cases <requirements file> [REQ ids]` | Drafts test cases (Status: draft), a coverage table and open questions | test case file only |
| `/write-test <test case file> <TC-<AREA>-nnn>` | Writes page-object methods and the spec from an **approved** test case, runs it, mutation-checks it | tests, page objects |
| `/review-test <spec file>` | Checks the spec against the 10-point list below; PASS/FAIL with line numbers | no |
| `/mutation-check <spec file> [TC]` | Breaks the main expectation, shows the failure, restores it | no (restores) |

Without the commands, plain prompts work too, for example:

> Read CLAUDE.md, docs/test-data.md and docs/test-cases/pos-sale.md. Write the test for TC-POS-001,
> reuse existing page objects, run it on Chromium and show me the real result.

> TC-POS-001 failed. Read the error and the trace: product bug, test bug, timing or test data?
> Show the evidence before suggesting a fix.

## Reviewing an AI-written test (the checklist)

1. Title = a test case heading; first line names the test case file.
2. Imports only `src/fixtures` and `src/utils` (the lint checks it).
3. Checks the **saved record by its name**, not only the screen.
4. No locators in the spec; locators by role, label or visible text.
5. No `waitForTimeout`, `.skip`, `.only`, retries (the lint checks it).
6. Values from `testData`; amounts match `docs/test-data.md`.
7. Exactly one tag.
8. Cleans up what it opens (POS session, drafts).
9. **Would fail if the feature broke** (the mutation check proves it).
10. Asserts everything the test case says, and nothing it does not.

## Guardrails: rules checked by machines

An AI agent forgets instructions; a check does not. Every rule that can be checked by a program is:

| Check | When | What happens on a break |
|---|---|---|
| `npm run lint` (`eslint.config.js`) | any time | lists each break with the CLAUDE.md rule number |
| Edit hook (`.claude/settings.json` → `scripts/lint-edited-file.js`) | after **every file the AI edits** in `tests/` or `src/` | the lint output goes straight back to the agent, which fixes it before going on |
| CI (`.github/workflows/playwright-e2e.yml`) | every pull request | the pull request shows red: lint first, then the tests on a fresh ERPNext |
| Mutation check (`/mutation-check`) | every new test | proves the test can fail |

What a machine cannot check (the right expected values, a missing case, testing the screen only)
is what **your** review is for: steps 4 and 6 above, and the checklist below.

## From a BRD / PRD

- Put the document in `docs/requirements/` with an **ID per requirement** (`REQ-POS-012`),
  one behaviour each, exact values, and open questions at the end. See
  [`docs/requirements/README.md`](requirements/README.md) and the sample
  [`pos-sale-prd.md`](requirements/pos-sale-prd.md).
- The AI **drafts**; you **approve**. Typical things to catch in a draft: an invented message or
  amount, a missing unhappy path, a requirement with no test case, a check on the screen only.
- The coverage table at the end of every draft is your traceability: requirement → test cases.
- Only use requirement documents you may use (your own or public); never an employer's or a client's.
