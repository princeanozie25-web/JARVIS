# Phase 16C Hue Dry-Run Planning

## Status

Phase 16C.1 adds the Hue dry-run plan contract scaffold only. It is pure local planning from fixture/current-state metadata to a non-executable diff plan.

No real Hue reads are implemented. No real Hue writes are implemented. No network calls, SDK usage, discovery, cloud path, approval execution, or hardware access is added.

## Added Boundary

- `src/room/adapters/hue-dry-run.ts`
- `tests/room/adapters/hue-dry-run.test.ts`

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
- `approval_required: true`
- `executable: false`
- `execution_supported: false`
- `network_called: false`
- `discovery_attempted: false`
- `cloud_attempted: false`
- `writes_attempted: false`
- `raw_config_exposed: false`

## Supported Intended State Metadata

- on/off
- brightness
- color hex
- color temperature

The planner never guesses missing current state. Unknown and unreachable current state are represented explicitly in the diff as unknown metadata.

## Still Forbidden

- `node-hue-api` or any Hue SDK dependency.
- HTTP, fetch, WebSocket, or network calls.
- Real Hue live reads.
- Real Hue writes.
- Dry-run execution.
- Approval execution.
- Bridge discovery.
- Hue Cloud Remote API.
- Raw API key/config-ref exposure.
- Scenes, macros, schedules, or routines.
- Hardware access.

## Next Recommended Slice

Phase 16C.2 - Hue Dry-Run Adapter Contract Integration.
