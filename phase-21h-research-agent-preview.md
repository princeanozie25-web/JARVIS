# ============================================================

# PHASE 21H.8

# RESEARCH AGENT PREVIEW

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Agent Runtime Contract
- Agent Registry
- Agent Planner
- Agent Dry-Run Executor
- Agent Output Factory
- Librarian
- LLM Wiki
- Knowledge Compounding
- Verification Agent
- PRODUCT.md
- DESIGN.md

Goal:

Create the Research Agent preview.

The Research Agent should produce a metadata-only research digest preview from fixture topic/source metadata.

No live web search.

No model calls.

No Suggestion Inbox writes.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- search the web
- call models
- schedule the agent
- call external APIs
- read raw article bodies
- write Obsidian
- create real Suggestion Inbox entries
- add background jobs
- bypass Librarian

# REQUIRED WORK

1. Research Agent preview function

Implement:

previewResearchAgent()

Input:

- agent runtime plan/dry-run envelope
- safe fixture topic metadata
- safe fixture source metadata
- optional Librarian metadata
- optional Verification metadata

Output:

- research digest preview
- topic summary
- source summary
- novelty signals
- follow-up recommendations
- suggested_inbox_target
- preview_only: true
- execution_attempted: false
- write_attempted: false
- inbox_write_attempted: false

2. Topic metadata model

Support:

- topic_id
- title
- category
- interest_level
- source_count
- freshness
- related_wiki_refs

3. Source metadata model

Support:

- source_id
- title
- source_type
- url_hash
- published_at
- trust_level
- summary_metadata_only

4. Recommendation model

Each recommendation should include:

- title
- reason
- priority
- related_topic_id
- suggested_action: read | file_to_librarian | monitor | ignore
- approval_required

5. Integration

Use existing agent runtime registry/planner/dry-run/output-factory path.

Do not bypass generic runtime foundation.

6. Governance tests

Prove:

- no web search
- no external API calls
- no model calls
- no raw article bodies
- no inbox writes
- no scheduling
- no writes
- no Librarian bypass
- output is preview-only

# REQUIRED COMMANDS

npm test -- src/lib/agent-runtime

npx tsc --noEmit

npm test

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Research Agent preview implemented
4. Topic metadata model
5. Source metadata model
6. Recommendation behavior
7. Runtime integration
8. Governance checks
9. Tests added/updated
10. Commands executed
11. Expansion Era verdict
12. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21H.8: add Research Agent preview
