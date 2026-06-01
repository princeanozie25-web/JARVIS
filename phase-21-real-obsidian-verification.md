# ============================================================
# PHASE 21 — REAL OBSIDIAN VAULT VERIFICATION
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- P0.2 Obsidian real integration
- Vault taxonomy contracts
- Vault Write Gateway proposal + execution layers

Goal:

Verify the real Obsidian vault integration end-to-end against Prince's actual vault.

This is a controlled verification slice.

Use temporary Full Access only for locating and verifying the real vault.

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- modify existing notes
- reorganize folders
- delete files
- use Obsidian app automation
- install Obsidian plugins
- enable watchers
- enable background jobs

Only one optional write is allowed:

- create a single test note through the approved Vault Write Gateway execution path
- only if all gateway conditions pass
- place it in the approved taxonomy location
- content must clearly identify it as a test note
- do not overwrite anything

# ============================================================
# REQUIRED WORK
# ============================================================

1. Locate vault

Find Prince's real Obsidian vault path.

Prefer existing env/config if present:

- OBSIDIAN_VAULT_PATH
- JARVIS_OBSIDIAN_VAULT_ROOT

If both exist, report the naming conflict and do not silently choose one.

2. Configure path

If no path is configured, identify the likely vault path and document the exact env setting Prince should add.

Do not store secrets.

3. Run read-only verification

Run:

npm run obsidian:index
npm run obsidian:embed

Report:

- note count
- indexed markdown count
- embedded count
- vector count if available
- skipped files count
- any failure class

4. Run semantic retrieval smoke

Run at least 3 safe sample queries against the real vault.

Do not print raw note bodies.

Print only:

- note title
- relative path
- score
- bounded snippet if existing CLI already supports safe snippets

5. Optional controlled write test

Only if safe and supported:

- create one approved test proposal
- pass it through dry-run
- execute through approved write gateway
- confirm file exists
- do not overwrite
- do not modify existing notes

If any part is unclear, skip the write test.

6. Cleanup decision

Do not delete the test note automatically.

Report the exact path so Prince can inspect/delete manually.

# ============================================================
# SUBAGENTS
# ============================================================

Use parallel subagents where safe:

- Vault Discovery Agent
- Index Verification Agent
- Embedding Verification Agent
- Retrieval Smoke Agent
- Gateway Write Verification Agent
- Governance Reviewer Agent
- Final Reviewer Agent

# ============================================================
# REQUIRED COMMANDS
# ============================================================

npm run obsidian:index

npm run obsidian:embed

npm test -- src/lib/obsidian

npx tsc --noEmit

git diff --check

# ============================================================
# FINAL RESPONSE FORMAT
# ============================================================

1. Effort level

2. Agents/subagents used

3. Real vault path discovered

4. Env/config changes needed

5. Indexing result

6. Embedding/vector result

7. Semantic retrieval smoke results

8. Optional gateway write verification result

9. Governance checks

10. Commands executed with results

11. Is Obsidian live and usable?

YES
or
YES WITH NOTES
or
NO

12. Suggested commit message, if any
