# ============================================================

# PHASE 21A.3

# VERIFICATION AGENT EXECUTOR

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Phase 21A Verification Agent
- Verification Agent contract
- Verification Agent planner
- DeepSeek runtime integration
- Phase 13 model runtime
- Phase 19 telemetry/governance

Goal:

Create the Verification Agent executor.

This slice adds the execution boundary, but must support safe mock execution for CI
and fail closed when DeepSeek is not explicitly enabled.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- rewrite the primary answer automatically
- hide caveats
- store raw prompt/answer/verifier body in telemetry
- bypass cost governance
- bypass cloud disabled-by-default
- claim verification as truth
- require a real API key in CI

# REQUIRED WORK

1. Executor function

Implement:

executeVerificationRequest()

Input:

- VerificationAgentRequest
- Verification plan
- injected verifier runtime/provider

Output:

- VerificationAgentResult
- metadata-only telemetry
- advisory-only status

2. Provider behavior

Must:

- support mock verifier provider for tests
- fail closed if provider unavailable
- fail closed if verification not required
- preserve verifier_model_id
- preserve risk flags/evidence notes

3. DeepSeek readiness

Prepare for:

- deepseek-v4-flash verifier execution
- no live API call required in CI

4. Governance

Prove:

- verifier cannot rewrite primary answer
- verifier output is advisory only
- raw answer/prompts are not stored in telemetry
- failed provider returns safe unavailable result

5. Tests

Add tests for:

- mock verification success
- provider unavailable fail-closed
- verification not required skip
- advisory-only result
- telemetry metadata-only
- no raw answer leakage
- no direct network/model provider import unless injected

# REQUIRED COMMANDS

npm test -- src/lib/verification-agent

npm test

npx tsc --noEmit

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Executor implemented
4. Provider behavior
5. DeepSeek readiness
6. Governance checks
7. Tests added/updated
8. Commands executed
9. Expansion Era verdict
10. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21A.3: add verification agent executor
