# ============================================================

# P0.1.b - DEEPSEEK REAL PROVIDER ACTIVATION

# ============================================================

Architecture Anchor:

- docs/architecture/EXPANSION_ERA.docx
- Expansion Era rule: no scaffold-only feature closeout.
- Phase 13 model runtime contracts are frozen.

Goal:

Make DeepSeek usable as a real provider path.

After this slice, Prince should be able to add DEEPSEEK_API_KEY, enable the DeepSeek registry entries intentionally, run one smoke command, and verify both:

- deepseek-v4-flash
- deepseek-v4-pro

are callable through the existing model runtime/provider path.

# ============================================================

# SUBAGENTS

# ============================================================

If available, spawn:

- Provider Activation Agent
- Env/Config Agent
- Smoke Harness Agent
- Telemetry Agent
- Governance Reviewer Agent
- Final Reviewer Agent

Use one agent only if the repo coupling makes parallel work unsafe.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

Do NOT auto-enable DeepSeek by default.

Do NOT bypass the existing router/runtime/cost governance.

Do NOT print secrets.

Do NOT store raw prompts or raw responses in telemetry.

Do NOT redesign Phase 13.

Do NOT close this as registry-only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Add env support.

Document and validate:

- DEEPSEEK_API_KEY
- any existing provider base URL env if already used

2. Add/verify DeepSeek provider activation.

The provider must:

- use configured model names
- call the OpenAI-compatible provider path if that is the existing architecture
- fail closed when API key is missing
- fail closed when provider is disabled
- preserve exact model_id in telemetry

3. Add a manual smoke command.

Preferred:

npm run smoke:deepseek

The smoke command must:

- skip safely if DEEPSEEK_API_KEY is missing
- explain how to enable DeepSeek intentionally
- call deepseek-v4-flash when enabled
- call deepseek-v4-pro when enabled
- print success/failure metadata
- print exact model_id
- print latency
- never print the API key
- avoid raw prompt/response output unless existing smoke convention requires it

4. Add tests.

Tests must prove:

- missing key fails closed
- disabled provider refuses execution
- configured V4 model IDs are used exactly
- smoke harness skips safely without key
- telemetry preserves exact model_id
- cloud is not silently auto-routed

5. Add docs.

Add a short docs section explaining:

- where to put DEEPSEEK_API_KEY
- how to intentionally enable DeepSeek
- how to run the smoke command
- what success looks like
- how to disable it again

# ============================================================

# REQUIRED COMMANDS

# ============================================================

rg "DEEPSEEK|deepseek-v4|deepseek-chat|deepseek-reasoner" .

npm test -- tests/models

npm test -- --testTimeout=90000

npm run smoke:deepseek

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Agents/subagents used

3. Files changed

4. Real activation implemented

5. How Prince enables DeepSeek locally

6. Smoke command and expected output

7. Governance checks

8. Tests added/updated

9. Commands executed with results

10. Expansion Era real-integration verdict
    PASS
    or
    PASS WITH NOTES

11. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21.0b: enable DeepSeek real provider smoke
