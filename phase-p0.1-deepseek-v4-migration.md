# ============================================================

# P0.1 — DEEPSEEK V4 REGISTRY MIGRATION

# ============================================================

Architecture Anchor:

- docs/architecture/EXPANSION_ERA.docx
- ARCHITECTURE_OPERATIONALIZATION.pdf as frozen substrate only
- Phase 13 model runtime contracts are frozen; do not redesign them.

Goal:

Migrate the DeepSeek registry references from legacy DeepSeek model IDs to:

- deepseek-v4-flash
- deepseek-v4-pro

while preserving local-first, cloud-disabled-by-default governance.

If your environment supports parallel subagents, spawn them:

- Registry Agent: inspect model registry and model ID references.
- Provider Test Agent: inspect DeepSeek provider tests and compatibility.
- Telemetry Agent: inspect model_calls / cost telemetry model_id handling.
- Governance Reviewer Agent: verify no cloud auto-enable, no fallback bypass, no pricing hardcoding.
- Final Reviewer Agent: consolidate results and produce final patch summary.

Use a single agent only where changes are tightly coupled.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

Do NOT reopen Phase 13 architecture.

Do NOT auto-enable DeepSeek cloud providers.

Do NOT hardcode obsolete model aliases.

Do NOT leave references to:

- deepseek-chat
- deepseek-reasoner

unless they appear only inside explicit migration/legacy rejection tests.

Do NOT invent pricing.

If pricing is required, verify it from official DeepSeek API docs.
If current pricing cannot be verified, leave pricing as configurable metadata and document that it requires verification.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Search the repo for DeepSeek legacy IDs.

Check:

- config/models/registry.yaml
- src/models/\*\*
- tests/models/\*\*
- telemetry/model call tests
- README/docs references if directly tied to model registry

2. Update registry entries.

Expected target model IDs:

- deepseek-v4-flash for T2 / fast reasoning / verification / draft work
- deepseek-v4-pro for T3 / deep reasoning / council / planning work

Both must remain:

enabled: false

unless the existing registry convention uses a different disabled flag.

3. Provider compatibility.

Verify the DeepSeek provider does not hardcode old model names.

If it does, refactor only the minimum required code so model names flow from registry/config.

4. Telemetry.

Ensure model_calls telemetry records the exact new model_id values without lossy mapping.

5. Tests.

Add or update tests proving:

- registry accepts deepseek-v4-flash
- registry accepts deepseek-v4-pro
- no active registry entry uses deepseek-chat
- no active registry entry uses deepseek-reasoner
- cloud providers remain disabled by default
- telemetry preserves exact DeepSeek V4 model IDs
- provider uses configured model names, not hardcoded legacy names

# ============================================================

# REQUIRED COMMANDS

# ============================================================

rg "deepseek-chat|deepseek-reasoner|deepseek-v4|DeepSeek" .

npm test -- tests/models

npm test

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Agents/subagents used

- If none, explain why single-agent was better.

3. Files changed

4. Legacy DeepSeek references found

5. What was migrated

6. Governance checks

- cloud disabled by default
- no auto-enable
- no hardcoded pricing
- telemetry preserves exact model_id

7. Tests added/updated

8. Commands executed with results

9. Expansion Era alignment verdict
   PASS
   or
   PASS WITH NOTES

10. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21.0: DeepSeek V4 registry migration
