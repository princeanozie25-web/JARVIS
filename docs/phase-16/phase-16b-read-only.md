# Phase 16B Real Hue Read-Only Scaffold

## Status

Phase 16B.1 adds a disabled real Hue read-only contract scaffold only. Phase 16B.2 adds disabled read-health metadata and stricter manual config validation. Phase 16B.3 adds pure offline Hue Bridge v2 request/result mapping fixtures. Phase 16B.4 wires that mapper into the disabled adapter through a fixture-only dry-run read path. Phase 16B.5 closes the fixture conformance layer.

Real Hue reads are still not implemented. Real Hue writes are still not implemented. The scaffold does not discover bridges, call a Hue SDK, call HTTP APIs, use Hue Cloud Remote API, or make network calls.

## Added Boundary

- `src/room/adapters/hue-adapter.ts`
- `src/room/adapters/hue-config.ts`
- `src/room/adapters/hue-read-mapper.ts`
- `config/room/hue.example.yaml`
- `tests/room/adapters/hue-adapter.test.ts`
- `tests/room/adapters/hue-read-mapper.test.ts`
- `tests/room/phase-16b-fixture-conformance.test.ts`
- `docs/phase-16/phase-16b5-fixture-conformance.md`

## Read-Only Metadata

- adapter kind: `hue`
- mode: `read_only`
- enabled: `false`
- source: `local_hue_bridge`
- writes supported: `false`
- discovery supported: `false`
- cloud supported: `false`
- real reads implemented: `false`
- real writes implemented: `false`

## Manual Config Placeholder

The example config is manual-only and disabled:

- `bridge_ip` uses a documentation placeholder IP.
- `api_key_config_ref` is a reference placeholder, not a secret.
- `enabled` is pinned `false`.
- `read_only` is pinned `true`.
- missing config reports `config_missing` metadata only.
- invalid config reports `config_invalid` metadata only.
- valid-looking config reports `ready_for_future_read_only`, but execution remains disabled.
- `api_key_config_ref` is surfaced only as `configured` or `not_configured` in health metadata.

## Read Health Metadata

The disabled adapter reports health without connecting:

- `status`: `config_missing`, `config_invalid`, or `ready_for_future_read_only`
- `enabled`: `false`
- `read_only`: `true`
- `network_called`: `false`
- `discovery_attempted`: `false`
- `cloud_attempted`: `false`
- `writes_supported`: `false`
- `raw_config_ref_exposed`: `false`
- `raw_api_key_exposed`: `false`

## Hue Read Mapping Scaffold

The mapper is fixture-only and pure:

- bridge fixture metadata maps to adapter bridge snapshot metadata.
- light fixture payloads map to adapter-compatible light snapshots.
- reachable and unreachable states map to explicit availability metadata.
- on/off, brightness, XY color metadata, and color temperature are mapped when present and valid.
- missing Hue fields are reported as `missing_fields`.
- unsupported fields, such as XY-to-hex conversion, are reported as `unsupported_fields` instead of guessed.
- invalid fields are reported as `invalid_fields`.
- mapped results always carry `source: local_hue_bridge`, `adapter_kind: hue`, `mode: read_only`, and disabled authority flags.
- raw Hue payloads, raw config refs, and raw API keys are not surfaced.

The mapper does not connect to Hue, read live Hue state, discover bridges, call a Hue SDK, call HTTP APIs, or enable writes.

## Disabled Adapter Dry-Run Mapping

`DisabledHueReadOnlyAdapter.dryRunReadFixtureSnapshot()` accepts only local in-memory Hue-like fixtures and returns mapped read snapshot metadata:

- `fixture_only`: `true`
- `dry_run_read`: `true`
- `enabled`: `false`
- `adapter_kind`: `hue`
- `mode`: `read_only`
- `source`: `local_hue_bridge`
- `network_called`: `false`
- `discovery_attempted`: `false`
- `cloud_attempted`: `false`
- `writes_supported`: `false`

Manual config validation may be reflected as metadata, but config remains inert and raw config refs/API keys are not surfaced. Normal adapter `readState()` remains disabled and returns unavailable metadata; live Hue reads are still not implemented.

## Fixture Conformance Closeout

Phase 16B live Hue reads are still not implemented. The fixture conformance only proves mapper/adapter shape:

- reachable, unreachable, stale, missing, invalid, and unsupported fixture states remain metadata-only.
- fixture reads are explicitly marked `fixture_only` and `dry_run_read`.
- `enabled` stays `false`.
- `read_only` stays `true`.
- `network_called`, `discovery_attempted`, and `cloud_attempted` stay `false`.
- `writes_supported` stays `false`.
- raw config refs and API keys are not surfaced.
- no write, persistence, or UI path is introduced.

## Still Forbidden

- `node-hue-api` or any Hue SDK dependency.
- HTTP, fetch, WebSocket, or network calls.
- Bridge discovery.
- Hue Cloud Remote API.
- Real Hue reads.
- Real Hue writes.
- Scenes, macros, schedules, or routines.
- Any weakening of Phase 16A disabled guards.

## Next Recommended Slice

Phase 16B.6 - Live Read Boundary Preflight.
