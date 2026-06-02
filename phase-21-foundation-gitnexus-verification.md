# ============================================================
# EXPANSION ERA FOUNDATION
# GITNEXUS LOCAL VERIFICATION
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- docs/architecture/phase-21-gitnexus-contract.md
- GitNexus source: https://github.com/abhigyanpatwari/GitNexus
- Librarian contract layer
- Vault taxonomy contracts

Goal:

Verify GitNexus can be used locally against the JARVIS repo as a read-only code graph source.

This slice makes GitNexus real, but gives it no authority.

# ============================================================
# SINGLE AGENT ONLY
# ============================================================

Do not spawn subagents.

Preserve Codex quota.

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- wire MCP
- add Codex MCP config
- add Claude MCP config
- enable hooks
- enable auto-reindex
- write Obsidian notes
- execute vault writes
- mutate source files except docs/package scripts if needed
- treat GitNexus as governance truth
- replace Phase 19 architecture graph
- implement Graphify
- implement Build Monitor

Verification only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Check installation status

Check whether GitNexus is already available:

- gitnexus --version
- npx gitnexus --version

2. Add minimal dev docs if needed

Document:

- how to install GitNexus
- how to run read-only analysis
- how to check status
- how to clean index

3. Run local read-only analysis

Prefer:

npx gitnexus analyze --skip-embeddings

or the safest equivalent.

Do not enable embeddings yet.

Do not configure MCP yet.

4. Verify output

Run:

npx gitnexus status

or equivalent.

Report:

- whether repo indexed
- index path/location if visible
- file count if visible
- graph/status info if visible
- any warnings

5. Governance review

Confirm:

- GitNexus index is derived
- GitNexus does not mutate JARVIS source
- GitNexus does not write Obsidian
- GitNexus does not become governance truth
- any generated local files are either ignored or intentionally documented

6. Optional package script

Only if useful and safe, add scripts such as:

- gitnexus:analyze
- gitnexus:status

Do not add MCP scripts yet.

# ============================================================
# REQUIRED COMMANDS
# ============================================================

gitnexus --version || true

npx gitnexus --version

npx gitnexus analyze --skip-embeddings

npx gitnexus status

npm test -- src/lib/obsidian

npx tsc --noEmit

git diff --check

# ============================================================
# FINAL RESPONSE FORMAT
# ============================================================

1. Effort level

2. Files changed

3. GitNexus installation status

4. GitNexus analysis result

5. GitNexus status result

6. Any generated files or indexes

7. Governance checks

8. Commands executed with results

9. Expansion Era verdict

10. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: verify GitNexus locally
