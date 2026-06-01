# ============================================================
# EXPANSION ERA FOUNDATION
# VAULT WRITE GATEWAY EXECUTION LAYER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- docs/architecture/phase-21-vault-taxonomy.md
- docs/architecture/phase-21-vault-write-gateway.md
- Phase 18 approval lifecycle
- P0.2 Obsidian real integration

Goal:

Add the controlled execution layer for approved Vault Write Gateway proposals.

This is the first slice that may implement real vault writes, but ONLY when:

- the dry-run planner accepts the proposal
- the proposal is approved
- the target path matches taxonomy routing
- frontmatter is valid
- the write is inside OBSIDIAN_VAULT_PATH
- no existing file is overwritten unless explicitly allowed

# ============================================================
# SUBAGENTS
# ============================================================

Use parallel subagents where safe:

- Execution Agent
- Approval Integration Agent
- Filesystem Safety Agent
- Governance Agent
- Test Agent
- Reviewer Agent

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- bypass the dry-run planner
- bypass approval status
- write outside OBSIDIAN_VAULT_PATH
- overwrite existing notes by default
- add watchers
- add background jobs
- add Obsidian app automation
- implement Librarian
- implement Knowledge Compounding
- implement GitNexus

Controlled approved write execution only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Execution function

Implement a function similar to:

executeApprovedVaultWriteProposal()

It must:

- call the dry-run planner first
- require approved / ready_to_write state
- require matching approval id
- resolve path under OBSIDIAN_VAULT_PATH
- create parent folders if needed
- write markdown with frontmatter
- return execution metadata
- never print or log raw note body

2. Filesystem safety

Prove:

- path traversal is rejected
- absolute target paths are rejected
- overwrite is rejected by default
- writes outside vault are impossible
- missing vault path fails closed

3. Approval alignment

Only approved proposals may write.

Denied, expired, proposed, rejected, and awaiting approval proposals must fail closed.

4. Audit metadata

Return metadata only:

- proposal_id
- note_id
- target_path
- bytes_written
- content_hash
- created_at
- approval_id
- write_status

No raw body.

5. Tests

Add tests with a temp vault fixture proving:

- approved proposal writes a valid markdown note
- unapproved proposal does not write
- rejected proposal does not write
- overwrite blocked
- traversal blocked
- generated frontmatter is valid
- no raw body appears in execution metadata

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

2. Agents/subagents used

3. Files changed

4. Execution layer implemented

5. Approval gate behavior

6. Filesystem safety behavior

7. Governance checks

8. Tests added/updated

9. Commands executed with results

10. Expansion Era verdict

11. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add approved vault write execution
