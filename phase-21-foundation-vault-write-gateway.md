# ============================================================
# EXPANSION ERA FOUNDATION
# VAULT WRITE GATEWAY PROPOSAL LAYER
# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- docs/architecture/phase-21-vault-taxonomy.md
- Phase 18 approval lifecycle
- P0.2 Obsidian real integration
- Future 21G Knowledge Compounding
- Future GitNexus
- Future Librarian Agent

Goal:

Create the central proposal-only Vault Write Gateway contract.

This gateway is the ONLY route future agents may use to propose durable Obsidian writes.

This slice must NOT write to the vault.

# ============================================================
# SUBAGENTS
# ============================================================

Use parallel subagents where safe:

- Gateway Contract Agent
- Approval Lifecycle Agent
- Librarian Integration Agent
- GitNexus Integration Agent
- Governance Agent
- Test Agent
- Reviewer Agent

# ============================================================
# HARD CONSTRAINTS
# ============================================================

DO NOT:

- write files into Obsidian
- modify vault contents
- create notes
- implement Librarian
- implement Knowledge Compounding
- implement GitNexus
- bypass Phase 18 approval lifecycle
- add background jobs
- add watchers

Proposal layer only.

# ============================================================
# REQUIRED WORK
# ============================================================

1. Vault write proposal contract

Define a typed proposal object for future vault writes.

Must include:

- proposal_id
- note_type
- target_path
- frontmatter
- markdown_body
- provenance
- proposing_agent
- approval_required
- approval_status
- sensitivity
- content_hash
- created_at

2. Validation

Validate that:

- target path matches taxonomy routing
- frontmatter passes schema
- durable notes require approval
- agent-created durable notes require human approval
- GitNexus notes require project
- proposal markdown is not empty
- proposal has provenance

3. Dry-run planner

Create a pure function that returns:

- accepted / rejected
- target path
- reasons
- warnings
- required approval gate
- redaction summary

No filesystem writes.

4. Proposal lifecycle model

Model states:

- proposed
- rejected_by_policy
- awaiting_approval
- approved
- denied
- expired
- ready_to_write

Do not implement actual write execution.

5. Governance tests

Prove:

- direct durable write is impossible from contract layer
- transient agent outputs route to inbox/agent-runs
- durable agent output requires approval
- policy rejects schema-invalid proposals
- policy rejects routing mismatches
- no fs write/import exists in gateway module

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

4. Vault Write Gateway proposal contract implemented

5. Dry-run planner implemented

6. Approval lifecycle alignment

7. Governance checks

8. Tests added/updated

9. Commands executed with results

10. Expansion Era verdict

11. Suggested commit message

# ============================================================
# SUGGESTED COMMIT MESSAGE
# ============================================================

Phase 21 foundation: add vault write gateway proposal layer
