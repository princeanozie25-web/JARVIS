# Phase 21 Knowledge Compounding To LLM Wiki Bridge

## Scope

The bridge translates Knowledge Compounding candidates into LLM Wiki dry-run maintenance plans.

It does not call models, write Obsidian notes, execute Vault Write Gateway proposals, mutate vault contents, add schedulers, add watchers, or start background jobs.

## Candidate Mapping

Mapping from candidate type to wiki action:

- `missing_hub` -> `create_hub`
- `sparse_hub` -> `update_hub`
- `fragmented_concept` -> `merge_pages`
- `missing_backlinks` -> `create_backlinks`
- `weak_source_coverage` -> `update_hub`
- `duplicate_concept` -> `merge_pages`
- `stale_wiki_page` -> `refresh_stale_page`
- `underlinked_system` -> `create_backlinks`

## Planner Reuse

The bridge reuses `planLlmWikiMaintenanceDryRun()` for page, index, log, lint, Librarian, and Gateway draft planning. It does not duplicate LLM Wiki planner logic.

## Outputs

`planKnowledgeCompoundingWikiBridge()` returns:

- wiki maintenance plans
- bridge recommendations
- Librarian envelope drafts
- optional Vault Write Gateway proposal drafts
- lint findings
- reasons and warnings
- `write_attempted: false`

## Governance

All outputs are drafts. Librarian envelopes are not persisted. Gateway proposals are not executed. The bridge reports no LLM calls, no DeepSeek/Ollama calls, no network use, no scheduler, no watcher, no background job, and no vault mutation.
