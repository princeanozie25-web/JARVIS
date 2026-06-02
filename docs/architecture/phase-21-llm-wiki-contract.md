# Phase 21 LLM Wiki Contract Layer

## Scope

The JARVIS LLM Wiki is the durable Markdown knowledge layer built from immutable raw sources, approved syntheses, GitNexus artifacts, and future agent outputs.

This contract is based on the Karpathy LLM Wiki pattern: immutable raw sources, derived interlinked Markdown pages, a content-oriented `index.md`, a chronological append-only `log.md`, and periodic lint-style maintenance. Source: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>.

This slice defines contracts only. It does not generate pages, write Obsidian notes, execute Vault Write Gateway proposals, implement Knowledge Compounding, ingest web sources, implement autonomous agents, mutate raw sources, or add schedulers/watchers/background jobs.

## Source Model

Raw sources are source-of-truth and immutable. Supported source inputs:

- `user_note`
- `imported_document`
- `external_research`
- `gitnexus`
- `agent_output`

Wiki pages are derived artifacts. They must carry source references and source content hashes.

## Page Types

Supported page contracts:

- hub page
- concept page
- system page
- person page
- project page
- source page
- decision page
- comparison page
- synthesis page

Comparison and synthesis pages route under `10-wiki/concepts` until a later approved taxonomy slice introduces more specific folders.

## Special Files

Modeled special files:

- `10-wiki/index.md`: content-oriented catalog
- `10-wiki/log.md`: chronological append-only log for future execution slices

Both are modeled but not written by this contract.

## Maintenance Operations

Dry-run operation contracts:

- ingest source
- update entity/concept pages
- update index
- append log entry
- answer query
- file useful answer back into wiki
- lint wiki

Operations that would mutate wiki content require future Librarian and approval-gated execution.

## Lint Model

Lint findings:

- contradiction
- stale claim
- orphan page
- missing backlink
- missing hub page
- weak source attribution
- unsupported synthesis
- duplicate page
- outdated index entry

Unsupported synthesis and weak source attribution are flagged by the contract without writing anything.

## Librarian Integration

LLM Wiki outputs enter through Librarian as `source_type: llm_wiki` envelopes.

Candidate wiki outputs can route under the wiki taxonomy. Durable or canonical promotion requires approval. Unapproved durable outputs are held in the existing pending approval route.

## Governance

The contract has no write authority, no vault execution authority, no scheduler authority, no watcher authority, and no background job surface. Raw sources remain immutable. Markdown remains canonical; indexes and graphs are derived.
