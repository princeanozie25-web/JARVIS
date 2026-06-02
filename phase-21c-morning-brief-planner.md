# ============================================================

# PHASE 21C.2

# MORNING BRIEF PLANNER

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Morning Brief contract
- Verification Agent foundation
- Google Adapter foundation
- Librarian
- LLM Wiki
- Knowledge Compounding
- PRODUCT.md
- DESIGN.md

Goal:

Create the Morning Brief planner.

The planner decides:

- what belongs in the brief
- priority
- ordering
- relevance

No generation.

No delivery.

No scheduling.

# ============================================================

# SINGLE AGENT ONLY

# ============================================================

Do not spawn subagents.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

DO NOT:

- generate brief prose
- schedule brief delivery
- send notifications
- call Gmail
- call Calendar
- call models
- add background jobs
- add timers
- add schedulers

Planner only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Planner function

Implement:

planMorningBrief()

Input:

- MorningBriefRequest
- calendar metadata
- email metadata
- project metadata
- knowledge metadata
- verification metadata

Output:

- section plans
- priorities
- ordering
- inclusion decisions
- omission decisions
- warnings
- write_attempted: false

2. Inclusion model

Support:

- include
- defer
- suppress

for all candidate items.

3. Priority model

Use:

- critical
- high
- medium
- low

Support deterministic ordering.

4. Section planning

Plan content for:

- today_overview
- calendar_summary
- inbox_summary
- project_focus
- knowledge_updates
- risk_alerts
- recommended_actions

5. Verification integration

High-risk items should influence:

- priority
- visibility
- warnings

6. Librarian integration

Knowledge updates should be represented using metadata only.

No raw note bodies.

7. Governance tests

Prove:

- no scheduling
- no delivery
- no model calls
- no Gmail access
- no Calendar access
- no notifications
- no raw bodies

# ============================================================

# REQUIRED COMMANDS

# ============================================================

npm test -- src/lib/morning-brief

npx tsc --noEmit

npm test

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Files changed

3. Planner implemented

4. Inclusion behavior

5. Priority behavior

6. Section planning behavior

7. Verification integration

8. Librarian integration

9. Governance checks

10. Tests added/updated

11. Commands executed

12. Expansion Era verdict

13. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21C.2: add morning brief planner
