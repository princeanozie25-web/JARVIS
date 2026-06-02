# ============================================================

# PHASE 21B.2

# GOOGLE READ-ONLY ADAPTER PLANNER

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Phase 21B Google adapter contracts
- Gmail / Calendar / Drive metadata contracts
- Librarian integration
- Verification Agent integration

Goal:

Create a read-only Google adapter planner with injected mock adapters.

This slice should make Google metadata workflows testable without OAuth or live Google API calls.

# ============================================================

# SINGLE AGENT ONLY

# ============================================================

Do not spawn subagents.

# ============================================================

# HARD CONSTRAINTS

# ============================================================

DO NOT:

- implement OAuth
- call Gmail
- call Calendar
- call Drive
- store tokens
- persist credentials
- add network calls
- add background sync
- add schedulers
- mutate email/calendar/drive data

Injected mock/read-only adapters only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Planner/executor boundary

Implement read-only planner functions for:

- Gmail metadata search
- Gmail message/thread metadata fetch
- Calendar event metadata list/fetch
- Drive file/folder/document metadata fetch

2. Injected adapter interface

Define adapter interfaces that can be mocked in tests.

No real Google SDK imports.

3. Metadata-only results

Ensure results contain metadata only.

No Gmail body content.

No Drive file content.

No Calendar private content beyond metadata contract.

4. Librarian bridge

Project Google metadata results into Librarian ingestion envelopes.

No durable promotion.

No vault writes.

5. Verification bridge

Project Google metadata into verification source metadata.

6. Governance behavior

Return fail-closed unavailable results when adapter is missing.

7. Tests

Prove:

- mock Gmail metadata search works
- mock Calendar metadata list works
- mock Drive metadata fetch works
- adapter missing fails closed
- metadata-only output
- no OAuth/token/network imports
- no mutation operations exist

# ============================================================

# REQUIRED COMMANDS

# ============================================================

npm test -- src/lib/google-adapters

npx tsc --noEmit

npm test

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Files changed

3. Planner/executor boundary implemented

4. Adapter interface behavior

5. Gmail behavior

6. Calendar behavior

7. Drive behavior

8. Librarian/Verification bridge

9. Governance checks

10. Tests added/updated

11. Commands executed

12. Expansion Era verdict

13. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21B.2: add Google read-only adapter planner
