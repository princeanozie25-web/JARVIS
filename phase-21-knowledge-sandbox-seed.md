# ============================================================

# PHASE 21

# KNOWLEDGE SANDBOX SEED

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Real Obsidian integration
- LLM Wiki pipeline
- Knowledge Compounding detector
- Vault Write Gateway

Goal:

Create a safe sandbox dataset inside the real Obsidian vault.

We need enough knowledge density to exercise:

- knowledge:detect
- wiki:draft

without touching real user knowledge.

# ============================================================

# SINGLE AGENT ONLY

# ============================================================

Do not spawn subagents.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

DO NOT:

- touch existing notes
- reorganize existing notes
- overwrite files
- modify user content

Only create sandbox test knowledge.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Create a sandbox area:

30-research/sandbox/

or equivalent approved location.

2. Generate a small synthetic knowledge graph:

Example:

- LangGraph
- PydanticAI
- MCP
- GitNexus
- Graphify

Create:

- overlapping references
- sparse concepts
- missing hubs
- missing backlinks

intentionally.

3. Run:

npm run knowledge:detect

4. Run:

npm run wiki:draft

5. Report:

- candidates detected
- proposed actions
- generated draft previews

6. Verify:

- no writes outside sandbox
- no modification of existing notes

# ============================================================

# REQUIRED COMMANDS

# ============================================================

npm run obsidian:index

npm run obsidian:embed

npm run knowledge:detect

npm run wiki:draft

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Files created

3. Sandbox graph created

4. Detection results

5. Draft preview results

6. Governance checks

7. Commands executed

8. Expansion Era verdict

9. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21: seed knowledge sandbox and validate wiki pipeline
