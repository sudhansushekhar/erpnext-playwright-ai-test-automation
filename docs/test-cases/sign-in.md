# Scenario: Sign in

Script: `tests/access/sign-in.spec.js` · Area: Access · Owner: @sudhanshushekhar

## TC-001 a wrong password is refused and starts no session
**Runs:** `@smoke` · **Test data:** the Administrator user (from `.env`)

**Steps**
1. Open the sign-in screen.
2. Type `Administrator` and a wrong password; press **Continue**.

**Checks**
- The server refuses the sign-in (HTTP 401).
- The screen shows *Invalid credentials, try again.* and stays on the sign-in screen.
- No session was made: the server set this browser's session to `Guest`, and refuses a
  request that needs a signed-in user.

**Change it when** the sign-in screen, its button or its refusal message changes.
