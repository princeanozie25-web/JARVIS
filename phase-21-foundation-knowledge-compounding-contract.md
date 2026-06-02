# ============================================================
# EXPANSION ERA FOUNDATION
# KNOWLEDGE COMPOUNDING CONTRACT LAYER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Karpathy LLM Wiki pattern
- Librarian contract + planner
- LLM Wiki contract + planner
- Vault taxonomy
- GitNexus contract

Goal:

Define the Knowledge Compounding layer.

Knowledge Compounding is responsible for discovering:

- missing hub pages
- fragmented concepts
- sparse concepts
- under-linked knowledge

and proposing wiki improvements.

It is NOT responsible for:

- writing notes
- approving notes
- bypassing Librarian
- bypassing Vault Write Gateway

# ============================================================
# SINGLE AGENT ONLY
# ============================================================

Do not spawn subagents.

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- call LLMs
- generate wiki pages
- write Obsidian notes
- execute proposals
- implement agents
- add schedulers
- add watchers
- add background jobs

Contracts only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Compounding candidate model

Define candidate types:

- missing_hub
- sparse_hub
- fragmented_concept
- missing_backlinks
- weak_source_coverage
- duplicate_concept
- stale_wiki_page
- underlinked_system

2. Detection contracts

Define metadata inputs required to identify candidates.

Examples:

- references count
- backlinks
- page density
- source count
- update age

No execution.

3. Compounding proposal contract

Define:

KnowledgeCompoundingProposal

Include:

- proposal id
- candidate type
- affected pages
- supporting sources
- confidence
- rationale
- proposed action
- approval requirement

4. Librarian integration

Compounding proposals enter Librarian as:

source_type: knowledge_compounding

5. LLM Wiki integration

Compounding may propose:

- create hub
- update hub
- merge pages
- create backlinks
- refresh stale page

But may not execute.

6. Governance tests

Prove:

- no write authority
- no execution authority
- no scheduler
- no network
- no LLM calls
- no Obsidian mutation

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

3. Candidate model

4. Detection model

5. Proposal model

6. Librarian integration

7. LLM Wiki integration

8. Governance checks

9. Tests added/updated

10. Commands executed

11. Expansion Era verdict

12. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add knowledge compounding contract
