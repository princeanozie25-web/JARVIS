# ============================================================

# PHASE 21

# LLM WIKI DRAFT CLI

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Knowledge Compounding detector
- Compounding -> Wiki bridge
- LLM Wiki planner
- LLM Wiki generation planner
- LLM Wiki draft generator
- Librarian planner
- Vault Write Gateway

Goal:

Create the first end-to-end knowledge drafting CLI.

The CLI should:

detect
-> plan
-> draft

and stop there.

No writes.

No execution.

No persistence.

This is a preview surface.

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
- call write execution
- mutate the vault
- create files
- add schedulers
- add watchers
- add background jobs

Draft preview only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Add CLI

Add:

npm run wiki:draft

2. End-to-end flow

Use:

knowledge detector
-> compounding bridge
-> generation planner
-> draft generator

3. Output

Display:

- candidate type
- confidence
- proposed action
- target page
- source coverage
- attribution status
- draft preview

Do not write.

4. Empty vault behavior

If insufficient graph:

status: ok
reason: insufficient_knowledge_graph

exit 0

5. Draft preview

Allow preview of:

- hub
- concept
- system
- project
- decision
- source

Markdown preview only.

6. Governance checks

Prove:

- no writes
- no execution
- no gateway execution
- no network beyond configured model path
- no schedulers/watchers

# ============================================================

# REQUIRED COMMANDS

# ============================================================

npm test -- src/lib/obsidian

npx tsc --noEmit

npm test

npm run wiki:draft

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Files changed

3. CLI added

4. End-to-end flow result

5. Preview behavior

6. Empty vault behavior

7. Governance checks

8. Tests added/updated

9. Commands executed

10. Expansion Era verdict

11. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21: add LLM Wiki draft CLI
