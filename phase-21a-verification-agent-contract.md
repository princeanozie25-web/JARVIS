# ============================================================

# PHASE 21A.1

# VERIFICATION AGENT CONTRACT

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Phase 21A DeepSeek V4 Verification Agent
- DeepSeek V4 runtime integration
- Phase 13 model runtime
- Phase 19 telemetry/governance
- Command Center answer metadata

Goal:

Define the Verification Agent contract.

The Verification Agent reviews a primary model answer and returns:

- verified answer status
- confidence
- caveat
- evidence notes
- risk flags

This is a contract slice.

No live DeepSeek call yet.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- call DeepSeek
- call any model
- rewrite answer text automatically
- hide caveats from UI
- store raw answer bodies in telemetry
- bypass cost governance
- create autonomous truth claims

# REQUIRED WORK

1. Contract

Define input:

- original user query metadata
- primary answer metadata
- answer summary or bounded answer text
- model id
- task class
- optional source metadata

Define output:

- verification_status
- confidence: high | medium | low
- caveat
- risk_flags
- evidence_notes
- verifier_model_id
- cost_estimate
- telemetry_metadata

2. Confidence schema

Support:

- high
- medium
- low
- unknown

3. Risk flags

Include at least:

- unsupported_claim
- outdated_information
- insufficient_sources
- overconfident_answer
- safety_sensitive
- conflicting_context
- model_disagreement

4. Telemetry rules

Metadata only.

No raw prompt.
No raw answer body.
No raw verifier response.

5. UI contract

Define what Command Center should eventually render:

- confidence chip
- caveat tooltip
- risk flag badges

No UI implementation yet.

6. Tests

Prove:

- schema validation
- no raw bodies in telemetry
- confidence/caveat required
- risk flags are typed
- verifier is advisory only
- no model/provider imports

# REQUIRED COMMANDS

npm test

npx tsc --noEmit

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. Verification contract implemented
4. Confidence/risk model
5. Telemetry rules
6. UI contract
7. Governance checks
8. Tests added/updated
9. Commands executed
10. Expansion Era verdict
11. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21A.1: add verification agent contract
