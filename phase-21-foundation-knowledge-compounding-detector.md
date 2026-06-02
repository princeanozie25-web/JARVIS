# ============================================================
# EXPANSION ERA FOUNDATION
# KNOWLEDGE COMPOUNDING DRY-RUN DETECTOR
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Knowledge Compounding contract
- LLM Wiki contract + planner
- Librarian contract + planner
- Real Obsidian integration
- Vault taxonomy

Goal:

Implement the first real Knowledge Compounding detection layer.

This detector should identify candidate opportunities for wiki improvement.

It must not:

- generate pages
- call LLMs
- write notes
- execute proposals

Detection only.

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
- mutate the vault
- implement autonomous agents
- add schedulers
- add watchers
- add background jobs

Dry-run detection only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Detector function

Implement something like:

detectKnowledgeCompoundingCandidates()

Input:

- wiki metadata snapshot
- librarian metadata snapshot
- source metadata snapshot

Output:

- candidate list
- supporting evidence
- confidence
- proposed action
- write_attempted: false

2. Candidate detection

Implement detection for:

- missing_hub
- sparse_hub
- fragmented_concept
- missing_backlinks
- weak_source_coverage
- duplicate_concept
- stale_wiki_page
- underlinked_system

3. Evidence model

Each candidate must explain:

- why it was detected
- supporting pages
- supporting sources
- relevant counts/metrics

4. Proposal generation

Generate:

KnowledgeCompoundingProposal

from detected candidates.

No execution.

5. LLM Wiki integration

Map detections into:

- create_hub
- update_hub
- merge_pages
- create_backlinks
- refresh_stale_page

6. Governance tests

Prove:

- no LLM calls
- no vault writes
- no execution authority
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

3. Detector implemented

4. Candidate detection behavior

5. Evidence model

6. Proposal generation behavior

7. LLM Wiki integration

8. Governance checks

9. Tests added/updated

10. Commands executed

11. Expansion Era verdict

12. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add knowledge compounding detector
