# Phase 21B.4 Google Consent Runbook

This runbook prepares future Google OAuth setup for Gmail, Calendar, and Drive metadata access. It does not authorize Google, generate authorization URLs, call Google APIs, store tokens, or enable background sync.

## Permissions JARVIS Will Eventually Request

Gmail:

- `https://www.googleapis.com/auth/gmail.metadata`
- Purpose: search message metadata and fetch message, thread, and attachment metadata.
- Read-only intent: metadata only; no message body access.

Calendar:

- `https://www.googleapis.com/auth/calendar.events.readonly`
- Purpose: list and fetch event metadata.
- `https://www.googleapis.com/auth/calendar.freebusy`
- Purpose: retrieve availability metadata.
- Read-only intent: event and availability metadata only.

Drive:

- `https://www.googleapis.com/auth/drive.metadata.readonly`
- Purpose: fetch file, folder, and document metadata.
- Read-only intent: metadata only; no file download/export.

## Explicitly Not Allowed

- Sending, deleting, modifying, or labeling Gmail messages.
- Creating, updating, deleting, or inviting Calendar events.
- Downloading, exporting, editing, moving, deleting, or sharing Drive files.
- Background sync, watchers, schedulers, or refresh loops.
- Raw token values, client secrets, authorization codes, OAuth responses, raw message bodies, raw file bodies, or raw calendar descriptions in telemetry.

## Credential And Token Storage

Allowed future locations:

- OS secret manager/keychain.
- Encrypted user-local secret store outside the repository.
- `.env.local` metadata flags and hash references only.

Forbidden locations:

- Git repository files.
- Obsidian vault notes.
- SQLite event store.
- Vector store.
- Telemetry events.
- Logs, screenshots, docs, or test snapshots.

Expected local ignores for a future live OAuth slice:

- `.env.local`
- `.env*.local`
- `.jarvis/google-oauth/`
- `secrets/`

## Revocation

Future revocation should happen through the Google account security console. After revocation, the readiness checker should report `revoked` once local metadata records the revocation timestamp.

## Safe Verification

Run:

```powershell
npm run google:readiness
```

The command prints only readiness state, missing config fields, scope counts, missing scope names, and metadata-only governance flags. It must not print token values or secrets and must not generate an authorization URL.
