# ============================================================

# PHASE 21A.5

# VERIFICATION AGENT UI CONFIDENCE SURFACE

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Verification Agent contract/planner/executor
- Phase 12 Command Center UI
- Phase 19 telemetry/governance visual surfaces

Goal:

Add the UI contract/rendering surface for verification metadata.

This slice must render confidence/caveat/risk metadata only.
No live model calls.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- call DeepSeek
- call any model
- rewrite answer text
- hide caveats
- display verification as absolute truth
- expose raw prompts/answers/verifier bodies
- add execution or approval surfaces

# REQUIRED WORK

1. Locate existing Command Center answer/result UI surfaces.

2. Add reusable UI/view-model support for:

- confidence chip
- caveat tooltip/summary
- risk flag badges
- advisory-only label

3. Support states:

- unverified
- verified
- unavailable
- skipped
- failed

4. Render risk flags:

- unsupported_claim
- outdated_information
- insufficient_sources
- overconfident_answer
- safety_sensitive
- conflicting_context
- model_disagreement

5. Tests:

- confidence/caveat render
- low confidence is visually/signally distinct
- advisory-only label exists
- unavailable/fail-closed state renders clearly
- no raw answer/verifier body is required
- no execution buttons or approval controls are introduced

# REQUIRED COMMANDS

npm test
npx tsc --noEmit
git diff --check

# FINAL RESPONSE FORMAT

1. Effort level
2. Files changed
3. UI surface implemented
4. States supported
5. Risk/caveat behavior
6. Governance checks
7. Tests added/updated
8. Commands executed
9. Expansion Era verdict
10. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21A.5: add verification confidence UI surface
