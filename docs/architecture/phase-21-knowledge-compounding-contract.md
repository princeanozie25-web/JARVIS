# Phase 21 Knowledge Compounding Contract

## Scope

Knowledge Compounding discovers weak spots in the LLM Wiki and proposes improvements. It does not write notes, approve notes, execute proposals, bypass Librarian, bypass the Vault Write Gateway, call LLMs, run agents, or schedule background work.

This contract operates on metadata-only wiki signals and produces proposal objects.

## Candidate Types

Supported candidates:

- `missing_hub`
- `sparse_hub`
- `fragmented_concept`
- `missing_backlinks`
- `weak_source_coverage`
- `duplicate_concept`
- `stale_wiki_page`
- `underlinked_system`

## Detection Inputs

Detection is defined over metadata:

- references count
- backlinks count
- page word count
- source count
- update age
- duplicate title count
- hub existence
- related page count

No LLM, web, vector, filesystem, or vault execution is required.

## Proposal Model

`KnowledgeCompoundingProposal` includes:

- proposal id
- candidate type
- affected pages
- supporting sources
- source hashes
- confidence
- rationale
- proposed action
- approval requirement
- write/execution disabled flags

## LLM Wiki Integration

Compounding may propose:

- create hub
- update hub
- merge pages
- create backlinks
- refresh stale page

These are proposed actions only. Page generation belongs to later approved slices.

## Librarian Integration

Compounding proposals enter Librarian as `source_type: knowledge_compounding`.

Candidate proposals route as wiki decision metadata. Durable proposals require approval and are held by the existing approval routing until approved.

## Governance

Knowledge Compounding has no write authority, no execution authority, no approval authority, no scheduler, no watcher, no background jobs, no network path, and no Obsidian mutation surface.
