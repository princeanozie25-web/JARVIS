# ============================================================

# PHASE 21H.4

# AGENT DRY-RUN EXECUTOR

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Agent Runtime Contract
- Agent Registry
- Agent Planner
- Phase 17 scheduler
- Phase 18 approval lifecycle
- Verification Agent
- Morning Brief
- Librarian

Goal:

Create the generic Agent Dry-Run Executor.

This executor should turn an eligible agent plan into a dry-run envelope.

It must not run real agents yet.

No source reads.

No model calls.

No Suggestion Inbox writes.

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
- create Suggestion Inbox entries
- bypass approval lifecycle
- add background jobs

# REQUIRED WORK

1. Dry-run executor

Implement:

executeAgentDryRun()

Input:

- AgentRunPlan
- registry entry
- optional dry-run fixture metadata

Output:

- dry_run_id
- agent_id
- eligibility
- selected_sources
- planned_output_type
- authority_class
- verification_required
- approval_required
- suggested_inbox_target
- execution_attempted: false
- write_attempted: false
- source_reads_attempted: false

2. Dry-run statuses

Support:

- planned
- skipped
- rejected

3. Metadata-only output

No raw source body.
No model prompt.
No generated digest body.

4. Verification/approval metadata

Carry planner metadata forward.

5. Governance tests

Prove:

- no source reads
- no model calls
- no inbox writes
- no scheduling
- no network
- no execution authority
- rejected plans cannot become planned dry-runs

# REQUIRED COMMANDS

npm test -- src/lib/agent-runtime

npx tsc --noEmit

npm test

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Dry-run executor implemented
4. Status behavior
5. Metadata-only behavior
6. Verification/approval metadata
7. Governance checks
8. Tests added/updated
9. Commands executed
10. Expansion Era verdict
11. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21H.4: add agent dry-run executor
