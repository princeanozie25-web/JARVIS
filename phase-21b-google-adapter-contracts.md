# ============================================================

# PHASE 21B.1

# GOOGLE ADAPTER CONTRACTS

# ============================================================

Architecture Anchor:

- EXPANSION_ERA.docx
- Phase 21B MCP Service Adapters
- Gmail
- Calendar
- Drive
- Phase 18 approval lifecycle
- Librarian
- Verification Agent

Goal:

Create the Google adapter contracts.

No OAuth.

No Google API calls.

No live integrations.

Contract layer only.

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

Contracts only.

# ============================================================

# REQUIRED WORK

# ============================================================

1. Gmail contract

Define request/result contracts for:

- search messages
- fetch message metadata
- fetch thread metadata
- fetch attachment metadata

Metadata only.

No bodies required.

2. Calendar contract

Define request/result contracts for:

- list events
- fetch event metadata
- availability metadata
- meeting metadata

3. Drive contract

Define request/result contracts for:

- file metadata
- folder metadata
- document metadata

No file download implementation.

4. Authority model

Classify operations:

T0

- metadata read

T1

- content read

T2

- draft generation

T3

- send/delete/mutate

Map each operation.

5. Librarian integration

Define how Gmail/Calendar/Drive outputs become source envelopes.

6. Verification integration

Define verification metadata support.

7. Governance tests

Prove:

- no OAuth
- no API clients
- no token storage
- no network calls
- no background sync

# ============================================================

# REQUIRED COMMANDS

# ============================================================

npm test

npx tsc --noEmit

git diff --check

# ============================================================

# FINAL RESPONSE FORMAT

# ============================================================

1. Effort level

2. Files changed

3. Gmail contract

4. Calendar contract

5. Drive contract

6. Authority model

7. Librarian integration

8. Verification integration

9. Governance checks

10. Tests added/updated

11. Commands executed

12. Expansion Era verdict

13. Suggested commit message

# ============================================================

# SUGGESTED COMMIT MESSAGE

# ============================================================

Phase 21B.1: add Google adapter contracts
