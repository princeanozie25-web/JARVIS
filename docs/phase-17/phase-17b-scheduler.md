# Phase 17B Scheduler Scaffold

## Status

Contract Only.

Phase 17B begins scheduler mechanics by adding a foreground tick evaluator. The evaluator inspects tick metadata, routine registry metadata, runtime contract metadata, and kill-switch state metadata, but it does not start a scheduler or execute routines.

## Foreground Tick Evaluator

`evaluateForegroundSchedulerTick(tick, routineRegistry, runtimeContract)` returns a metadata-only decision with:

- `tick_id`
- `foreground_only: true`
- `scheduler_execution_supported: false`
- `routine_execution_allowed: false`
- `side_effects_allowed: false`
- `eligible_routines` metadata
- `skipped_routines` metadata
- `kill_switch_required: true`
- `kill_switch_state`
- `execution_attempted: false`
- `persistence_attempted: false`

## Denial Rules

The evaluator denies:

- background and headless ticks
- catch-up ticks
- active, missing, or unsafe kill-switch state
- unsafe routine registry metadata
- unsafe runtime contract metadata
- all routine execution, because scheduler execution is not implemented

Disabled routines are represented in `skipped_routines` with explicit metadata-only reasons. No routine is silently executed or silently promoted to eligibility.

## Routine Eligibility Matrix

Phase 17B.2 adds `evaluateRoutineEligibility(routine, tick, runtimeContract, guardState)`.

The eligibility matrix records:

- `routine_id`
- `eligible`
- `enabled`
- `enabled_by_default`
- `user_present_required`
- `user_present_state`
- `kill_switch_required`
- `kill_switch_state`
- `schedule_kind`
- `tick_source_kind`
- `foreground_only`
- `side_effects_allowed: false`
- `execution_supported: false`
- `reason`
- `error_class`

Eligibility denies disabled routines, absent/unknown/not-checked user presence, active/missing/unsafe kill switch state, background or headless ticks, unsafe runtime contracts, unsafe disabled guards, unsafe routine entries, and any routine requesting side effects, tools, devices, memory writes, project mutations, approval execution, cloud, or network authority.

A metadata-only opt-in routine can be marked eligible by the eligibility evaluator when all preconditions pass, but routine execution remains disallowed. The foreground scheduler still validates the registry contract and keeps execution attempted false.

## Read Scope Binding

Phase 17B.3 adds `evaluateRoutineReadScopeBinding(routine, scopeRegistry)`.

The binding layer records:

- `routine_id`
- `allowed_read_scopes`
- `denied_read_scopes`
- `metadata_only: true`
- `collector_execution_supported: false`
- `db_read_supported: false`
- `event_store_read_supported: false`
- `report_generation_supported: false`
- `suggestion_generation_supported: false`

Routine bindings are fixed metadata maps against the Phase 17A.5 read scope contract. The evaluator denies undeclared scopes, unknown surfaces, raw payload scopes, PII scopes, secret-bearing scopes, network scopes, and write scopes. It does not run collectors and does not read from a database or event store.

Routine eligibility includes the read scope binding decision. A routine can only be marked eligible metadata if its read scope binding is complete and safe, and even then execution remains unsupported.

## Explicitly Not Implemented

- No timers.
- No intervals.
- No scheduler execution.
- No routine execution.
- No collectors.
- No report generation.
- No suggestion generation.
- No persistence or event-store reads/writes.
- No tool calls.
- No memory writes.
- No project mutations.
- No device actions.
- No approval flows.
- No cloud or network calls.

## Boundary Guarantee

This slice keeps scheduled assistance foreground-only and non-executing. It only prepares the metadata decision shape that a future foreground scheduler can use after later phases add additional governance.

## Next Recommended Slice

Phase 17B.4 - Foreground Scheduler Output Envelope Scaffold.
