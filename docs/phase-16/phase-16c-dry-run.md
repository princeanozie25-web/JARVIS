# Phase 16C Hue Dry-Run Planning

## Status

Phase 16C.1 adds the Hue dry-run plan contract scaffold only. It is pure local planning from fixture/current-state metadata to a non-executable diff plan. Phase 16C.2 integrates that planner with the disabled Hue adapter through an explicit non-executing dry-run helper. Phase 16C.3 adds approval-facing metadata guards while keeping approval execution unavailable. Phase 16C.4 adds descriptive-only compensation metadata. Phase 16C.5 adds audit/event preview metadata guards. Phase 16C.6 closes the dry-run boundary with PASS WITH NOTES.

No real Hue reads are implemented. No real Hue writes are implemented. No network calls, SDK usage, discovery, cloud path, approval execution, or hardware access is added.

## Added Boundary

- `src/room/adapters/hue-dry-run.ts`
- `src/room/adapters/hue-adapter.ts`
- `tests/room/adapters/hue-dry-run.test.ts`
- `tests/room/adapters/hue-adapter.test.ts`
- `tests/room/phase-16c-closeout.test.ts`
- `docs/phase-16/phase-16c-closeout.md`

## Dry-Run Plan Metadata

Plans include:

- `plan_id`
- `adapter_kind: hue`
- `mode: dry_run`
- `source: local_hue_bridge`
- target light id
- intended state metadata
- current state snapshot when available
- unknown/unavailable current state metadata when no usable snapshot exists
- diff summary
- compensation metadata
- `approval_required: true`
- `approval_flow_available: false`
- `approval_execution_supported: false`
- `user_review_required: true`
- `expires_at_ms`
- plan summary and redacted summary metadata
- risk/action class metadata
- audit payload kind metadata
- replay-safe metadata
- redaction status metadata
- `persistence_attempted: false`
- `executable: false`
- `execution_supported: false`
- `network_called: false`
- `discovery_attempted: false`
- `cloud_attempted: false`
- `writes_attempted: false`
- `raw_payload_exposed: false`
- `raw_config_exposed: false`

## Supported Intended State Metadata

- on/off
- brightness
- color hex
- color temperature

The planner never guesses missing current state. Unknown and unreachable current state are represented explicitly in the diff as unknown metadata.

## Disabled Adapter Integration

`DisabledHueReadOnlyAdapter.createDryRunPlan()` accepts intended Hue state plus optional fixture/current snapshot metadata and returns a wrapped dry-run plan:

- `dry_run_source: fixture_current_state`
- `fixture_only: true`
- `approval_required: true`
- `executable: false`
- `execution_supported: false`
- `network_called: false`
- `discovery_attempted: false`
- `cloud_attempted: false`
- `writes_attempted: false`

The regular adapter contract methods remain disabled. `readState()` still returns unavailable metadata, and write/mutate paths still return disabled or not implemented.

## Approval Metadata Guard

Dry-run plans are reviewable but not executable:

- `approval_required` is always `true`.
- `approval_flow_available` is always `false`.
- `approval_execution_supported` is always `false`.
- `user_review_required` is always `true`.
- `canSubmitHueDryRunPlanForApproval(plan)` returns `allowed: false`.
- direct approval submission is denied with `approval_execution_not_implemented`.
- raw payloads, raw config refs, and raw API keys are not exposed.

Approval execution is deferred to a later Phase 16D/18 boundary.

## Compensation Metadata

Dry-run plans can describe compensation but never execute rollback:

- compensation is available only when current state is known and changed fields exist.
- compensation source is `current_state_snapshot` when available.
- unknown or unavailable current state produces compensation unavailable with an explicit reason.
- no changed fields produces compensation unavailable with `no_changed_fields`.
- `compensation_execution_supported` is always `false`.
- `compensation_requires_approval` is `true` only when a compensation hint exists.
- compensation plans are `descriptive_only`.
- compensation plans are not executable and rollback execution is unsupported.

Compensation execution is deferred to a later approval/rollback boundary.

## Event/Audit Metadata Guard

Dry-run plans are safe for future audit review but do not write events:

- `audit_event_supported` is always `false`.
- `event_recording_supported` is always `false`.
- `audit_payload_kind` is `metadata_only`.
- `replay_safe` is `true`.
- `redaction_status` is `redacted_metadata_only`.
- `buildHueDryRunAuditPreview(plan)` returns preview-only metadata.
- audit previews include provenance only: adapter kind, mode, source, target id, and plan id.
- `persistence_attempted` is always `false`.
- `ui_rendered` is always `false`.
- raw payloads, raw config refs, and raw API keys are not exposed.

Persistence/event-store wiring is deferred to a later boundary.

## Still Forbidden

- Persistence writes or event-store writes.
- `node-hue-api` or any Hue SDK dependency.
- HTTP, fetch, WebSocket, or network calls.
- Real Hue live reads.
- Real Hue writes.
- Dry-run execution.
- Approval execution.
- Compensation/rollback execution.
- Bridge discovery.
- Hue Cloud Remote API.
- Raw API key/config-ref exposure.
- Scenes, macros, schedules, or routines.
- Hardware access.

## Next Recommended Slice

Phase 16D.1 - Hue Approval-Gated Execution Boundary Scaffold.
