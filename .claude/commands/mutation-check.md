---
description: Prove a test can fail - break its expectation, run, restore, run again
argument-hint: <tests/.../file.spec.js> [test title or TC-nnn]
---

Mutation check for: $ARGUMENTS

1. Read the spec and pick the assertion that guards the main business result (e.g. the grand
   total, the GST lines, the payment mode, the refusal message).
2. Change only its expected value to something wrong but plausible (e.g. 118 → 119).
3. Run `npx playwright test <spec> --project=chromium` and show the failure output.
4. Restore the original value exactly (show the diff is empty), run again and show it passes.

If the test still passes after the change, say so loudly: the test proves nothing, and tell me
what assertion is missing. Do not commit.
