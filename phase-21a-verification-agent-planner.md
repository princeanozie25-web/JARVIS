# ============================================================

# PHASE 21A.2

# VERIFICATION AGENT PLANNER

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Verification Agent contract
- DeepSeek runtime
- Phase 13 model runtime
- Phase 19 telemetry
- Command Center metadata surfaces

Goal:

Create the Verification Agent planner.

The planner decides:

- whether verification is needed
- verification scope
- verification intensity
- expected confidence level
- required evidence

No model calls.

# ============================================================

# SINGLE AGENT ONLY

# ============================================================

Do not spawn subagents.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

DO NOT:

- call DeepSeek
- call any model
- rewrite answers
- create truth claims
- modify answer text
- create UI
- store raw answer bodies

Planner only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Planner function

Implement:

planVerificationRequest()

Input:

- query metadata
- answer metadata
- task class
- source metadata
- confidence hints

Output:

- verification_required
- verification_scope
- verification_intensity
- evidence_requirements
- risk_flags
- estimated_cost_band
- write_attempted: false

2. Verification scope

Support:

- none
- light
- normal
- deep

3. Verification intensity

Support:

- low
- medium
- high

4. Evidence requirements

Support:

- source_presence
- source_consistency
- date_freshness
- answer_consistency
- model_crosscheck

5. Risk-based planning

Map risk flags to verification levels.

6. Telemetry

Metadata only.

7. Tests

Prove:

- no model calls
- no provider imports
- no raw bodies
- deterministic planning
- risk escalation works

# ============================================================

# REQUIRED COMMANDS

# ============================================================

npm test -- src/lib/verification-agent

npm test

npx tsc --noEmit

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level
2. Files changed
3. Planner implemented
4. Scope model
5. Risk escalation behavior
6. Telemetry behavior
7. Tests added/updated
8. Commands executed
9. Expansion Era verdict
10. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21A.2: add verification agent planner
