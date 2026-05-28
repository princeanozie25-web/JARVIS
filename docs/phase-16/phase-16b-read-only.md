# Phase 16B Real Hue Read-Only Scaffold

## Status

Phase 16B.1 adds a disabled real Hue read-only contract scaffold only.

Real Hue reads are still not implemented. Real Hue writes are still not implemented. The scaffold does not discover bridges, call a Hue SDK, call HTTP APIs, use Hue Cloud Remote API, or make network calls.

## Added Boundary

- `src/room/adapters/hue-adapter.ts`
- `src/room/adapters/hue-config.ts`
- `config/room/hue.example.yaml`
- `tests/room/adapters/hue-adapter.test.ts`

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

Phase 16B.2 - Disabled Hue Read Health And Manual Config Validation.
