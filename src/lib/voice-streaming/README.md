# Voice Streaming Orchestration

Phase 4D is a library-only realtime voice orchestration scaffold. It coordinates metadata-only assistant response stream events through scheduling, synthesis queueing, playback sequencing intents, terminal lifecycle handling, and readiness tracking.

## Purpose

- Accept assistant response stream metadata events.
- Produce safe chunk scheduling, synthesis queue, and playback sequencing intents.
- Preserve ordering, queue limits, active-session ownership, terminal cleanup, and readiness state.
- Expose passive readiness metadata, including first-ready detection and manually invoked starvation checks.

## Safety Invariants

- Exactly one active voice session can own scheduling, synthesis queueing, and playback sequencing at a time.
- Stale, late, duplicate, terminal, and non-active-session work is rejected before downstream work is created.
- Cancellation, interruption, completion, and failure are idempotent terminal transitions.
- Pending scheduler, synthesis, and playback queues are cleared on terminal transitions.
- Readiness records become terminal when the owning session becomes terminal.
- Starvation detection is manual/test-controlled and does not install live timers.
- `canAutoplay` remains false.

## Allowed Data

The Phase 4D pipeline may handle only metadata required for orchestration:

- session IDs
- stream IDs
- response IDs
- chunk IDs
- chunk indexes
- scheduling intent IDs
- synthesis queue item IDs
- playback intent IDs
- readiness states and timestamps
- metadata-only failure classes and reasons
- queue counts and terminal lifecycle counts

## Forbidden Data

The Phase 4D pipeline must not ingest, persist, emit, or log:

- transcript text
- spoken text
- assistant response body text
- audio bytes
- audio URLs or audio payloads
- chat message content
- runtime command payloads
- approval execution payloads

## Non-Wiring Status

Phase 4D is intentionally not connected to:

- chat UI
- chat submission
- auto-submit flows
- runtime command execution
- approval bypass or approval execution
- autoplay
- OpenAI Realtime
- cloud streaming APIs

The playback sequencer produces sequencing intents only. It does not start playback.

## Phase 4E Handoff Points

Future Phase 4E work may choose explicit, reviewable adapters for real synthesis or playback, but those adapters must preserve the Phase 4D boundaries:

- metadata-only telemetry
- no implicit autoplay
- no command execution
- no approval bypass
- explicit user-controlled wiring
- terminal and stale-session guards at every async boundary
