# Phase 16A.1 Fake Adapter Hardening Audit + Gap Map

## Verdict

**PARTIAL**

The room runtime already has a meaningful fake-first substrate: a typed adapter contract, a deterministic `FakeRoomAdapter`, a `FakeHueBridge`, in-memory fake failure simulation, fake event provenance, verification reads, and a conformance suite for the current fake room adapter.

It is not ready to unlock real Hue work yet. Phase 16A still needs a final closeout freeze before Phase 16B can introduce real Hue read-only support.

## Files Inspected

- `src/room/types.ts`
- `src/room/schema.ts`
- `src/room/registry.ts`
- `src/room/adapters/contract.ts`
- `src/room/adapters/fake-room-adapter.ts`
- `src/room/adapters/fake-hue-bridge.ts`
- `src/room/adapters/fake-failures.ts`
- `src/room/adapters/fake-events.ts`
- `src/store/room-event-bridge.ts`
- `tests/room/schema.test.ts`
- `tests/room/registry.test.ts`
- `tests/room/events.test.ts`
- `tests/room/adapters/contract.test.ts`
- `tests/room/adapters/fake-room-adapter.test.ts`
- `tests/room/adapters/fake-hue.test.ts`
- `tests/room/adapters/fake-failures.test.ts`
- `tests/room/conformance/harness.ts`
- `tests/room/conformance/read-state.test.ts`
- `tests/room/conformance/command-on-off.test.ts`
- `tests/room/conformance/command-dim.test.ts`
- `tests/room/conformance/command-color.test.ts`
- `tests/room/conformance/command-temperature.test.ts`
- `tests/room/conformance/failure-offline.test.ts`
- `tests/room/conformance/failure-stale.test.ts`
- `tests/room/conformance/failure-timeout.test.ts`
- `tests/room/conformance/failure-auth.test.ts`
- `tests/room/conformance/verification-read.test.ts`
- `tests/room/conformance/audit-trail.test.ts`
- `docs/ARCHITECTURE_OPERATIONALIZATION.md`

## Current Fake Adapter Capabilities

- `RoomAdapterContract` defines `read_state`, `plan_command`, `execute_command`, `verify_state`, and `health_check`.
- Command modes are typed as `read_only`, `dry_run`, and `approved_execution`.
- Mutating capabilities are constrained to one device, one capability, one command action.
- Mutating commands require approval metadata and dry-run planning metadata.
- `FakeRoomAdapter` supports deterministic in-memory state reads and fake-only mutations for:
  - `power.switch`
  - `light.dimmer`
  - `light.color`
  - `light.temperature`
- `FakeHueBridge` supports fake bridge metadata, fake lights, groups, state reads, single-capability writes, and multi-field fake light patching.
- `FakeFailureController` supports:
  - `offline`
  - `stale`
  - `timeout`
  - `auth_error`
  - `partial_success`
- `FakeDeviceEventEmitter` emits metadata-only fake room events with provenance and no network, hardware, persistence, UI, provider, raw payload, or secret flags.

## Current Conformance Coverage

| Requirement                                      | Current Status | Evidence                                                                                  |
| ------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------- |
| Fake room adapter coverage                       | **PASS**       | `tests/room/adapters/fake-room-adapter.test.ts`                                           |
| Fake Hue bridge / fake light support             | **PASS**       | `src/room/adapters/fake-hue-bridge.ts`, `tests/room/adapters/fake-hue.test.ts`            |
| Fake Hue read contract alignment                 | **PASS**       | `FakeHueBridge.readSnapshot()` exposes Phase 16A read-only parity metadata                |
| Adapter conformance harness                      | **PASS**       | `tests/room/conformance/harness.ts`                                                       |
| Read-state conformance                           | **PASS**       | `tests/room/conformance/read-state.test.ts`                                               |
| On/off command conformance                       | **PASS**       | `tests/room/conformance/command-on-off.test.ts`                                           |
| Dim command conformance                          | **PASS**       | `tests/room/conformance/command-dim.test.ts`                                              |
| Color command conformance                        | **PASS**       | `tests/room/conformance/command-color.test.ts`                                            |
| Temperature command conformance                  | **PASS**       | `tests/room/conformance/command-temperature.test.ts`                                      |
| Offline failure simulation                       | **PASS**       | `tests/room/conformance/failure-offline.test.ts`                                          |
| Stale state simulation                           | **PASS**       | `tests/room/conformance/failure-stale.test.ts`                                            |
| Timeout simulation                               | **PASS**       | `tests/room/conformance/failure-timeout.test.ts`                                          |
| Auth error simulation                            | **PASS**       | `tests/room/conformance/failure-auth.test.ts`                                             |
| Partial success simulation                       | **PASS**       | `tests/room/conformance/failure-partial-success.test.ts` covers adapter-contract metadata |
| Command rejection                                | **PASS**       | Contract and fake adapter tests reject unsupported/malformed commands                     |
| Audit/event provenance                           | **PASS**       | `fake-events.ts`, `audit-trail.test.ts`, `room-event-bridge.test.ts`                      |
| Verification read behavior                       | **PASS**       | `verify_state`, `verification-read.test.ts`                                               |
| Rollback/compensation scaffolding                | **PASS**       | `tests/room/conformance/rollback-compensation.test.ts` covers descriptive plans           |
| Real Hue write prevention                        | **PASS**       | Phase 16A.2 guard matrix pins `real_hue_writes_enabled: false`                            |
| Auto-discovery prevention                        | **PASS**       | Phase 16A.2 guard matrix pins `hue_auto_discovery_enabled: false`                         |
| Cloud Hue API prevention                         | **PASS**       | Phase 16A.2 guard matrix pins `hue_cloud_remote_api_enabled: false`                       |
| Scenes/macros prevention                         | **PASS**       | Phase 16A.2 guard matrix pins `scenes_macros_enabled: false`                              |
| Schedules/time-based device actions prevention   | **PASS**       | Phase 16A.2 guard matrix pins `scheduled_device_actions_enabled: false`                   |
| Trust-class elevation by voice/JARVIS prevention | **PASS**       | Phase 16A.2 guard matrix pins voice/runtime trust elevation off                           |
| Policy edits by JARVIS prevention                | **PASS**       | Phase 16A.2 guard matrix pins `jarvis_policy_edits_enabled: false`                        |

## Missing Requirements For Phase 16A

1. **Phase 16 disabled guards are now centralized and must stay frozen.**
   Phase 16A.2 adds `src/room/adapters/phase-16-disabled-guards.ts` and `tests/room/phase-16-disabled-guards.test.ts`. The centralized matrix pins:
   - real Hue writes disabled
   - auto-discovery disabled
   - cloud Hue API disabled
   - scenes/macros disabled
   - schedules/time-based device actions disabled
   - voice/JARVIS trust-class elevation disabled
   - JARVIS policy edits disabled

2. **Fake-to-real mismatch risk remains.**
   The fake adapter is synchronous/in-memory and never exercises real transport edge cases such as bridge rate limiting, Hue v2 error envelopes, auth refresh/rejection shape, per-light response arrays, or verification lag.

3. **No real-Hue implementation boundary exists yet.**
   This is fine for 16A.1, but Phase 16B should not begin until the fake conformance suite is the single shared contract for real read-only behavior.

## Recommended Next Slices

1. **16A.6 - Phase 16A Closeout Guard**
   Freeze fake adapter conformance before Phase 16B real Hue read-only support.

## Do Not Implement Yet

- Real Hue bridge discovery.
- `node-hue-api` or any Hue SDK/client dependency.
- Direct Hue REST calls.
- Real device writes.
- Hue cloud API.
- Scenes, macros, schedules, routines, or multi-device room actions.
- Voice-triggered trust elevation.
- JARVIS-authored room policy edits.
- Background or scheduled room actuation.
- Any network, persistence, UI, or hardware I/O path in the room adapter.

## Risk Notes

- **Fake-to-real mismatch risk:** The fake bridge now exposes a read-only parity snapshot, but it still does not model every Hue v2 transport nuance.
- **Partial-success mismatch risk:** Phase 16A.3 now covers adapter-contract partial success, but future Hue parity still needs real Hue v2 response-shape mapping before execution is enabled.
- **Verification-read optimism:** Verification reads currently reflect immediate fake in-memory state. Real Hue may lag, timeout, or return stale bridge state.
- **Rollback ambiguity:** Phase 16A.4 adds descriptive compensation metadata, but execution remains disabled and future rollback approval semantics still need a real-provider-era design.
- **Guard drift risk:** Real-provider prevention now has a Phase 16A.2 guard matrix, but future real Hue slices must keep those guards pinned until fake conformance is complete.
