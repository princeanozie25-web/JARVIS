# ============================================================

# PHASE 21H.6

# LIFE COACH AGENT PREVIEW

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Agent Runtime Contract
- Agent Registry
- Agent Planner
- Agent Dry-Run Executor
- Agent Output Factory
- Librarian
- Obsidian integration
- Morning Brief
- PRODUCT.md
- DESIGN.md

Goal:

Create the first real agent preview: Life Coach Agent.

The Life Coach Agent should produce a safe weekly progress digest preview from metadata/fixture inputs.

No scheduling.

No live model calls.

No vault writes.

No Suggestion Inbox writes.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- schedule the agent
- call models
- call Gmail/Calendar/Drive/GitHub
- write Obsidian
- create real Suggestion Inbox entries
- mutate project registry
- add background jobs
- read raw private note bodies

# REQUIRED WORK

1. Life Coach preview function

Implement:

previewLifeCoachAgent()

Input:

- agent runtime plan/dry-run envelope
- safe fixture/user progress metadata
- optional Librarian metadata
- optional Morning Brief metadata

Output:

- weekly progress digest preview
- 3 focus items
- progress categories
- source refs
- caveats
- suggested_inbox_target
- preview_only: true
- execution_attempted: false
- write_attempted: false
- inbox_write_attempted: false

2. Progress categories

Support:

- learning
- career
- fitness
- jarvis_build
- admin_life

3. Focus item model

Each focus item should include:

- title
- reason
- priority
- category
- optional source refs
- actionability: read_only | suggestion | proposal_required

4. Integration

Use the existing agent runtime registry/planner/dry-run/output-factory path.

Do not bypass the generic runtime foundation.

5. Governance tests

Prove:

- no source reads
- no raw note bodies
- no model calls
- no inbox writes
- no scheduling
- no writes
- no network
- no approval bypass
- output is preview-only

# REQUIRED COMMANDS

npm test -- src/lib/agent-runtime

npx tsc --noEmit

npm test

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Life Coach preview implemented
4. Progress categories
5. Focus item behavior
6. Runtime integration
7. Governance checks
8. Tests added/updated
9. Commands executed
10. Expansion Era verdict
11. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21H.6: add Life Coach agent preview
