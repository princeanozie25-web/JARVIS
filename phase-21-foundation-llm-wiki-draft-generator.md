# ============================================================

# EXPANSION ERA FOUNDATION

# LLM WIKI DRAFT GENERATOR

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- LLM Wiki contracts
- LLM Wiki planner
- LLM Wiki generation planner
- Knowledge Compounding detector
- Librarian planner
- Vault Write Gateway
- DeepSeek provider runtime

Goal:

Implement the first controlled wiki draft generation path.

This slice may generate markdown drafts.

This slice must NOT write them.

# ============================================================

# SINGLE AGENT ONLY

# ============================================================

Do not spawn subagents.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

DO NOT:

- write Obsidian notes
- execute Vault Write Gateway proposals
- bypass Librarian
- bypass approval
- create files
- modify files
- run background jobs
- add schedulers
- add watchers

Draft generation only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Draft generation function

Implement:

generateLlmWikiDraft()

Input:

- WikiPageDraftPlan
- supporting source metadata
- source snippets
- generation scope

Output:

- markdown draft
- confidence
- rationale
- source attribution block
- write_attempted: false

2. DeepSeek integration

Use:

deepseek-v4-flash

through existing provider infrastructure.

Must remain:

- disabled by default
- fail closed if unavailable
- fail closed if provider disabled

3. Source restrictions

Draft generation may use:

- source snippets
- source metadata
- source hashes
- source ids

Draft generation may NOT:

- invent unsupported claims
- generate without sources
- remove attribution

4. Supported page types

Generate drafts for:

- hub
- concept
- system
- project
- source
- decision
- comparison
- synthesis

5. Output quality controls

Include:

- source coverage score
- attribution section
- unsupported synthesis warning
- confidence rating

6. Librarian integration

Draft output becomes:

llm_wiki source envelope

No promotion.

No persistence.

7. Gateway integration

Produce optional:

VaultWriteProposal draft

No execution.

8. Governance tests

Prove:

- no vault writes
- no execution
- provider disabled fails closed
- unsupported synthesis flagged
- attribution required
- missing sources rejected

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

3. Draft generator implemented

4. DeepSeek integration behavior

5. Attribution behavior

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

Phase 21 foundation: add LLM Wiki draft generator
