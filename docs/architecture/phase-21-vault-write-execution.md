# Phase 21 Vault Write Gateway Execution Layer

## Scope

The approved vault write execution layer is the controlled writer for Vault Write Gateway proposals. It is separate from the proposal-only gateway and may write only when the dry-run planner marks a proposal as `ready_to_write`.

This layer does not add watchers, background jobs, Obsidian app automation, Librarian, GitNexus, or Knowledge Compounding.

## Execution Gate

`executeApprovedVaultWriteProposal()` must:

- call `planVaultWriteProposalDryRun()` before writing
- require `state: ready_to_write`
- require `approval_status: approved`
- require `proposal_kind: obsidian_write`
- require `lifecycle_stage: APPROVED`
- require proposal, frontmatter lifecycle, and dry-run approval ids to match
- require `OBSIDIAN_VAULT_PATH`
- resolve target paths inside the validated vault root
- reject path traversal, absolute targets, and backslash targets
- reject overwrites by default

## Write Behavior

Approved writes create parent folders as needed and write a Markdown note:

```text
---
<Phase 21 frontmatter>
---

<markdown body>
```

The execution function returns metadata only. Raw note body and rendered markdown are not returned.

## Execution Metadata

Returned metadata includes:

- `proposal_id`
- `note_id`
- `target_path`
- `bytes_written`
- `content_hash`
- `created_at`
- `approval_id`
- `write_status`
- `raw_body_included: false`
- `vault_mutated`

## Failure Behavior

The executor fails closed for:

- missing vault path
- rejected dry-run plan
- non-`ready_to_write` state
- pending, denied, expired, proposed, or awaiting approval proposals
- approval id mismatch
- route/path mismatch
- path escape
- overwrite by default
- filesystem write error
