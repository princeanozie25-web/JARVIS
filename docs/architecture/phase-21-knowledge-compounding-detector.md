# Phase 21 Knowledge Compounding Detector

## Scope

The Knowledge Compounding detector identifies opportunities to improve the LLM Wiki from metadata snapshots. It is dry-run only.

It does not call models, generate pages, write Obsidian notes, execute Vault Write Gateway proposals, mutate the vault, implement agents, add schedulers, add watchers, or start background jobs.

## Inputs

The detector accepts:

- wiki metadata snapshot
- Librarian metadata snapshot
- source metadata snapshot

Inputs are metadata only. Required wiki page metrics include references count, backlinks, page word count, source ids/hashes, update timestamp, hub id, and related page ids.

## Candidate Detection

Detected candidate types:

- `missing_hub`
- `sparse_hub`
- `fragmented_concept`
- `missing_backlinks`
- `weak_source_coverage`
- `duplicate_concept`
- `stale_wiki_page`
- `underlinked_system`

## Evidence Model

Each candidate includes evidence:

- why it was detected
- supporting pages
- supporting sources
- references/backlinks/word/source/update/duplicate/related metrics
- confidence
- proposed action
- `write_attempted: false`

## Proposal Generation

The detector can generate `KnowledgeCompoundingProposal` drafts from detected candidates. Draft proposals are not executed.

Proposal actions map to LLM Wiki improvement intents:

- `create_hub`
- `update_hub`
- `merge_pages`
- `create_backlinks`
- `refresh_stale_page`

## Governance

The detector returns governance metadata proving:

- no write attempt
- no vault mutation
- no execution authority
- no DeepSeek/Ollama/model calls
- no network
- no scheduler/watcher/background job
