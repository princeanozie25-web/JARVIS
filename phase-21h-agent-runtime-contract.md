# ============================================================

# PHASE 21H.1

# AGENT RUNTIME CONTRACT

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Phase 17 scheduler
- Phase 18 approval lifecycle
- Phase 21H Autonomous Agents Suite
- Verification Agent
- Morning Brief
- Librarian
- PRODUCT.md
- DESIGN.md

Goal:

Create the common runtime contract for all Expansion Era agents.

This runtime will be shared by:

- Life Coach
- Build Monitor
- Research Agent
- CV Maintenance
- Application Tracker
- Deadline Agent
- Cost Monitor
- Health Agent

Contract only.

# ============================================================

# SINGLE AGENT ONLY

# ============================================================

Do not spawn subagents.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

DO NOT:

- execute actions
- create agent schedules
- call models
- call Gmail
- call Calendar
- call Drive
- write Obsidian
- bypass approval lifecycle
- add background daemons

Contract only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Agent runtime contract

Define:

AgentRuntimeContract

Including:

- id
- version
- owner
- schedule_class
- declared_sources
- output_type
- risk_class
- requires_verification
- requires_approval

2. Agent output model

Support:

- digest
- report
- recommendation
- draft
- alert

3. Agent authority model

Support:

- observe_only
- suggest_only
- proposal_only

No execution authority.

4. Declared source model

Define allowed source declarations for:

- obsidian
- google_gmail
- google_calendar
- google_drive
- github
- telemetry
- model_calls
- project_registry
- manual_input

Agents may read only declared sources.

5. Inbox integration

All agent outputs must target:

Suggestion Inbox

No direct execution.

6. Approval integration

If output implies action, it must become:

proposal_only

and require Phase 18 approval lifecycle.

7. Verification integration

Support optional verification pass metadata.

8. Governance tests

Prove:

- no execution authority
- no scheduling implementation
- no writes
- no network
- no model calls
- no cross-agent reads
- no output bypasses Suggestion Inbox
- proposal outputs require approval metadata

# ============================================================

# REQUIRED COMMANDS

# ============================================================

npm test

npx tsc --noEmit

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Files changed

3. Runtime contract

4. Output model

5. Authority model

6. Declared source model

7. Inbox integration

8. Approval integration

9. Verification integration

10. Governance checks

11. Tests added/updated

12. Commands executed

13. Expansion Era verdict

14. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21H.1: add agent runtime contract
