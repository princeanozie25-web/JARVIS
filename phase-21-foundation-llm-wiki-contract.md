# ============================================================
# EXPANSION ERA FOUNDATION
# LLM WIKI CONTRACT LAYER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Karpathy LLM Wiki pattern:
  https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Real Obsidian integration
- Librarian contract + dry-run planner
- Vault Write Gateway
- GitNexus contract

Goal:

Define the JARVIS LLM Wiki contract.

The LLM Wiki is the durable Markdown knowledge layer built from immutable raw sources,
approved syntheses, GitNexus artifacts, and future agent outputs.

This is a foundation slice.

Do not generate wiki pages yet.
Do not write to the vault.

# ============================================================
# SINGLE AGENT ONLY
# ============================================================

Do not spawn subagents.

Preserve Codex quota.

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- write Obsidian notes
- execute Vault Write Gateway proposals
- implement Knowledge Compounding
- implement web/source ingestion
- implement autonomous agents
- mutate raw sources
- add schedulers
- add watchers
- add background jobs

Contract layer only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. LLM Wiki source model

Define immutable raw/source inputs:

- user_note
- imported_document
- external_research
- gitnexus
- agent_output

Raw sources are source-of-truth.
Wiki pages are derived.

2. Wiki page types

Define contracts for:

- hub page
- concept page
- system page
- person page
- project page
- source page
- decision page
- comparison page
- synthesis page

3. Special files

Define:

- 10-wiki/index.md
- 10-wiki/log.md

index.md is content-oriented.
log.md is chronological and append-only in future execution slices.

No writes yet.

4. Maintenance operations

Define operation contracts for:

- ingest source
- update entity/concept pages
- update index
- append log entry
- answer query
- file useful answer back into wiki
- lint wiki

5. Lint model

Define lint findings for:

- contradiction
- stale claim
- orphan page
- missing backlink
- missing hub page
- weak source attribution
- unsupported synthesis
- duplicate page
- outdated index entry

6. Librarian integration

LLM Wiki outputs must enter through Librarian as `llm_wiki` source envelopes.

Durable/canonical promotion requires approval.

7. Vault routing

Ensure wiki page types route under:

10-wiki/hubs
10-wiki/concepts
10-wiki/systems
10-wiki/people
10-wiki/projects
10-wiki/sources
10-wiki/decisions

Add routing for comparison/synthesis if needed.

8. Governance tests

Prove:

- raw sources are immutable
- wiki pages are derived
- no write authority exists in contract module
- durable wiki output requires approval
- source attribution required
- unsupported synthesis is rejected or flagged
- index/log are modeled but not written

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

3. LLM Wiki contract implemented

4. Page types defined

5. Special files model

6. Maintenance operation model

7. Lint model

8. Librarian integration

9. Governance checks

10. Tests added/updated

11. Commands executed with results

12. Expansion Era verdict

13. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add LLM Wiki contract layer
