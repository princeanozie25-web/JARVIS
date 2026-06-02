# Phase 21 Librarian Dry-Run Planner

## Scope

The Librarian dry-run planner decides what should happen to an ingestion envelope without mutating the Obsidian vault.

It classifies the envelope, checks metadata duplicates, routes through the existing vault taxonomy, recommends promotion behavior, and may emit a Vault Write Gateway-compatible proposal draft. It does not execute the proposal.

## Planner Input

`planLibrarianIngestionDryRun()` accepts:

- a Librarian ingestion envelope
- an optional existing metadata index
- an optional route preference
- optional proposal markdown body for gateway draft generation

The ingestion envelope remains metadata-only. Raw bodies are not included in planner output unless the caller explicitly supplies markdown for a gateway proposal draft.

## Classification

Classification is deterministic:

- transient agent runs stay transient
- draft/candidate notes stay candidates
- status-durable notes become durable candidates
- lifecycle-canonical notes become canonical candidates

Durable and canonical promotion require approval. Agent-created durable notes require human approval.

## Dedupe

Duplicate checks are metadata/hash-first:

- exact duplicate by content hash
- source duplicate by source type and source id
- possible duplicate by title/path slug

No embeddings, vectors, or semantic clustering are executed.

## Routing

The planner uses existing vault taxonomy routing. Route preferences are advisory and rejected when they mismatch the route derived from frontmatter.

## Gateway Proposal Draft

When durable write planning is appropriate and an explicit proposal body is supplied, the planner emits a `VaultWriteProposal` draft compatible with the Vault Write Gateway schema.

The draft is still dry-run output. `write_attempted` is always `false`, and `vault_mutated` is always `false`.

## Governance

The planner does not import the Vault Write Execution module, call approved write execution, start schedulers, watch files, perform network calls, or write to disk.
