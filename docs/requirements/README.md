# Requirements

Business requirements (BRD) and product requirements (PRD) that test cases are written from.
One file per feature. The AI agent reads these to **draft** test cases; a tester reviews and
approves them before any test code is written (CLAUDE.md, "Test cases from requirements").

## Format

Every requirement has an **ID** and says one thing that can be checked:

```markdown
### REQ-POS-012 · A card payment needs its last 4 digits
At Complete Order, a sale paid (partly) by Debit Card or Credit Card is refused unless the
card's last 4 digits are entered. Message: "Enter the card's last 4 digits for the card payment."
```

- **ID**: `REQ-<AREA>-nnn`, never reused or renumbered. Test cases cite it (`Requirement: REQ-POS-012`).
- **One behaviour per requirement.** "And also..." is a second requirement.
- **Exact values** where they matter: amounts, rates, messages, limits.
- Unknowns go under **Open questions** at the end, never guessed.

## Documents

| File | Feature |
|---|---|
| [`pos-sale-prd.md`](pos-sale-prd.md) | Point of Sale: opening the till, selling, GST, payments (cash, UPI, card), closing |

⚠ Use only documents you are allowed to: your own, or public ones. Never copy an employer's or a
client's BRD/PRD into a personal repository.
