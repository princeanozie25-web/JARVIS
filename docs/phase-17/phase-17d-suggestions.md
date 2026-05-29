# Phase 17D Suggestion Output Contracts

## Status

Contract Scaffold Only.

Phase 17D begins suggestion output and inbox contract work. Phase 17D.1 defines an empty metadata-only suggestion shape, but it does not generate suggestions, create inbox items, persist output, bridge to approvals, execute actions, read stores, call tools, or use network/cloud services.

## Supported Suggestion Kinds

- `next_action`
- `cost_review`
- `project_progress`
- `calibration_review`
- `self_audit_followup`

## Suggestion Contract

The Phase 17D.1 routine suggestion contract includes:

- `suggestion_id`
- `routine_id`
- `source_report_id`
- `suggestion_kind`
- `metadata_only: true`
- `suggestion_generated: false`
- `body_generated: false`
- `raw_body_allowed: false`
- `redaction_required: true`
- `persistence_supported: false`
- `persistence_attempted: false`
- `approval_bridge_supported: false`
- `approval_bridge_attempted: false`
- `action_execution_supported: false`
- `action_execution_attempted: false`

`createEmptyRoutineSuggestion(...)` creates an empty placeholder suggestion. `validateRoutineSuggestion(...)` validates the metadata-only contract and rejects raw bodies, raw content, secrets, PII, persistence attempts, approval bridge attempts, and action execution attempts.

## Suggestion Inbox Contract

Phase 17D.2 adds a metadata-only suggestion inbox contract. This is not the live inbox and it does not create records.

The inbox item contract includes:

- `inbox_item_id`
- `suggestion_id`
- `routine_id`
- `inbox_status`
- `metadata_only: true`
- `inbox_item_created: false`
- `body_attached: false`
- `raw_body_allowed: false`
- `persistence_supported: false`
- `persistence_attempted: false`
- `approval_bridge_supported: false`
- `approval_bridge_attempted: false`
- `action_execution_supported: false`
- `action_execution_attempted: false`

Supported metadata statuses are:

- `unavailable`
- `pending`
- `dismissed`
- `accepted_metadata_only`

`createEmptySuggestionInboxItem(...)` creates an inert placeholder. `validateSuggestionInboxItem(...)` validates the contract and rejects raw bodies, raw content, secrets, PII, persistence attempts, approval bridge attempts, and action execution attempts.

## Redaction and Safety Guards

Phase 17D.3 adds redaction and safety boundary validators for routine suggestions and inbox items:

- `validateRoutineSuggestionSafety(...)`
- `validateSuggestionInboxSafety(...)`

Both boundaries require:

- `redaction_required: true`
- `redaction_supported: false`
- `redaction_attempted: false`
- `safety_review_required: true`
- `safety_review_supported: false`
- `safety_review_attempted: false`
- `raw_body_allowed: false`
- `raw_report_allowed: false`
- `raw_source_snapshot_allowed: false`
- `pii_allowed: false`
- `secrets_allowed: false`
- `project_body_allowed: false`
- `tool_output_allowed: false`
- `prompt_allowed: false`
- `model_output_allowed: false`
- `action_payload_allowed: false`

The guards reject raw body, raw report, raw source snapshot, PII, secrets, project body, tool output, prompt, model output, and action payload fields. Redaction and safety review are required for future content, but this slice does not run either review because no suggestion bodies or action payloads exist.

## Approval Bridge Metadata

Phase 17D.4 adds metadata-only approval bridge validators for routine suggestions and inbox items:

- `validateSuggestionApprovalBridge(...)`
- `validateInboxApprovalBridge(...)`

Both bridge contracts require:

- `approval_bridge_supported: false`
- `approval_bridge_attempted: false`
- `approval_reference_allowed: false`
- `approval_reference_present: false`
- `action_execution_supported: false`
- `action_execution_attempted: false`
- `approval_required_if_executed: true`
- `approval_state: unavailable`

Approval references are rejected. The bridge does not create approvals, persist anything, execute actions, call tools, write memory, mutate projects, control devices, or call cloud/network services.

## Explicitly Not Implemented

- No suggestion generation.
- No inbox item creation.
- No persistence.
- No database or event-store reads.
- No database or event-store writes.
- No scheduler execution.
- No routine execution.
- No report generation.
- No baseline update generation.
- No tool calls.
- No memory writes.
- No project mutations.
- No device actions.
- No approval flows.
- No cloud or network calls.

## Next Recommended Slice

Phase 17D.5 - Suggestion Audit Preview Scaffold.
