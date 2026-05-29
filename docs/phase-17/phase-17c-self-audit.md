# Phase 17C Self-Audit Report Schema

## Status

Schema Scaffold Only.

Phase 17C begins self-audit report schema work by defining an empty, metadata-only report shape. This slice does not collect data, read stores, generate a report body, persist output, or emit telemetry.

## Report Contract

The Phase 17 self-audit report schema defines:

- `report_id`
- `routine_id`
- `window`
- `generated_by_routine_id`
- `metadata_only: true`
- `redaction_required: true`
- `redaction_status`
- `raw_payload_allowed: false`
- `persistence_supported: false`
- `persistence_attempted: false`

## Sections

The report contains empty metadata-only sections for:

- approvals
- tools
- cost/model usage
- vision
- environment/room
- projects
- router
- safety
- routines/scheduler

Every section is empty, metadata-only, collector-free, and disallows raw payloads, PII, secrets, body text, and generated content.

## Section Metadata Contracts

Phase 17C.2 adds detailed metadata contracts for every report section.

Each section includes:

- `section_id`
- `section_kind`
- `metadata_only: true`
- `collector_supported: false`
- `collector_attempted: false`
- `source_read_supported: false`
- `source_read_attempted: false`
- `raw_payload_allowed: false`
- `redaction_required: true`
- `redaction_status`
- `row_cap`
- `max_items`
- `summary_generated: false`

`validateSelfAuditSectionMetadata(section)` validates one section at a time and rejects raw payloads, text bodies, secrets, PII, project bodies, tool outputs, voice transcripts, OCR text, frames, prompts, and model outputs. It does not run collectors and does not read from a database or event store.

## Redaction Boundary

Phase 17C.3 adds `validateSelfAuditRedactionBoundary(...)`.

The redaction boundary requires:

- `redaction_required: true`
- `redaction_supported: false`
- `redaction_attempted: false`
- `raw_payload_allowed: false`
- `pii_allowed: false`
- `secrets_allowed: false`
- `project_body_allowed: false`
- `tool_output_allowed: false`
- `voice_transcript_allowed: false`
- `ocr_text_allowed: false`
- `frame_data_allowed: false`
- `prompt_allowed: false`
- `model_output_allowed: false`

This slice defines what future redaction must protect, but it does not run redaction because no report content is generated.

## Telemetry Boundary

Phase 17C.3 also adds `validateSelfAuditTelemetryBoundary(...)`.

The telemetry boundary requires:

- `telemetry_supported: false`
- `telemetry_attempted: false`
- `telemetry_payload_kind: metadata_only`
- `raw_report_allowed: false`
- `raw_section_content_allowed: false`

Telemetry remains forbidden as an output sink in this scaffold. No telemetry write, persistence write, event-store write, raw report payload, or raw section content is allowed.

## Validation

`validateSelfAuditReportSchema(report)` validates the schema and rejects:

- raw payload fields
- secrets and API keys
- PII fields
- report body text
- persistence flags
- tool output
- project bodies
- voice transcripts
- OCR text
- frames or image payloads
- prompts
- model outputs

Validation is metadata-only and does not read from or write to any store.

## Explicitly Not Implemented

- No collectors.
- No database reads.
- No event-store reads.
- No database or event-store writes.
- No scheduler execution.
- No routine execution.
- No report generation.
- No suggestion generation.
- No baseline update generation.
- No persistence.
- No telemetry writes.
- No tool calls.
- No memory writes.
- No project mutations.
- No device actions.
- No approval flows.
- No cloud or network calls.

## Next Recommended Slice

Phase 17C.2 - Self-Audit Section Metadata Contracts.
