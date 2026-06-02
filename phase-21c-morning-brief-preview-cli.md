# ============================================================

# PHASE 21C.4

# MORNING BRIEF PREVIEW CLI

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Morning Brief contract/planner/generator
- Google Adapter foundation
- Verification Agent foundation
- Librarian
- PRODUCT.md
- DESIGN.md

Goal:

Add a preview-only CLI for Morning Brief.

The CLI should build a safe sample/metadata-only morning brief preview.

No delivery.

No scheduling.

No live Gmail/Calendar/Drive access.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- schedule brief delivery
- send notifications
- call Gmail
- call Calendar
- call Drive
- call live models
- mutate vault contents
- write Obsidian notes
- add background jobs

# REQUIRED WORK

1. Add CLI

Add:

npm run morning:brief

2. Preview flow

Use:

- MorningBriefRequest
- planMorningBrief()
- generateMorningBrief()

3. Data input

Use safe fixture/mock metadata only for now.

No live Google access.

4. Output

Print:

- title
- date
- section count
- priority summary
- caveats
- section previews
- delivery_attempted: false
- write_attempted: false

5. Tests

Prove:

- CLI preview works
- no live Google access
- no notifications
- no scheduling
- no vault writes
- no raw bodies

# REQUIRED COMMANDS

npm test -- src/lib/morning-brief
npx tsc --noEmit
npm test
npm run morning:brief
git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. CLI added
4. Preview behavior
5. Output format
6. Governance checks
7. Tests added/updated
8. Commands executed
9. Expansion Era verdict
10. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21C: add morning brief preview CLI
