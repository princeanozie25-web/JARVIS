# ============================================================

# PHASE 21B.4

# GOOGLE CONSENT RUNBOOK + SETUP CLI STUB

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Phase 21B Google adapter contracts
- Google OAuth readiness plan
- Phase 18 approval lifecycle
- Phase 19 governance/telemetry

Goal:

Create a safe setup runbook and CLI readiness command for future Google OAuth setup.

No live OAuth.

No Google API calls.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- run OAuth
- open browser login
- generate authorization URLs
- call Google APIs
- store tokens
- add Google SDK live execution
- add background sync
- add schedulers
- mutate Gmail/Calendar/Drive

# REQUIRED WORK

1. Add setup runbook

Document:

- what permissions JARVIS will eventually request
- why each permission exists
- what is read-only
- what is explicitly not allowed
- where credentials/tokens may live
- how to revoke access
- how to verify config safely

2. Add CLI readiness command

Add something like:

npm run google:readiness

It should:

- call the pure OAuth readiness checker
- print setup state
- print missing config fields
- print redacted metadata only
- never print tokens/secrets
- never generate auth URL
- never call Google

3. Tests

Prove:

- CLI prints redacted readiness
- missing config fails safely
- no tokens printed
- no OAuth/API/network imports
- no scheduler/background sync

# REQUIRED COMMANDS

npm test -- src/lib/google-adapters

npx tsc --noEmit

npm test

npm run google:readiness

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level

2. Files changed

3. Runbook added

4. CLI command added

5. Readiness output

6. Governance checks

7. Tests added/updated

8. Commands executed

9. Expansion Era verdict

10. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21B.4: add Google consent runbook and readiness CLI
