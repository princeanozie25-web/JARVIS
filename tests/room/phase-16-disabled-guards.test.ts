import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
  PHASE_16_ROOM_ADAPTER_DISABLED_FEATURES,
  Phase16RoomAdapterDisabledGuardMatrixSchema,
  evaluatePhase16RoomAdapterDisabledFeature,
} from "../../src/room/adapters/phase-16-disabled-guards";

describe("Phase 16A.2 room adapter disabled guard matrix", () => {
  it("pins every Phase 16 real-room feature off by default", () => {
    expect(PHASE_16_ROOM_ADAPTER_DISABLED_FEATURES).toEqual([
      "real_hue_writes",
      "hue_auto_discovery",
      "hue_cloud_remote_api",
      "scenes_macros",
      "scheduled_device_actions",
      "voice_trust_class_elevation",
      "runtime_trust_class_elevation",
      "jarvis_policy_edits",
      "multi_device_routines",
      "real_hue_adapter_without_fake_conformance",
    ]);

    expect(DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS).toEqual({
      phase: 16,
      slice: "16A.2",
      status: "disabled_guard_matrix",
      real_hue_writes_enabled: false,
      hue_auto_discovery_enabled: false,
      hue_cloud_remote_api_enabled: false,
      scenes_macros_enabled: false,
      scheduled_device_actions_enabled: false,
      voice_trust_class_elevation_enabled: false,
      runtime_trust_class_elevation_enabled: false,
      jarvis_policy_edits_enabled: false,
      multi_device_routines_enabled: false,
      real_hue_adapter_enabled: false,
      fake_conformance_required_before_real_hue: true,
      real_hue_adapter_requires_fake_conformance: true,
      metadata_only: true,
      local_only: true,
      network_called: false,
      hardware_io_performed: false,
      cloud_called: false,
      persisted: false,
      ui_rendered: false,
    });
  });

  it("denies every disabled feature with metadata-only, no-authority decisions", () => {
    for (const feature of PHASE_16_ROOM_ADAPTER_DISABLED_FEATURES) {
      expect(evaluatePhase16RoomAdapterDisabledFeature(feature)).toMatchObject({
        feature,
        allowed: false,
        phase: 16,
        slice: "16A.2",
        metadata_only: true,
        local_only: true,
        network_called: false,
        hardware_io_performed: false,
        cloud_called: false,
        persisted: false,
        ui_rendered: false,
        trust_class_elevated: false,
        policy_edited: false,
        schedule_registered: false,
        routine_created: false,
      });
    }
  });

  it("rejects attempts to flip any guard on", () => {
    const guardedFlags = [
      "real_hue_writes_enabled",
      "hue_auto_discovery_enabled",
      "hue_cloud_remote_api_enabled",
      "scenes_macros_enabled",
      "scheduled_device_actions_enabled",
      "voice_trust_class_elevation_enabled",
      "runtime_trust_class_elevation_enabled",
      "jarvis_policy_edits_enabled",
      "multi_device_routines_enabled",
      "real_hue_adapter_enabled",
      "network_called",
      "hardware_io_performed",
      "cloud_called",
      "persisted",
      "ui_rendered",
    ] as const;

    for (const flag of guardedFlags) {
      expect(
        Phase16RoomAdapterDisabledGuardMatrixSchema.safeParse({
          ...DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
          [flag]: true,
        }).success,
      ).toBe(false);
    }
  });

  it("keeps fake conformance required before real Hue can be enabled", () => {
    expect(DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS).toMatchObject({
      real_hue_adapter_enabled: false,
      fake_conformance_required_before_real_hue: true,
      real_hue_adapter_requires_fake_conformance: true,
    });
    expect(
      evaluatePhase16RoomAdapterDisabledFeature(
        "real_hue_adapter_without_fake_conformance",
      ),
    ).toMatchObject({
      allowed: false,
      reason: "phase_16a_fake_conformance_required",
    });
  });

  it("does not introduce real Hue, discovery, cloud, network, or routine execution markers", () => {
    const source = readFileSync(
      join(process.cwd(), "src/room/adapters/phase-16-disabled-guards.ts"),
      "utf8",
    );
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|createScene|createMacro|registerSchedule|executeRoutine|setTimeout\s*\(|setInterval\s*\(/i,
    );
  });
});
