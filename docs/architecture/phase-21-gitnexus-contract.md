# Phase 21 GitNexus Contract Layer

## Scope

GitNexus is treated as a code knowledge graph source for JARVIS. It may provide repository graph, dependency cluster, call chain, execution flow, code wiki, blast radius, and stale index artifacts.

It is not governance truth, a write surface, an execution authority, a repo mutator, a vault mutator, Graphify, Build Monitor, MCP configuration, or auto-reindexing.

The contract source is GitNexus: <https://github.com/abhigyanpatwari/GitNexus>. The source describes GitNexus as a local code knowledge graph system for dependencies, call chains, clusters, execution flow, code wiki, MCP agent context, and related code intelligence.

## Source Metadata

`src/lib/obsidian/gitnexus-contract.ts` defines required metadata:

- repo identity
- analyzed commit SHA
- generated graph id
- generated wiki id
- generated timestamp
- source tool and version

The contract stores metadata and content hashes only. Raw diffs, full logs, and raw payloads are not required or accepted by default.

## Artifact Types

Supported GitNexus artifact types:

- `repo_graph`
- `dependency_cluster`
- `call_chain`
- `execution_flow`
- `code_wiki_page`
- `blast_radius_report`
- `stale_index_report`

These are also registered as vault note types so they can pass through the same frontmatter and routing contracts as other Phase 21 notes.

## Librarian Integration

GitNexus artifacts enter JARVIS as Librarian ingestion envelopes with `source_type: gitnexus`.

They may be transient, candidate, or durable. Durable or canonical promotion requires approval. Agent/source-created durable GitNexus output requires human approval.

## Routing

GitNexus durable outputs route under:

```text
20-projects/<project>/gitnexus/
```

Subfolders:

- `commits/`
- `slices/`
- `graphs/`
- `wiki/`
- `blast-radius/`
- `stale-index/`

## Governance

GitNexus outputs require Librarian routing. GitNexus cannot replace JARVIS governance truth and cannot write notes, mutate repositories, execute tools, install MCP configuration, start watchers, start schedulers, or trigger auto-reindexing in this slice.
