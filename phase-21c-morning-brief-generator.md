# ============================================================

# PHASE 21C.3

# MORNING BRIEF GENERATOR

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Morning Brief contract
- Morning Brief planner
- Verification Agent
- Google Adapter foundation
- Librarian
- LLM Wiki
- Knowledge Compounding
- PRODUCT.md
- DESIGN.md

Goal:

Create the Morning Brief generator.

The generator turns a Morning Brief plan into structured brief content.

No delivery.

No scheduling.

No live Gmail/Calendar calls.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- schedule brief delivery
- send notifications
- call Gmail
- call Calendar
- call Drive
- call live models unless injected mock runtime is used in tests
- add background jobs
- mutate vault contents
- write Obsidian notes

# REQUIRED WORK

1. Generator function

Implement:

generateMorningBrief()

Input:

- MorningBriefRequest
- MorningBriefPlan
- injected optional generator runtime/provider

Output:

- structured brief sections
- title
- date
- priority summary
- caveats
- advisory metadata
- delivery_attempted: false
- write_attempted: false

2. Mock runtime support

Support deterministic mock generation for tests.

Fail closed if a live generator is requested but unavailable.

3. Section generation

Generate structured content for:

- today_overview
- calendar_summary
- inbox_summary
- project_focus
- knowledge_updates
- risk_alerts
- recommended_actions

4. Verification/Librarian integration

Preserve:

- verification caveats
- risk flags
- Librarian knowledge metadata
- source references

5. Governance tests

Prove:

- no scheduling
- no notifications
- no Gmail/Calendar/Drive access
- no vault writes
- no raw bodies
- no live model dependency in CI
- mock generation is deterministic

# REQUIRED COMMANDS

npm test -- src/lib/morning-brief
npx tsc --noEmit
npm test
git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Generator implemented
4. Mock runtime behavior
5. Section generation behavior
6. Verification/Librarian integration
7. Governance checks
8. Tests added/updated
9. Commands executed
10. Expansion Era verdict
11. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21C.3: add morning brief generator
