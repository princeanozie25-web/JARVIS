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

Phase 4E may add library-only intent coordination on top of the Phase 4D pipeline. Phase 4E includes a metadata-only barge-in coordinator that accepts explicit interrupt intents, selects safe orchestration actions, and advances an internal state machine.

Current Phase 4E status: complete and frozen.

Frozen Phase 4E safety invariants:

- accepts metadata-only interrupt/barge-in intents
- maps intents to cancellation/interruption preparation actions
- tracks metadata-only states from `idle` through cancellation, pending-work clearing, optional capture preparation, and terminal completion/failure
- records terminal, idempotent half-spoken/preemption metadata for accepted interrupted turns
- records metadata-only new-capture re-arm intent/result records after accepted intents that explicitly prepare capture
- guards in-flight barge-in terminal transitions so rapid repeated or mixed intents cannot duplicate pipeline cancellation/interruption calls
- rejects invalid or terminal-state transitions as no-ops
- calls only the Phase 4D pipeline boundary for cancellation or interruption
- emits only metadata-only telemetry for every Phase 4E lifecycle event
- does not listen to microphones, keyboards, wake words, UI events, browser events, playback devices, chat, runtime commands, approvals, Realtime, or cloud APIs

Phase 4E intent metadata may contain only:

- barge-in intent ID
- session ID
- turn ID
- intent category
- stream ID
- response ID
- playback intent ID
- created timestamp

Phase 4E preemption records may contain only:

- session ID
- turn ID
- interruption timestamp
- last ready chunk index
- last sequenced chunk index
- pending chunk count
- interrupt/preemption reason category

Preemption records must not contain transcript text, spoken text, assistant response body text, audio URLs, audio blobs, PCM data, raw audio, chat payloads, runtime command payloads, or approval execution payloads.

Phase 4E capture re-arm records may contain only:

- session ID
- turn ID
- barge-in intent ID
- re-arm state
- request/completion timestamps
- interrupt/preemption reason category
- metadata-only blocked reason

Capture re-arm coordination does not access microphones, keyboards, UI surfaces, browser device APIs, playback devices, chat submission, runtime commands, approvals, Realtime, or cloud APIs. It only produces records and telemetry that a future explicitly wired adapter may inspect.

## Phase 4F Handoff Points

Phase 4F starts with a metadata-only runtime boundary coordinator. It accepts safe runtime lifecycle metadata and produces advisory records only. It cannot execute runtime commands, approve actions, bypass approvals, speak tool output, synthesize restricted content, or control runtime cancellation.

Current Phase 4F status:

- accepts metadata-only runtime boundary events for pending approvals, tool lifecycle, and runtime cancellation lifecycle
- produces advisory-only metadata records
- rejects voice approval attempts as metadata-only no-ops
- treats runtime cancellation requests as advisory-only and does not stop tools
- emits metadata-only boundary telemetry
- does not import or call runtime command execution modules
- does not import or call approval execution modules
- does not synthesize, speak, persist, or emit tool output, file content, code blocks, personal context content, audit log content, transcripts, assistant body text, or audio data

Phase 4F runtime boundary metadata may contain only:

- boundary event ID
- boundary event type
- advisory ID
- advisory action/state
- session ID
- turn ID
- runtime call ID
- approval request ID
- tool name
- timestamps
- metadata-only rejection reason

Future Phase 4F work may choose explicit, reviewable adapters for user-controlled capture, synthesis, playback, runtime status display, or approval UI. Those adapters must preserve the Phase 4D/4E/4F boundaries:

- metadata-only telemetry
- no implicit autoplay
- no microphone access without explicit user action and permission handling
- no keyboard or UI listeners inside the library layer
- no command execution
- no approval bypass
- no voice approval path
- no spoken tool output or restricted content
- no wake word or always-listening behavior
- explicit user-controlled wiring
- terminal and stale-session guards at every async boundary
