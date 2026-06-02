# ============================================================

# PHASE 21

# LIVE LLM WIKI DRAFT VERIFICATION

# ============================================================

Goal:

Verify that `npm run wiki:draft` can generate a real Markdown preview using DeepSeek V4 Flash.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- write Obsidian notes
- execute Vault Write Gateway
- mutate vault contents
- add schedulers/watchers/background jobs
- print API keys
- print raw full source bodies

# REQUIRED WORK

1. Check configuration

Verify:

- DEEPSEEK_API_KEY exists
- `deepseek-v4-flash` is intentionally enabled in `config/models/registry.yaml`

If missing, fail closed and report exact blocker.

2. Run live draft preview

Run:

npm run wiki:draft

Expected:

- provider_status: available
- model_id: deepseek-v4-flash
- draft_generated: true
- write_attempted: false
- vault_mutated: false

3. Governance verification

Confirm:

- no vault writes
- no note creation
- no Gateway execution
- no raw prompt/response persisted
- attribution block included

4. Tests

Run required validation.

# REQUIRED COMMANDS

npm run wiki:draft
npm test -- src/lib/obsidian
npx tsc --noEmit
npm test
git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. DeepSeek config status
4. Live draft result
5. Draft preview summary
6. Governance checks
7. Commands executed
8. Expansion Era verdict
9. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21: verify live LLM Wiki draft preview
