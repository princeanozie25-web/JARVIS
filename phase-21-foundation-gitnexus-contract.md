# ============================================================
# EXPANSION ERA FOUNDATION
# GITNEXUS CONTRACT LAYER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- GitNexus source: https://github.com/abhigyanpatwari/GitNexus
- Librarian contract layer
- Vault taxonomy contracts
- Future Graphify
- Future Build Monitor Agent

Goal:

Define how JARVIS will consume GitNexus outputs safely.

GitNexus is a code knowledge graph source.
It is NOT governance truth.
It is NOT an execution authority.
It is NOT allowed to mutate the repo or vault directly.

# ============================================================
# SINGLE AGENT ONLY
# ============================================================

Do not spawn subagents.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Add GitNexus source contract

Define metadata for:

- repo identity
- analyzed commit SHA
- generated graph id
- generated wiki id
- generated timestamp
- source tool/version

2. Add GitNexus artifact types

Support:

- repo_graph
- dependency_cluster
- call_chain
- execution_flow
- code_wiki_page
- blast_radius_report
- stale_index_report

3. Add Librarian ingestion support

GitNexus outputs must enter as `gitnexus` source envelopes.

They may become:

- transient
- candidate
- durable

but durable/canonical promotion requires approval.

4. Add routing rules

GitNexus durable outputs route under:

20-projects/<project>/gitnexus/

with subfolders:

- commits/
- slices/
- graphs/
- wiki/
- blast-radius/
- stale-index/

5. Governance tests

Prove:

- GitNexus has no write/execute authority
- GitNexus cannot replace JARVIS governance truth
- GitNexus outputs require Librarian routing
- durable GitNexus notes require approval
- raw diffs/full logs are not required or stored by default

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- install GitNexus
- run GitNexus
- add MCP config
- mutate repo
- write vault notes
- implement Build Monitor
- implement Graphify
- implement auto-reindexing

Contract only.

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
3. GitNexus contract added
4. Librarian integration added
5. Routing behavior
6. Governance checks
7. Tests added/updated
8. Commands executed
9. Expansion Era verdict
10. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add GitNexus contract layer
