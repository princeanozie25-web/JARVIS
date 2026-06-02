# ============================================================
# PHASE 21 — GITNEXUS FULL ACCESS LOCAL VERIFICATION
# ============================================================

Goal:

Use temporary Full Access only to verify GitNexus locally against the JARVIS repo.

# HARD CONSTRAINTS

DO NOT:
- wire MCP
- run gitnexus setup
- install hooks
- enable auto-reindex
- write Obsidian notes
- mutate source files except docs if needed
- add package scripts unless necessary
- treat GitNexus as governance truth

Allowed:
- install/use GitNexus CLI
- run read-only repo analysis
- inspect status
- document results

# REQUIRED WORK

1. Check/install GitNexus safely.

Prefer:
npx gitnexus --version

If needed:
npm install -g gitnexus

2. Run:

gitnexus analyze --skip-embeddings

or:

npx gitnexus analyze --skip-embeddings

3. Run:

gitnexus status

or:

npx gitnexus status

4. Report:
- installed version
- whether repo indexed
- index location
- file count / graph stats if visible
- generated files
- whether any repo files changed

5. Confirm:
- no MCP configured
- no hooks installed
- no Obsidian writes
- no source mutation except docs if intentionally changed

# REQUIRED COMMANDS

git status --short
gitnexus --version || npx gitnexus --version
gitnexus analyze --skip-embeddings || npx gitnexus analyze --skip-embeddings
gitnexus status || npx gitnexus status
git status --short

# FINAL RESPONSE FORMAT

1. Effort level
2. Full Access actions performed
3. GitNexus version
4. Analysis result
5. Status result
6. Generated files/indexes
7. Repo mutations
8. Governance checks
9. Commands executed
10. Verdict
11. Suggested commit message, if any
