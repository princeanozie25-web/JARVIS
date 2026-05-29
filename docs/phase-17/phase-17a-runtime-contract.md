# Phase 17A.1 Scheduled Assistance Runtime Contract

## Status

Contract Only.

Phase 17 begins the Scheduled Assistance Runtime by defining routine metadata and runtime authority boundaries. This slice does not start a scheduler or execute any routine.

## Runtime Contract

The scheduled assistance runtime contract defines:

- `routine_id`
- `routine_kind`
- `schedule_kind`
- `enabled`
- `user_present_required`
- `side_effects_allowed`
- `output_kind`
- `execution_mode`
- `kill_switch_required`
- `metadata_only`

The runtime contract also pins off:

- `execution_supported`
- `scheduler_active`
- `scheduler_running`
- `side_effects_supported`
- `network_allowed`
- `cloud_allowed`
- `tool_execution_allowed`
- `memory_write_allowed`
- `device_action_allowed`
- `project_mutation_allowed`
- `approval_execution_allowed`

## Disabled Guard Matrix

Phase 17A.2 adds a centralized disabled guard matrix for scheduled assistance. It pins off:

- scheduler execution
- background/headless scheduler execution
- autonomous execution
- tool calls
- device actions
- project mutations
- memory writes
- approval execution
- cloud/network calls
- routine chaining
- self-modifying routines
- auto-tuning thresholds, budgets, or policies
- catch-up missed schedule runs
- voice enable/disable/schedule changes
- raw report telemetry
- raw suggestion telemetry

Each guard evaluation returns `allowed: false`, metadata-only denial fields, and no side-effect flags.

## Routine Classes

- `daily_self_audit`
- `cost_report`
- `project_progress`
- `calibration_diff`
- `next_action_suggest`

## Routine Registry Alignment

Phase 17A.3 adds an explicit scheduled assistance routine registry aligned with the runtime contract and disabled guard matrix.

Each routine entry is:

- disabled by default
- opt-in only
- metadata-only
- foreground-only
- kill-switch guarded
- non-executing
- side-effect free

The registry rejects routines that request tool authority, device actions, memory writes, project mutations, approval execution, cloud/network authority, background/headless execution, or any side-effect flag.

## Tick Source Contract

Phase 17A.4 adds a foreground-only tick source contract for future scheduled assistance.

Supported tick source metadata:

- `manual`
- `foreground_scheduler`
- `test_fixture`

Rejected tick source metadata:

- background
- headless
- background/headless

Every tick decision is metadata-only and denied in this slice. Scheduler execution, routine execution, catch-up runs, timers, reports, suggestions, persistence, tools, memory writes, project mutations, device actions, approvals, cloud, and network calls remain disabled. Missed ticks use `skip`.

## Read Scope Contract

Phase 17A.5 defines the metadata-only surfaces future scheduled assistance routines may read:

- approvals metadata
- tool call metadata
- model/cost metadata
- vision replay metadata
- environment/room event metadata
- project ledger metadata
- router decision metadata
- safety classifier metadata

Each read scope is read-only, metadata-only, row-capped, and rejects raw payloads, PII, secrets, network access, writes, unknown surfaces, and any collector execution. This slice does not read from a database or event store.

## Explicitly Not Implemented

- No timers.
- No scheduler execution.
- No reports or suggestions are generated.
- No persistence, tools, memory writes, project mutations, device actions, approvals, cloud, or network calls.
- No runtime side effects.

## Next Recommended Slice

Phase 17A.6 - Scheduled Assistance Runtime Closeout Guard.
