# ============================================================

# PHASE 21C.1

# MORNING BRIEF CONTRACT

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Verification Agent
- Google Adapter foundation
- Librarian
- LLM Wiki
- Knowledge Compounding

Goal:

Define the Morning Brief contract.

Morning Brief is a synthesized view of:

- calendar
- email
- projects
- knowledge
- reminders
- priorities

This slice is contract-only.

No generation.

No scheduling.

No delivery.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- generate briefs
- schedule briefs
- send notifications
- read Gmail
- read Calendar
- call models
- add background jobs

Contract only.

# REQUIRED WORK

1. Morning Brief request contract

Define inputs for:

- date
- user context
- calendar metadata
- email metadata
- project metadata
- knowledge metadata

2. Morning Brief section model

Support:

- today_overview
- calendar_summary
- inbox_summary
- project_focus
- knowledge_updates
- risk_alerts
- recommended_actions

3. Priority model

Support:

- critical
- high
- medium
- low

4. Verification integration

Define how verification metadata enters the brief.

5. Librarian integration

Define how knowledge updates enter the brief.

6. Governance tests

Prove:

- no scheduling
- no notifications
- no model calls
- no Gmail/Calendar access
- no background jobs

# REQUIRED COMMANDS

npm test

npx tsc --noEmit

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level

2. Files changed

3. Request contract

4. Section model

5. Priority model

6. Verification integration

7. Librarian integration

8. Governance checks

9. Tests added/updated

10. Commands executed

11. Expansion Era verdict

12. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21C.1: add morning brief contract
