# ============================================================

# PHASE 21H.3

# AGENT PLANNER

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Agent Runtime Contract
- Agent Registry
- Phase 17 scheduler
- Phase 18 approval lifecycle
- Verification Agent
- Morning Brief
- Librarian

Goal:

Create the generic Agent Planner.

The planner decides whether an agent is eligible to run, what metadata sources it may read, what output type it should produce, and whether verification/approval metadata is required.

No execution.

No scheduling.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- execute agents
- schedule agents
- call models
- call Gmail/Calendar/Drive/GitHub
- write Obsidian
- create Suggestion Inbox entries
- bypass approval lifecycle
- add background jobs

# REQUIRED WORK

1. Planner function

Implement:

planAgentRun()

Input:

- agent id
- registry entry
- run context
- available metadata sources
- optional trigger metadata

Output:

- eligibility
- declared sources to read
- output type
- authority class
- verification requirement
- approval requirement
- warnings/reasons
- execution_attempted: false
- write_attempted: false

2. Eligibility model

Support:

- eligible
- ineligible
- skipped

3. Run context

Include:

- manual
- scheduled
- event_driven

but do not implement actual scheduling.

4. Source filtering

Planner must only allow sources declared by the registry.

5. Output planning

Planner must only allow declared output types.

6. Governance tests

Prove:

- undeclared source is rejected
- undeclared output is rejected
- proposal outputs require approval
- critical agents require verification
- no execution/scheduling/model/network/write imports

# REQUIRED COMMANDS

npm test -- src/lib/agent-runtime

npx tsc --noEmit

npm test

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Planner implemented
4. Eligibility behavior
5. Run context behavior
6. Source filtering
7. Output planning
8. Verification/approval behavior
9. Governance checks
10. Tests added/updated
11. Commands executed
12. Expansion Era verdict
13. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21H.3: add agent planner
