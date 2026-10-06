# Test cases

Every test is written here first, in plain English, by the tester. The AI agent turns the
test case into code; the test case stays the record of what the test must prove.
The layout follows the iVendNext POS journey docs.

| Level | Here |
|---|---|
| **Test scenario**: what to test, one feature | one file, e.g. `sign-in.md` ("Scenario: Sign in") |
| **Test case**: one path through it, with steps and checks | one `## TC-nnn` section in that file |
| **Test script**: the test case automated | one `test(...)` in the matching spec file |

**One file per scenario, named after its spec file**: `tests/access/sign-in.spec.js` →
`docs/test-cases/sign-in.md`. **One section per test case**, headed by the test's exact title.

```markdown
# Scenario: <feature, in a few words>

Script: `tests/<area>/<name>.spec.js` · Area: <area> · Owner: @<github-handle>

## TC-nnn <what happens, in one line: this is also the test's title>
**Runs:** `@smoke` or `@nightly` · **Test data:** <what the seed prepared that it uses>

**Steps**
1. <what the user does, one action per step>
2. ...

**Checks**
- <what the screen shows, in its exact words>
- <the record the server saved, read back by name: doctype, status, amounts, links>

**Change it when** <which screen or business rule, if changed, means this test case changes too>
```

A good test case:

- checks the **record the server saved**, not only what the screen shows;
- gives **exact values** (amounts, statuses, messages), never "correct" or "updated";
- covers one behaviour; a second behaviour is a second test case;
- has its **negative case** as its own test case (refused, invalid, not allowed).

The AI agent must not invent a value the test case does not give. If it needs one, it asks.
