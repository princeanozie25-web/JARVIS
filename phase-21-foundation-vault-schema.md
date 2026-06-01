# ============================================================
# EXPANSION ERA FOUNDATION
# VAULT TAXONOMY + FRONTMATTER SCHEMA
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- phase-21-foundation-vault-architecture.md
- P0.2 Obsidian real integration
- Future 21G Knowledge Compounding
- Future GitNexus
- Future Librarian Agent

Goal:

Promote the approved vault architecture into repo-owned contracts and docs.

This is still a foundation slice.

Do not write to the real vault.

# ============================================================
# REQUIRED WORK
# ============================================================

Create documented contracts for:

1. Vault folder taxonomy

Use the approved structure:

00-meta/
01-inbox/
10-wiki/
20-projects/
30-research/
40-learning/
50-career/
60-agents/
70-references/
80-reviews/
90-archive/
_attachments/

2. LLM Wiki taxonomy

10-wiki/
  hubs/
  concepts/
  systems/
  people/
  projects/
  sources/
  decisions/

3. Frontmatter schema

Implement a TypeScript schema for the approved frontmatter standard.

4. Note type registry

Define valid note_type values, including at least:

- hub
- concept
- system
- person
- project
- source
- decision
- agent_run
- git_commit
- git_slice
- review
- inbox_item

5. Vault routing rules

Define a pure function that maps note metadata to the intended folder.

No file writes.

6. Governance

Add guards proving:

- agents cannot directly write durable notes
- durable notes require approval status
- transient agent outputs route to inbox or agent runs
- GitNexus notes route under 20-projects/<project>/gitnexus/
- markdown remains canonical; SQLite/vector/graph indexes are derived

# ============================================================
# SUBAGENTS
# ============================================================

Use parallel subagents where safe:

- Schema Agent
- Taxonomy Agent
- Routing Agent
- Governance Agent
- Test Agent
- Reviewer Agent

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- write into Obsidian vault
- create real notes
- add background jobs
- implement Librarian
- implement GitNexus
- implement Knowledge Compounding

Contracts, schemas, docs, and tests only.

# ============================================================
# REQUIRED COMMANDS
# ============================================================

npm test

npx tsc --noEmit

git diff --check

# ============================================================
# FINAL RESPONSE FORMAT
# ============================================================

1. Effort level

2. Agents/subagents used

3. Files changed

4. Vault taxonomy implemented

5. Frontmatter schema implemented

6. Routing rules implemented

7. Governance checks

8. Tests added/updated

9. Commands executed with results

10. Expansion Era verdict

11. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add vault taxonomy contracts
