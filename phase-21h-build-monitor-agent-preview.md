# ============================================================

# PHASE 21H.7

# BUILD MONITOR AGENT PREVIEW

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Agent Runtime Contract
- Agent Registry
- Agent Planner
- Agent Dry-Run Executor
- Agent Output Factory
- GitNexus
- Verification Agent
- PRODUCT.md
- DESIGN.md

Goal:

Create the Build Monitor Agent preview.

The Build Monitor should produce a metadata-only build progress digest from fixture Git/test metadata.

No live GitHub calls.

No model calls.

No Suggestion Inbox writes.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- call GitHub
- call models
- schedule the agent
- write Obsidian
- create real Suggestion Inbox entries
- mutate project files
- create commits
- push to git
- add background jobs
- read raw diffs/full logs

# REQUIRED WORK

1. Build Monitor preview function

Implement:

previewBuildMonitorAgent()

Input:

- agent runtime plan/dry-run envelope
- safe fixture build metadata
- optional GitNexus metadata
- optional verification metadata

Output:

- build progress digest preview
- phase/slice summary
- test status summary
- risk/caveat summary
- portfolio/linkedin-worthy highlights
- suggested_inbox_target
- preview_only: true
- execution_attempted: false
- write_attempted: false
- inbox_write_attempted: false

2. Build metadata model

Support:

- changed_files_count
- tests_passed
- tests_failed
- test_files_count
- latest_commit_sha
- current_phase_or_slice
- notable_changes
- risks
- gitnexus_refs

3. Highlight model

Each highlight should include:

- title
- reason
- evidence_refs
- priority
- suggested_use: portfolio | linkedin | readme | none

4. Integration

Use existing agent runtime registry/planner/dry-run/output-factory path.

Do not bypass generic runtime foundation.

5. Governance tests

Prove:

- no GitHub calls
- no raw diffs/full logs
- no model calls
- no inbox writes
- no scheduling
- no writes
- no git commit/push
- output is preview-only

# REQUIRED COMMANDS

npm test -- src/lib/agent-runtime

npx tsc --noEmit

npm test

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Build Monitor preview implemented
4. Build metadata model
5. Highlight behavior
6. Runtime integration
7. Governance checks
8. Tests added/updated
9. Commands executed
10. Expansion Era verdict
11. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21H.7: add Build Monitor agent preview
