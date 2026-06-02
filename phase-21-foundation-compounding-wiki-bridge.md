# ============================================================
# EXPANSION ERA FOUNDATION
# KNOWLEDGE COMPOUNDING → LLM WIKI BRIDGE
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Knowledge Compounding contract
- Knowledge Compounding detector
- LLM Wiki contract
- LLM Wiki dry-run planner
- Librarian contract
- Vault Write Gateway

Goal:

Bridge Knowledge Compounding detections into LLM Wiki planning.

The detector should identify opportunities.

The bridge should determine what wiki maintenance
should be proposed as a result.

This slice must not:

- call LLMs
- write notes
- execute proposals

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

Bridge logic only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Bridge function

Implement something similar to:

planKnowledgeCompoundingWikiBridge()

Input:

- Knowledge Compounding candidates
- LLM Wiki metadata snapshot
- optional routing preferences

Output:

- wiki maintenance plans
- planner recommendations
- proposal drafts
- lint findings
- reasons
- warnings
- write_attempted: false

2. Candidate mapping

Map:

missing_hub
→ create_hub

sparse_hub
→ update_hub

fragmented_concept
→ merge_pages

missing_backlinks
→ create_backlinks

weak_source_coverage
→ update_hub

duplicate_concept
→ merge_pages

stale_wiki_page
→ refresh_stale_page

underlinked_system
→ create_backlinks

3. LLM Wiki planner integration

Reuse existing LLM Wiki planner structures.

Do not duplicate planner logic.

4. Librarian integration

Produce Librarian envelope drafts.

No execution.

5. Gateway integration

Produce Vault Write Gateway proposal drafts.

No execution.

6. Governance tests

Prove:

- no LLM calls
- no writes
- no execution
- no network
- no scheduler
- no watcher
- no background jobs

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

3. Bridge implemented

4. Candidate mapping behavior

5. LLM Wiki integration

6. Librarian integration

7. Gateway integration

8. Governance checks

9. Tests added/updated

10. Commands executed

11. Expansion Era verdict

12. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add compounding wiki bridge
