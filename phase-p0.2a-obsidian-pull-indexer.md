# ============================================================
# P0.2.a - OBSIDIAN VAULT PATH + PULL-ONLY INDEXER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- P0.2 Obsidian Real Integration
- Phase 11 event store
- Phase 13 model runtime
- Existing memory bridge infrastructure

Expansion Era rule:

Foundation work is allowed.

Feature is not considered complete unless real integration exists.

This slice must produce a real pull-only Obsidian indexer.

# ============================================================
# GOAL
# ============================================================

Create the real Obsidian vault integration foundation.

After this slice:

- JARVIS can point at a real Obsidian vault
- JARVIS can scan the vault
- JARVIS can build an index
- JARVIS can retrieve note metadata
- JARVIS can retrieve safe snippets

WITHOUT:

- file watching
- background indexing
- silent writes
- cloud embeddings
- vault mutation

This is pull-only.

# ============================================================
# SUBAGENTS
# ============================================================

Spawn parallel agents where safe:

1. Vault Path Agent
   - vault config
   - path validation
   - env integration

2. Indexer Agent
   - traversal
   - note discovery
   - metadata extraction

3. Retrieval Agent
   - lookup
   - metadata retrieval
   - snippet retrieval

4. Governance Agent
   - privacy
   - telemetry
   - no-write guarantees

5. Test Agent
   - coverage
   - fixtures
   - regression tests

6. Final Reviewer Agent
   - consolidation
   - architecture compliance

Use a single agent only where coupling makes parallelization unsafe.

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- write into the vault
- modify notes
- watch files
- background index
- add cloud embeddings
- store raw vault bodies in telemetry
- introduce network calls
- bypass existing governance

DO NOT implement:

- vector population
- embedding generation
- knowledge compounding
- automatic note creation

Those belong to later slices.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Real vault path support

Support:

OBSIDIAN_VAULT_PATH

Validate:

- path exists
- path is directory
- useful error messages
- fail closed

2. Pull-only indexer

Implement real vault traversal.

Discover:

- markdown files
- folders
- note metadata

Capture:

- note id
- title
- path
- size
- timestamps
- tags (if already parsed elsewhere)

3. Metadata index

Build index structures suitable for later retrieval.

Indexing must be:

- manual
- pull-based
- deterministic

No daemon.

No watcher.

No scheduler.

4. Retrieval surface

Implement retrieval of:

- note metadata
- note snippet
- note lookup by id/path

Retrieval must not require embeddings.

5. Telemetry & privacy

Verify:

- vault body never enters telemetry
- telemetry remains metadata only
- redaction protections remain active

6. Documentation

Document:

- OBSIDIAN_VAULT_PATH
- how indexing works
- how to run indexing
- how retrieval works
- limitations

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

4. Real integration implemented

5. How Prince configures vault path

6. How indexing is executed

7. Retrieval capabilities added

8. Governance checks

9. Tests added/updated

10. Commands executed with results

11. Expansion Era verdict

PASS
or
PASS WITH NOTES

12. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21.0.2a: Obsidian pull-only indexer
