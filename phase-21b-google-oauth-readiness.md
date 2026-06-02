# ============================================================

# PHASE 21B.3

# GOOGLE OAUTH READINESS PLAN

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Phase 21B Google adapter contracts
- Google read-only adapter planner
- Phase 18 approval lifecycle
- Phase 19 governance/telemetry
- Librarian and Verification Agent integrations

Goal:

Design the safe OAuth/auth readiness layer for Gmail, Calendar, and Drive.

No live OAuth yet.

# SINGLE AGENT ONLY

Do not spawn subagents.

# HARD CONSTRAINTS

DO NOT:

- run OAuth
- open browser login
- store tokens
- call Google APIs
- add live Google SDK execution
- add background sync
- add schedulers
- mutate Gmail/Calendar/Drive

# REQUIRED WORK

1. Scope policy

Define minimum scopes for future read-only metadata access:

- Gmail metadata/search
- Calendar readonly metadata
- Drive metadata readonly

2. Token storage policy

Define:

- where tokens may live
- where tokens must not live
- redaction rules
- rotation/revocation notes
- `.gitignore` expectations

3. OAuth readiness contract

Define setup states:

- not_configured
- client_config_present
- user_authorization_required
- authorized
- expired
- revoked
- unavailable

4. Adapter readiness checker

Implement pure config/readiness checker.

No OAuth call.

No token parsing beyond metadata presence.

5. Governance

Prove:

- no token values in telemetry
- no API calls
- no OAuth URLs generated yet
- no background refresh
- no mutation scopes

6. Docs

Add setup checklist for Prince to run later when home.

# REQUIRED COMMANDS

npm test -- src/lib/google-adapters

npx tsc --noEmit

npm test

git diff --check

# FINAL RESPONSE FORMAT

1. Effort level

2. Files changed

3. Scope policy

4. Token storage policy

5. OAuth readiness states

6. Readiness checker

7. Governance checks

8. Tests added/updated

9. Commands executed

10. Expansion Era verdict

11. Suggested commit message

# SUGGESTED COMMIT MESSAGE

Phase 21B.3: add Google OAuth readiness plan
