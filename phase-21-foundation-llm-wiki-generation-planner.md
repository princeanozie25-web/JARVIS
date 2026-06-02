# ============================================================

# EXPANSION ERA FOUNDATION

# LLM WIKI GENERATION PLANNER

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Karpathy LLM Wiki pattern
- Knowledge Compounding detector
- Knowledge Compounding -> Wiki bridge
- LLM Wiki planner
- Librarian planner
- Vault Write Gateway

Goal:

Create the final planning layer before actual LLM-powered wiki generation.

This planner should take:

candidate
-> wiki maintenance plan
-> page draft plan

without generating text.

No LLM calls.

No vault writes.

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
- generate wiki text
- write notes
- execute proposals
- mutate the vault
- add schedulers
- add watchers
- add background jobs

Planning only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Generation planning function

Implement:

planLlmWikiGeneration()

Input:

- KnowledgeCompoundingProposal
- wiki metadata snapshot
- source metadata snapshot

Output:

- page plan
- required source set
- page type
- target location
- generation scope
- confidence
- approval requirement
- write_attempted: false

2. Generation scope model

Define:

- create_new_page
- update_existing_page
- merge_pages
- refresh_page
- create_hub
- create_backlinks

3. Source coverage analysis

Determine:

- sufficient source coverage
- weak source coverage
- unsupported synthesis
- conflicting sources

4. Draft planning

Produce:

WikiPageDraftPlan

No text generation.

Only structure.

5. Librarian integration

Planner outputs must be Librarian-compatible.

6. Gateway integration

Planner outputs must be Vault Write Gateway compatible.

No execution.

7. Governance tests

Prove:

- no LLM calls
- no vault writes
- no execution authority
- no network
- no scheduler
- no watcher
- no background jobs
- unsupported synthesis blocks generation planning

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

3. Generation planner implemented

4. Scope model

5. Source coverage behavior

6. Draft planning behavior

7. Librarian integration

8. Gateway integration

9. Governance checks

10. Tests added/updated

11. Commands executed

12. Expansion Era verdict

13. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21 foundation: add LLM Wiki generation planner
