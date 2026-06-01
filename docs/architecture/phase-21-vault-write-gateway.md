# Phase 21 Vault Write Gateway Proposal Layer

## Scope

The Vault Write Gateway is a proposal-only contract for future durable Obsidian writes. It does not write files, mutate the vault, create notes, start watchers, start background jobs, implement Librarian, implement GitNexus, or implement Knowledge Compounding.

Future agents must use this gateway to propose durable vault writes. The gateway returns a dry-run plan and approval gate metadata only.

## Proposal Contract

`src/lib/obsidian/write-gateway.ts` defines `VaultWriteProposalSchema`.

Required proposal fields:

- `proposal_id`
- `note_type`
- `target_path`
- `frontmatter`
- `markdown_body`
- `provenance`
- `proposing_agent`
- `approval_required`
- `approval_status`
- `sensitivity`
- `content_hash`
- `created_at`

The proposal also carries `write_attempted: false` and `vault_mutated: false` in the dry-run result. Approval status must align with the Phase 21 vault approval statuses and the Phase 18 `obsidian_write` proposal kind.

## Dry-Run Planner

`planVaultWriteProposalDryRun()` validates a proposal and returns:

- accepted or rejected
- proposal lifecycle state
- target path
- resolved route folder
- reasons
- warnings
- required approval gate
- metadata-only redaction summary
- `write_attempted: false`
- `vault_mutated: false`

No filesystem, database, network, telemetry, tool runtime, or approval execution side effect is performed.

## Lifecycle States

```text
proposed
rejected_by_policy
awaiting_approval
approved
denied
expired
ready_to_write
```

`ready_to_write` means the proposal has passed contract validation and approval metadata checks. It does not execute a write.

## Policy Validation

The planner rejects proposals when:

- frontmatter fails the Phase 21 frontmatter schema
- target path does not match taxonomy routing
- durable notes lack approval
- agent-created durable notes lack human approval
- GitNexus notes lack project metadata
- markdown body is empty
- provenance is missing or mismatched
- content hash does not match frontmatter provenance
- approval is denied or expired

## Governance

The gateway preserves the Expansion Era foundation boundary:

- proposal-only
- no durable write execution
- no Obsidian mutation
- no direct durable agent writes
- no Librarian implementation
- no GitNexus implementation
- no Knowledge Compounding implementation
- no background jobs
- no watchers
- no Phase 18 approval lifecycle bypass
