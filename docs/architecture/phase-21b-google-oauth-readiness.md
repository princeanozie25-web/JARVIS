# Phase 21B.3 Google OAuth Readiness

This is a readiness plan only. It does not run OAuth, generate authorization URLs, refresh tokens, call Google APIs, or enable background sync.

## Minimum Future Scopes

- Gmail metadata/search: `https://www.googleapis.com/auth/gmail.metadata`
- Calendar event metadata: `https://www.googleapis.com/auth/calendar.events.readonly`
- Calendar availability metadata: `https://www.googleapis.com/auth/calendar.freebusy`
- Drive metadata: `https://www.googleapis.com/auth/drive.metadata.readonly`

Before live OAuth is enabled, these scopes must be re-verified against current Google documentation and the final adapter operation list.

## Token Storage Policy

Allowed future token locations:

- OS secret manager or keychain
- Encrypted local secret store outside the repository
- User-local `.env.local` metadata flags only, never raw token values

Forbidden token locations:

- Git repository files
- Obsidian vault notes
- SQLite event store
- Vector store
- Telemetry events
- Logs, screenshots, test snapshots, or generated docs

Redaction rules:

- Telemetry may record only token metadata presence, hash references, expiry status, and storage class.
- Raw access tokens, refresh tokens, client secrets, authorization codes, and OAuth responses must never be logged.
- Any future token hash must use a one-way reference hash and must not be sufficient for authentication.

Rotation and revocation:

- Revoked tokens must move readiness to `revoked`.
- Expired tokens must move readiness to `expired`; no background refresh is allowed in this phase.
- Token rotation must be explicit and user-initiated in a later OAuth execution slice.

`.gitignore` expectations for the future live slice:

- `.env.local`
- `.env*.local`
- `.jarvis/google-oauth/`
- `secrets/`

## Setup Checklist For Prince

1. Create or select a Google Cloud OAuth client for local desktop or installed-app usage.
2. Keep the client secret outside the repo.
3. Confirm requested scopes are still the minimum read-only metadata scopes.
4. Add only non-secret readiness flags or secret-file paths to local config.
5. Run the readiness checker before attempting authorization.
6. Confirm the checker reports no mutation scopes, no background refresh, and no token values in telemetry.
7. Only then move to a future live OAuth slice.
