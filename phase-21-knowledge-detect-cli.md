# ============================================================

# PHASE 21 - KNOWLEDGE COMPOUNDING DETECTION CLI

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Real Obsidian integration
- Knowledge Compounding detector
- Compounding -> LLM Wiki bridge
- Librarian planner
- Vault Write Gateway

Goal:

Add the first real user-facing dry-run CLI for Knowledge Compounding.

The command should scan the current Obsidian metadata/index and print candidate wiki improvements.

This is detection-only.

# ============================================================

# SINGLE AGENT ONLY

# ============================================================

Do not spawn subagents.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

DO NOT:

- call DeepSeek
- call Ollama
- call any model
- write Obsidian notes
- execute Vault Write Gateway proposals
- mutate vault contents
- add schedulers
- add watchers
- add background jobs
- auto-create wiki pages

# ============================================================

# REQUIRED WORK

# ============================================================

1. Add CLI command

Add a script like:

npm run knowledge:detect

2. Real metadata input

Use the existing Obsidian pull-only indexer.

The command should:

- read OBSIDIAN_VAULT_PATH
- index metadata
- derive a wiki/source metadata snapshot
- run detectKnowledgeCompoundingCandidatesFromSnapshots()
- optionally run planKnowledgeCompoundingWikiBridge()

3. Output

Print metadata only:

- total notes scanned
- candidate count
- candidate type
- confidence
- proposed action
- affected pages
- supporting source ids/paths
- warnings
- write_attempted: false
- vault_mutated: false

Do not print raw note bodies.

4. Safe empty-vault behavior

If the vault has too few notes, the command should exit 0 with:

- status: ok
- candidate_count: 0
- reason: insufficient_knowledge_graph

5. Tests

Add tests proving:

- command logic handles empty/tiny vault
- command logic detects candidates from fixture metadata
- no raw body output
- no writes
- no model calls
- no network/scheduler/watcher

# ============================================================

# REQUIRED COMMANDS

# ============================================================

npm test -- src/lib/obsidian

npx tsc --noEmit

npm test

npm run knowledge:detect

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Files changed

3. CLI command added

4. Real vault detection behavior

5. Output format

6. Safe empty/tiny vault behavior

7. Governance checks

8. Tests added/updated

9. Commands executed with results

10. Expansion Era verdict

11. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21: add knowledge compounding detection CLI
