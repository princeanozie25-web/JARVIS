# ============================================================

# P0.2.b - SQLITE-VEC POPULATION + SEMANTIC RETRIEVAL

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- P0.2 Obsidian Real Integration
- Phase 11 Event Store
- Phase 13 Model Runtime
- Existing Obsidian pull-only indexer

Expansion Era rule:

This is not a scaffold slice.

A real vector population path and real semantic retrieval
must exist at closeout.

# ============================================================

# GOAL

# ============================================================

Extend the Obsidian integration so that:

- notes can be embedded locally
- vectors can be stored locally
- semantic retrieval works
- retrieval remains pull-only
- no vault mutation occurs

# ============================================================

# SUBAGENTS

# ============================================================

Spawn parallel subagents where safe:

1. Embedding Agent
2. Vector Store Agent
3. Retrieval Agent
4. Governance Agent
5. Test Agent
6. Reviewer Agent

# ============================================================

# HARD CONSTRAINTS

# ============================================================

DO NOT:

- write into the vault
- add file watchers
- add cloud embeddings
- add background indexing
- add automatic note creation
- add knowledge compounding

DO NOT store:

- raw vault bodies in telemetry
- embeddings in telemetry

Embeddings may exist only in the vector store.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Local embeddings

Use:

nomic-embed-text

through existing local model infrastructure.

Fail closed if unavailable.

2. sqlite-vec population

Create:

- vector schema
- vector storage
- deterministic population path

3. Semantic retrieval

Support:

- query
- top-k retrieval
- score ordering

4. CLI workflow

Add:

npm run obsidian:embed

or equivalent.

5. Tests

Prove:

- embeddings generated locally
- vector storage works
- retrieval returns expected notes
- no cloud calls occur
- no vault writes occur

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

4. Real semantic retrieval implemented

5. How embeddings are generated

6. How vector population is executed

7. Retrieval capabilities added

8. Governance checks

9. Tests added/updated

10. Commands executed

11. Expansion Era verdict

12. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21.0.2b: local vector population and retrieval
