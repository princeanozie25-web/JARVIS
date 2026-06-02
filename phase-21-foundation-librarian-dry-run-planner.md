# ============================================================
# EXPANSION ERA FOUNDATION
# LIBRARIAN DRY-RUN PLANNER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- docs/architecture/phase-21-vault-taxonomy.md
- docs/architecture/phase-21-vault-write-gateway.md
- docs/architecture/phase-21-vault-write-execution.md
- docs/architecture/phase-21-librarian-contract.md
- Real Obsidian integration verified

Goal:

Implement the Librarian dry-run planner.

The planner should decide what SHOULD happen to an ingestion envelope:

- classify
- dedupe-check
- route
- recommend promotion
- produce a Vault Write Gateway proposal when appropriate

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

- write into Obsidian
- execute vault writes
- create notes
- modify notes
- call executeApprovedVaultWriteProposal
- add schedulers
- add watchers
- add background jobs
- implement LLM Wiki
- implement GitNexus
- implement Knowledge Compounding

Dry-run planning only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Librarian dry-run function

Implement something like:

planLibrarianIngestionDryRun()

Input:

- Librarian ingestion envelope
- optional existing metadata index
- optional route preference

Output:

- accepted / rejected
- classification
- target route
- dedupe result
- promotion recommendation
- required approval
- optional Vault Write Gateway proposal draft
- reasons
- warnings
- write_attempted: false

2. Classification rules

Implement deterministic rules for:

- transient
- candidate
- durable
- canonical

3. Dedupe rules

Implement metadata/hash-first duplicate checks.

No embeddings required.

4. Routing rules

Use existing vault taxonomy routing.

Reject route mismatches.

5. Promotion recommendation

Recommend:

- stay transient
- promote to candidate
- propose durable write
- reject

6. Gateway proposal draft

When appropriate, produce a proposal draft compatible with the Vault Write Gateway.

Do not execute it.

7. Governance tests

Prove:

- planner never writes
- raw body is not included in planner output unless explicitly needed for proposal draft
- durable/canonical promotion requires approval
- agent-created durable notes require human approval
- duplicate content is rejected or warned
- routing mismatch rejects
- no execution imports exist

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

4. Classification behavior

5. Dedupe behavior

6. Routing behavior

7. Promotion behavior

8. Gateway proposal draft behavior

9. Governance checks

10. Tests added/updated

11. Commands executed with results

12. Expansion Era verdict

13. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add librarian dry-run planner
