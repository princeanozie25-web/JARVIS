# Phase 21 LLM Wiki Dry-Run Planner

## Scope

The LLM Wiki dry-run planner decides what wiki maintenance should happen from an immutable source envelope and an existing wiki snapshot.

It can model page drafts, index drafts, log drafts, lint findings, Librarian envelope drafts, and optional Vault Write Gateway proposal drafts. It does not write Obsidian notes, mutate raw sources, execute proposals, call LLMs, perform web research, start schedulers, start watchers, or launch background jobs.

## Inputs

`planLlmWikiMaintenanceDryRun()` accepts:

- immutable LLM Wiki raw source envelope
- existing wiki metadata/index snapshot
- requested maintenance operation
- optional page preference
- optional Gateway proposal draft body

Raw sources remain immutable and source-of-truth. Wiki pages are derived.

## Page Planning

Supported page plans:

- hub
- concept
- system
- person
- project
- source
- decision
- comparison
- synthesis

Every planned page draft includes source ids, source hashes, source type, and an unsupported synthesis flag when applicable.

## Index And Log Planning

The planner models updates to:

- `10-wiki/index.md`
- `10-wiki/log.md`

The drafts are metadata only. No file writes occur.

## Lint Planning

The planner can surface:

- contradiction
- stale claim
- orphan page
- missing backlink
- missing hub page
- weak source attribution
- unsupported synthesis
- duplicate page
- outdated index entry

Unsupported synthesis and duplicate pages reject the dry-run plan. Missing hub pages, missing backlinks, and outdated index entries are warnings.

## Librarian And Gateway Integration

Every planned page draft can produce a Librarian envelope draft with `source_type: llm_wiki`.

Durable drafts require approval. When an approved durable draft includes an explicit proposal body, the planner can emit a Vault Write Gateway proposal draft. The proposal is not executed.

## Governance

The planner returns `write_attempted: false`, `vault_mutated: false`, `vault_write_executed: false`, `llm_calls_made: false`, and `index_log_modeled_only: true`.
