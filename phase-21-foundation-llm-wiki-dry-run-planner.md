# ============================================================
# EXPANSION ERA FOUNDATION
# LLM WIKI DRY-RUN PLANNER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Karpathy LLM Wiki pattern:
  https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- docs/architecture/phase-21-llm-wiki-contract.md
- Librarian contract + dry-run planner
- Vault Write Gateway proposal layer
- Real Obsidian integration

Goal:

Implement a dry-run planner for LLM Wiki maintenance.

The planner decides what wiki maintenance SHOULD happen from a source envelope:

- create page draft
- update page draft
- update index draft
- append log draft
- lint finding
- reject unsupported synthesis

This slice must not write to the vault.

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
- mutate raw sources
- call LLMs
- implement Knowledge Compounding
- implement autonomous agents
- add schedulers
- add watchers
- add background jobs
- run web research

Dry-run planning only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. LLM Wiki dry-run function

Implement something like:

planLlmWikiMaintenanceDryRun()

Input:

- immutable source envelope
- existing wiki metadata/index snapshot
- requested operation
- optional page preference

Output:

- accepted / rejected
- maintenance operation
- page drafts
- index draft
- log draft
- lint findings
- Librarian envelope drafts
- Vault Write Gateway proposal drafts where appropriate
- reasons
- warnings
- write_attempted: false

2. Page planning

Support planning for:

- hub
- concept
- system
- person
- project
- source
- decision
- comparison
- synthesis

3. Source attribution

Every planned page draft must include:

- source ids
- source hashes
- source type
- unsupported synthesis flag if needed

4. Index/log planning

Model updates to:

- 10-wiki/index.md
- 10-wiki/log.md

but do not write them.

5. Lint planning

Surface findings for:

- contradiction
- stale claim
- orphan page
- missing backlink
- missing hub page
- weak source attribution
- unsupported synthesis
- duplicate page
- outdated index entry

6. Integration with Librarian/Gateway

Where page drafts are durable candidates:

- produce Librarian envelope draft
- optionally produce Vault Write Gateway proposal draft
- require approval
- do not execute

7. Governance tests

Prove:

- raw sources immutable
- no vault writes
- no execution imports
- no LLM calls
- no network/scheduler/watcher
- unsupported synthesis flagged
- index/log modeled but not written
- durable drafts require approval

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

3. Dry-run planner implemented

4. Page planning behavior

5. Source attribution behavior

6. Index/log planning behavior

7. Lint planning behavior

8. Librarian/Gateway integration

9. Governance checks

10. Tests added/updated

11. Commands executed with results

12. Expansion Era verdict

13. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add LLM Wiki dry-run planner
