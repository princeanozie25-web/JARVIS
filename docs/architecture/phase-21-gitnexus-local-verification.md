# Phase 21 GitNexus Local Verification

## Scope

This document records the read-only local verification path for using GitNexus as a derived code graph source for JARVIS.

GitNexus remains source-only. It is not JARVIS governance truth, an execution authority, a repo mutation surface, a vault mutation surface, Graphify, Build Monitor, MCP configuration, hooks, or auto-reindexing.

## Installation Status Check

Check whether a global GitNexus CLI is available:

```powershell
gitnexus --version
```

If the command is not available, use the package runner form:

```powershell
npx gitnexus --version
```

The `npx` form may fetch and execute third-party package code. Run it only in an environment where that is intentionally allowed.

## Read-Only Analysis

From the JARVIS repository root, run:

```powershell
npx gitnexus analyze --skip-embeddings
```

The `--skip-embeddings` flag keeps this verification in metadata/graph mode and avoids embedding generation.

Do not run:

```powershell
npx gitnexus setup
```

`setup` configures editor/MCP integration and is outside this verification slice.

## Status Check

After analysis, inspect the derived index state:

```powershell
npx gitnexus status
```

Record:

- whether the repo is indexed
- index path or location, if shown
- file count, if shown
- graph or status summary, if shown
- warnings

## Cleaning Local Indexes

If the local GitNexus index needs to be removed for this repository:

```powershell
npx gitnexus clean
```

For non-interactive cleanup in a trusted local shell:

```powershell
npx gitnexus clean --force
```

Do not delete any Obsidian notes as part of GitNexus cleanup. GitNexus indexes are derived artifacts.

## Governance

GitNexus verification must preserve these boundaries:

- GitNexus index data is derived, not canonical.
- GitNexus must not mutate JARVIS source files.
- GitNexus must not write Obsidian notes.
- GitNexus must not become JARVIS governance truth.
- Generated local index files must remain local derived artifacts or be documented before commit.
- MCP setup, hooks, auto-reindexing, Graphify, and Build Monitor remain disabled in this slice.

## Current Verification Result

In the Codex sandbox on 2026-06-02, `gitnexus --version` was not initially available on PATH. The first `npx gitnexus --version` resolved GitNexus `1.6.5`, but `npx gitnexus analyze --skip-embeddings` failed because GitNexus `1.6.5` does not support `--skip-embeddings`.

GitNexus `1.6.5` was then installed globally with:

```powershell
npm install -g gitnexus
```

The safe read-only analysis command that worked was:

```powershell
gitnexus analyze --index-only --drop-embeddings
```

`--index-only` prevented AGENTS/CLAUDE/skills injection. `--drop-embeddings` ensured the derived index contains no embeddings.

Verification output:

- GitNexus version: `1.6.5`
- Repository indexed: yes
- Indexed commit: `a3ca47958667fc2eb414a2b497a84fff2e0e0fae`
- Files: `1193`
- Nodes: `23640`
- Edges: `45254`
- Communities: `1564`
- Flows/processes: `300`
- Embeddings: `0`
- Repo-local index path: `C:\Users\princ\Documents\jarvis\.gitnexus`
- User registry path: `C:\Users\princ\.gitnexus\registry.json`
- Repo-local index size: approximately `256 MB`

`gitnexus status` reported the repository as up to date.

Generated files:

- `.gitnexus/` in the JARVIS repo, ignored by `.gitnexus/.gitignore`
- `C:\Users\princ\.gitnexus\registry.json`

Governance result:

- No MCP setup was run.
- No hooks were installed.
- No GitNexus markers were added to `AGENTS.md`, `CLAUDE.md`, `.claude`, `.husky`, or `.git/hooks`.
- No Obsidian notes were written.
- No JARVIS source files were modified by GitNexus.
- The GitNexus index remains derived data, not governance truth.
