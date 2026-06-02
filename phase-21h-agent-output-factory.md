# ============================================================

# PHASE 21H.5

# AGENT OUTPUT FACTORY

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Agent Runtime Contract
- Agent Registry
- Agent Planner
- Agent Dry-Run Executor
- Suggestion Inbox model
- Verification Agent
- Morning Brief
- Librarian

Goal:

Create a generic Agent Output Factory.

This factory turns a planned dry-run envelope into a typed, metadata-only agent output preview.

No real source reads.

No model calls.

No inbox writes.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- execute real agents
- schedule agents
- call models
- call Gmail/Calendar/Drive/GitHub
- read Obsidian
- write Obsidian
- create real Suggestion Inbox entries
- bypass approval lifecycle
- add background jobs

# REQUIRED WORK

1. Output factory

Implement:

createAgentOutputPreview()

Input:

- AgentDryRunEnvelope
- registry entry
- optional fixture metadata

Output:

- output_id
- agent_id
- output_type
- title
- summary
- priority
- suggested_inbox_target
- source_refs
- verification_metadata
- approval_metadata
- preview_only: true
- inbox_write_attempted: false
- execution_attempted: false

2. Output types

Support:

- digest
- report
- recommendation
- draft
- alert

3. Agent-specific metadata

Support minimal metadata for:

- life_coach
- build_monitor
- research_agent
- cv_maintenance
- application_tracker
- deadline_agent
- cost_monitor
- health_agent

No real agent logic yet.

4. Suggestion Inbox compatibility

Output previews must be shape-compatible with future Suggestion Inbox entries.

But do not write them.

5. Governance tests

Prove:

- no source reads
- no model calls
- no inbox writes
- no scheduling
- no network
- no execution authority
- proposal outputs carry approval metadata

# REQUIRED COMMANDS

npm test -- src/lib/agent-runtime

npx tsc --noEmit

npm test

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Output factory implemented
4. Output type behavior
5. Agent-specific metadata
6. Suggestion Inbox compatibility
7. Governance checks
8. Tests added/updated
9. Commands executed
10. Expansion Era verdict
11. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21H.5: add agent output factory
