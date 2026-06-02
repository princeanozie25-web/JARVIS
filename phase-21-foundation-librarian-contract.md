# ============================================================
# EXPANSION ERA FOUNDATION
# LIBRARIAN CONTRACT LAYER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- docs/architecture/phase-21-vault-taxonomy.md
- docs/architecture/phase-21-vault-write-gateway.md
- docs/architecture/phase-21-vault-write-execution.md
- Real Obsidian integration (verified)
- Future LLM Wiki
- Future Knowledge Compounding
- Future GitNexus
- Future Autonomous Agents

Expansion Era rule:

This is a FOUNDATION slice.

Do not implement Librarian execution.

Do not implement Knowledge Compounding.

Do not implement agent writes.

Create the governance brain that future systems must obey.

# ============================================================
# GOAL
# ============================================================

Define the Librarian contract.

Librarian is responsible for:

- ingestion
- classification
- routing
- deduplication
- source attribution
- promotion decisions

Librarian is NOT:

- a writer
- a scheduler
- an autonomous agent
- a vault mutation surface

# ============================================================
# SINGLE AGENT ONLY
# ============================================================

Do not spawn subagents.

Use a single implementation/review pass.

Codex quota preservation is required.

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- write into Obsidian
- execute vault writes
- create notes
- modify notes
- call Vault Write Execution
- implement LLM Wiki
- implement GitNexus
- implement Knowledge Compounding
- implement agent execution
- add watchers
- add schedulers
- add background jobs

Contract layer only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Librarian ingestion contract

Define:

- source types
- source identifiers
- ingestion envelope

Support future sources:

- user note
- agent output
- GitNexus
- LLM Wiki
- imported document
- external research

2. Classification model

Define:

- transient
- candidate
- durable
- canonical

and rules governing movement between them.

3. Deduplication model

Define:

- content hash strategy
- duplicate detection strategy
- near-duplicate strategy

No embedding execution required.

4. Routing model

Define how Librarian chooses:

- inbox
- wiki
- project
- research
- career
- archive

using existing taxonomy.

5. Promotion model

Define:

- when something may become durable
- when human approval is required
- when promotion is forbidden

6. Source attribution

Define provenance requirements.

Every durable object must be traceable.

7. Governance tests

Add tests proving:

- no write authority
- no execution authority
- no scheduler
- no routing bypass
- durable promotion requires approval state

# ============================================================
# REQUIRED COMMANDS
# ============================================================

npm test -- src/lib/obsidian

npx tsc --noEmit

npm test

git diff --check

# ============================================================
# FINAL RESPONSE FORMAT
# ============================================================

1. Effort level

2. Files changed

3. Librarian ingestion contract

4. Classification model

5. Deduplication model

6. Routing model

7. Promotion model

8. Provenance model

9. Governance checks

10. Tests added/updated

11. Commands executed with results

12. Expansion Era verdict

13. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add librarian contract layer
