# Phase 21 Vault Taxonomy Contracts

## Scope

These contracts define the durable Obsidian vault architecture for the Expansion Era foundation slice. They do not write notes, create folders, start watchers, run background jobs, implement Librarian, implement GitNexus, or implement Knowledge Compounding.

Markdown remains the canonical store. SQLite, vector, and graph indexes are derived rebuildable projections.

## Top-Level Vault Taxonomy

```text
00-meta/
01-inbox/
10-wiki/
20-projects/
30-research/
40-learning/
50-career/
60-agents/
70-references/
80-reviews/
90-archive/
_attachments/
```

Legacy scaffold folders such as `10-daily/`, `30-people/`, and `50-ideas/` are not active Phase 21 root folders.

## LLM Wiki Taxonomy

```text
10-wiki/
  hubs/
  concepts/
  systems/
  people/
  projects/
  sources/
  decisions/
```

## Note Types

Valid `note_type` values are:

```text
hub
concept
system
person
project
source
decision
agent_run
git_commit
git_slice
review
inbox_item
```

## Frontmatter Contract

`src/lib/obsidian/frontmatter.ts` owns the TypeScript/Zod schema for Phase 21 frontmatter. Required fields include:

- `schema_version`
- `id`
- `title`
- `note_type`
- `domain`
- `status`
- `created_at`
- `updated_at`
- `sensitivity`
- `project`
- `provenance`
- `agent`
- `links`
- `lifecycle`

Durable or canonical notes require:

- `lifecycle.approval_status: approved`
- `lifecycle.approval_id`

Agent-created durable or canonical notes also require:

- `agent.promotion_status: human_approved`

GitNexus notes require:

- `project`

## Routing Contract

`src/lib/obsidian/routing.ts` owns the pure route decision function. It returns metadata only:

- route status
- route kind
- target folder
- approval requirement
- durable write allowance
- librarian review requirement
- canonical source policy
- derived index policy

No route function performs filesystem, database, network, telemetry, tool, agent, or vault writes.

Key routes:

```text
hub        -> 10-wiki/hubs
concept    -> 10-wiki/concepts
system     -> 10-wiki/systems
person     -> 10-wiki/people
project    -> 10-wiki/projects
source     -> 10-wiki/sources
decision   -> 10-wiki/decisions
review     -> 80-reviews
inbox_item -> 01-inbox
```

GitNexus routes:

```text
git_commit -> 20-projects/<project>/gitnexus/commits
git_slice  -> 20-projects/<project>/gitnexus/slices
```

Transient agent output routes only to:

```text
01-inbox/agent
60-agents/<agent>/runs
```

## Governance

The Phase 21 contracts enforce:

- no direct durable agent writes
- durable notes require approval metadata
- transient agent outputs route to inbox or agent-run holding areas
- GitNexus notes route under `20-projects/<project>/gitnexus/`
- markdown is canonical
- SQLite, vector, and graph indexes are derived
- indexes are not authoritative
- contract modules contain no vault writes, watchers, background timers, network calls, or vector population
