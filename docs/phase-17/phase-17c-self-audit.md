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

## Source Snapshots

Phase 17C.4 adds metadata-only source snapshot contracts for future self-audit inputs.

Declared source kinds:

- approvals
- tool calls
- model/cost
- vision replay
- room/environment
- project ledger
- router decisions
- safety classifier
- scheduler/routines

Each snapshot includes:

- `snapshot_id`
- `source_kind`
- `section_kind`
- `metadata_only: true`
- `source_read_supported: false`
- `source_read_attempted: false`
- `collector_supported: false`
- `collector_attempted: false`
- `row_count: 0`
- `row_cap`
- `truncated: false`
- `raw_payload_allowed: false`
- `redaction_required: true`
- `persistence_supported: false`
- `persistence_attempted: false`

`createEmptySelfAuditSourceSnapshot(...)` creates an empty placeholder for a declared source kind. `validateSelfAuditSourceSnapshot(...)` validates source snapshot metadata and rejects raw payloads, user content, secrets, PII, report bodies, tool outputs, project bodies, voice transcripts, OCR text, frames, prompts, model outputs, persistence attempts, and telemetry attempts. It does not collect or read anything.

## Aggregation Envelope

Phase 17C.5 adds a metadata-only aggregation envelope for future source snapshot aggregation.

The envelope includes:

- `aggregation_id`
- `report_id`
- `source_snapshot_ids`
- `section_ids`
- `metadata_only: true`
- `aggregation_supported: false`
- `aggregation_attempted: false`
- `source_reads_attempted: false`
- `collector_execution_attempted: false`
- `report_body_generated: false`
- `summary_generated: false`
- `raw_payload_allowed: false`
- `redaction_required: true`
- `persistence_supported: false`
- `persistence_attempted: false`

`createEmptySelfAuditAggregationEnvelope(...)` creates an envelope that can reference empty source snapshots and report section identifiers. `validateSelfAuditAggregationEnvelope(...)` validates that envelope without aggregating real data, reading sources, running collectors, generating report bodies, generating summaries, persisting output, or emitting telemetry.

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

Phase 17C.6 - Self-Audit Report Closeout Guard.
