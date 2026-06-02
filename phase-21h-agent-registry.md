# ============================================================

# PHASE 21H.2

# AGENT REGISTRY

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Agent Runtime Contract
- Phase 21H Autonomous Agents Suite
- Phase 17 scheduler
- Phase 18 approval lifecycle
- Verification Agent
- Morning Brief
- Librarian

Goal:

Create the Expansion Era Agent Registry.

The registry declares which agents exist, what sources they may read, what outputs they may produce, and what authority class they have.

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
- create suggestions
- bypass approval lifecycle
- add background jobs

# REQUIRED WORK

1. Agent registry

Define registry entries for:

- life_coach
- build_monitor
- research_agent
- cv_maintenance
- application_tracker
- deadline_agent
- cost_monitor
- health_agent

2. Source declarations

Each agent must declare only its allowed sources.

3. Output declarations

Each agent must declare allowed output types.

4. Authority class

Each agent must be one of:

- observe_only
- suggest_only
- proposal_only

No execution authority.

5. Verification requirements

Critical/proposal agents should require verification metadata.

6. Registry validation

Reject:

- unknown agents
- undeclared sources
- execution authority
- direct output destinations other than Suggestion Inbox
- cross-agent reads

7. Tests

Prove:

- all Phase 21H agents are registered
- no agent has execution authority
- every output targets Suggestion Inbox
- proposal agents require approval lifecycle
- no cross-agent source exists

# REQUIRED COMMANDS

npm test -- src/lib/agent-runtime

npx tsc --noEmit

npm test

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Registry implemented
4. Agents registered
5. Source declarations
6. Output declarations
7. Authority classes
8. Verification/approval behavior
9. Governance checks
10. Tests added/updated
11. Commands executed
12. Expansion Era verdict
13. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21H.2: add agent registry
