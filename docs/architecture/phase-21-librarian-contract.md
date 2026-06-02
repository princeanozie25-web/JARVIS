# Phase 21 Librarian Contract Layer

## Scope

The Librarian contract is the governance brain for future Obsidian knowledge intake. It defines ingestion, classification, routing, deduplication, provenance, and promotion decisions.

It is not a writer, scheduler, autonomous agent, vault mutation surface, GitNexus implementation, LLM Wiki implementation, or Knowledge Compounding implementation.

## Ingestion Sources

`src/lib/obsidian/librarian-contract.ts` defines the accepted source types:

- `user_note`
- `agent_output`
- `gitnexus`
- `llm_wiki`
- `imported_document`
- `external_research`

Every ingestion envelope must carry a source identifier, provenance source type, `sha256` content hash, proposed Phase 21 vault frontmatter, and `raw_body_included: false`.

## Classification Ladder

The contract models four classifications:

- `transient`
- `candidate`
- `durable`
- `canonical`

`transient -> candidate` requires provenance and a content hash. `candidate -> durable` requires provenance, a content hash, and approval. `durable -> canonical` requires the same approval-backed traceability.

## Deduplication Model

Exact duplicate detection is hash-first and metadata-based:

- content hash
- source type
- source id
- proposed note id

Near-duplicate handling is a contract only in this slice. It may compare metadata such as title, source links, and tags, but it does not execute embeddings, vector lookup, or semantic clustering.

## Routing Model

The Librarian contract delegates folder selection to the existing vault taxonomy routing layer. Requested folders are rejected when they do not match the route produced from frontmatter.

The routing model covers inbox, wiki, project, research, learning, career, agent, reference, review, archive, and meta destinations.

## Promotion Model

Durable or canonical promotion requires:

- traceable provenance
- matching content hash
- approval status aligned with frontmatter lifecycle
- human approval for agent-created durable content

Transient and candidate intake can be accepted without durable authority. Acceptance does not mean a note can be written.

## Governance

The contract has no vault write authority, no execution authority, no scheduler authority, and no background job surface. It does not import the Vault Write Gateway or Vault Write Execution modules.

Markdown remains canonical. SQLite, vector, and graph indexes remain derived.
