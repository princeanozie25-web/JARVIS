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

## Phase 4F Runtime Boundary Freeze

Phase 4F starts with a metadata-only runtime boundary coordinator. It accepts safe runtime lifecycle metadata and produces advisory records only. It cannot execute runtime commands, approve actions, bypass approvals, speak tool output, synthesize restricted content, or control runtime cancellation.

Current Phase 4F status: complete and frozen.

Frozen Phase 4F safety invariants:

- accepts metadata-only runtime boundary events for pending approvals, tool lifecycle, and runtime cancellation lifecycle
- produces advisory-only metadata records
- tracks advisory lifecycle states from observation through on-screen-confirmation wait, metadata-only acknowledgement/denial/completion/failure, rejection, and no-op
- orders runtime/tool lifecycle metadata deterministically per runtime operation ID
- suppresses duplicate lifecycle events and marks completed/failed/cancel-ack events that arrive before their prerequisite metadata as out-of-order observations
- rejects stale/non-active session runtime boundary events when active-session ownership is provided
- rejects voice approval attempts as refusal records and requires on-screen confirmation
- rejects spoken yes/confirm/approve, inferred consent, ambiguous voice responses, and replayed voice responses
- treats runtime cancellation requests as advisory-only and does not stop tools
- accepts metadata-only restricted-content descriptors and classifies whether they may ever be treated as speech metadata
- allows only `assistant_prose_metadata` descriptors and blocks tool output, file content, code blocks, personal context, audit logs, runtime output, transcripts, and unknown restricted classes
- emits metadata-only boundary telemetry
- does not import or call runtime command execution modules
- does not import or call approval execution modules
- does not synthesize, speak, persist, or emit tool output, file content, code blocks, personal context content, audit log content, runtime output, transcripts, assistant body text, or audio data

Phase 4F forbidden wiring:

- runtime command execution
- approval execution
- approval bypass
- voice approvals
- spoken approval acceptance
- TTS execution
- autoplay or playback start
- chat UI wiring or auto-submit
- microphone or device APIs
- keyboard listeners
- UI/browser event wiring
- OpenAI Realtime or cloud streaming
- wake word or always-listening behavior

Phase 4F runtime boundary metadata may contain only:

- boundary event ID
- boundary event type
- advisory ID
- advisory action/state
- advisory lifecycle ordering issue
- runtime operation ID
- session ID
- turn ID
- runtime call ID
- approval request ID
- tool name
- timestamps
- metadata-only rejection reason
- voice approval attempt category
- voice approval refusal ID/action

Runtime boundary telemetry must not include approval request IDs, approval payloads, tool output, file content, code blocks, personal context content, audit log content, transcripts, spoken text, assistant body text, audio URLs, audio blobs, PCM data, raw audio, chat payloads, or runtime command payloads.

Phase 4F restricted-content boundary metadata may contain only:

- descriptor ID
- decision record ID
- content classification
- metadata-only decision
- session ID
- turn ID
- content reference ID
- source ID
- timestamps
- terminal/no-op state

Restricted-content descriptors and decision records must not contain actual content bodies, tool output, file content, code blocks, personal context content, audit log content, runtime output, transcripts, spoken text, assistant body text, audio URLs, audio blobs, PCM data, raw audio, chat payloads, runtime command payloads, or approval execution payloads.

## Phase 4G Cloud Routing Policy Scaffold

Phase 4G starts with disabled-by-default cloud voice routing, consent/disclosure, and budget policy scaffolds. They evaluate metadata-only requests and return allow/deny metadata only. They do not call provider SDKs, use API keys, open network connections, execute runtime commands, approve actions, synthesize audio, start playback, or wire to chat, microphone, keyboard, UI, browser, wake-word, or always-listening behavior.

Current Phase 4G status: scaffold started.

Phase 4G policy metadata may contain only:

- policy request ID
- policy record ID
- provider ID
- requested capability
- policy state
- allow/deny decision
- metadata-only denial reason
- session ID
- consent granted boolean
- cost disclosure accepted boolean
- budget available boolean
- local fallback available boolean
- timestamps

Phase 4G budget guard metadata may contain only:

- budget request ID
- budget record ID
- provider ID
- requested capability
- estimated minutes
- estimated cost units
- request count
- configured limit count
- per-session, daily, and monthly usage totals
- budget window and dimension
- budget limit
- projected usage
- metadata-only budget decision
- timestamps

Phase 4G consent/disclosure policy metadata may contain only:

- consent policy request ID
- consent policy record ID
- provider ID
- requested capability
- consent state
- disclosure state
- metadata-only consent/disclosure decision
- consent granted boolean
- cost disclosure accepted boolean
- provider retention disclosure accepted boolean
- audio leaves device disclosure accepted boolean
- transcript leaves device disclosure accepted boolean
- session ID
- timestamps

Phase 4G cloud provider identifiers are policy labels only:

- `disabled`
- `openai_realtime`
- `cloud_stt`
- `cloud_tts`

Phase 4G routing policy states:

- `disabled`
- `consent_required`
- `cost_disclosure_required`
- `budget_required`
- `eligible_metadata_only`
- `denied`

Phase 4G budget windows:

- `per_session`
- `daily`
- `monthly`

Phase 4G budget dimensions:

- `estimated_minutes`
- `estimated_cost_units`
- `request_count`

Phase 4G budget decisions:

- `allowed_metadata_only`
- `denied_budget_missing`
- `denied_budget_exceeded`
- `denied_invalid_estimate`
- `denied_provider_disabled`

Phase 4G consent/disclosure decisions:

- `allowed_metadata_only`
- `denied_consent_missing`
- `denied_cost_disclosure_missing`
- `denied_retention_disclosure_missing`
- `denied_audio_disclosure_missing`
- `denied_transcript_disclosure_missing`
- `denied_provider_disabled`

Phase 4G forbidden wiring:

- OpenAI Realtime calls
- cloud STT/TTS calls
- provider SDK imports
- network calls
- API key access
- runtime execution
- approval execution or bypass
- voice approvals
- TTS execution
- autoplay or playback start
- chat UI wiring or auto-submit
- microphone, keyboard, UI, or browser APIs
- wake word or always-listening behavior

Phase 4G does not include real provider pricing tables. Estimated cost units and limits must be passed in as explicit metadata/config by future reviewed adapters.

Phase 4G cloud routing remains ineligible unless consent, cost disclosure, provider retention disclosure, audio-leaves-device disclosure, transcript-leaves-device disclosure, and budget guard metadata all pass.

Phase 4G telemetry must not include transcript text, spoken text, assistant body text, tool output, file content, code blocks, personal context content, audit log content, approval payloads, approval IDs, API keys, audio URLs, audio blobs, PCM data, raw audio, chat payloads, or runtime command payloads.

## Phase 4H Handoff Points

Future Phase 4H work may choose explicit, reviewable adapters for user-controlled capture, synthesis, playback, runtime status display, approval UI, or cloud routing. Those adapters must preserve the Phase 4D/4E/4F/4G boundaries:

- metadata-only telemetry
- no implicit autoplay
- no microphone access without explicit user action and permission handling
- no keyboard or UI listeners inside the library layer
- no command execution
- no approval bypass
- no voice approval path
- no spoken approval acceptance
- no spoken tool output or restricted content
- no cloud routing unless explicit consent, cost disclosure, provider retention disclosure, audio/transcript device-boundary disclosure, routing policy, and budget guard policy pass
- no wake word or always-listening behavior
- explicit user-controlled wiring
- terminal and stale-session guards at every async boundary
