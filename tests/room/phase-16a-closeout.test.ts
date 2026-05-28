import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
  PHASE_16_ROOM_ADAPTER_DISABLED_FEATURES,
  evaluatePhase16RoomAdapterDisabledFeature,
} from "../../src/room/adapters/phase-16-disabled-guards";

const repoRoot = process.cwd();

describe("Phase 16A closeout guard", () => {
  it("keeps every required Phase 16 disabled feature pinned off", () => {
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
    expect(DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS).toMatchObject({
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
      network_called: false,
      hardware_io_performed: false,
      cloud_called: false,
      persisted: false,
      ui_rendered: false,
    });

    for (const feature of PHASE_16_ROOM_ADAPTER_DISABLED_FEATURES) {
      expect(evaluatePhase16RoomAdapterDisabledFeature(feature)).toMatchObject({
        allowed: false,
        trust_class_elevated: false,
        policy_edited: false,
        schedule_registered: false,
        routine_created: false,
      });
    }
  });

  it("verifies Phase 16A hardening conformance files exist", () => {
    expect(
      read("tests/room/conformance/failure-partial-success.test.ts"),
    ).toContain("partial_success");
    expect(
      read("tests/room/conformance/rollback-compensation.test.ts"),
    ).toContain("compensation");
    expect(read("tests/room/adapters/fake-hue.test.ts")).toContain(
      "readSnapshot",
    );
    expect(read("src/room/adapters/fake-hue-bridge.ts")).toContain(
      "FakeHueBridgeReadSnapshot",
    );
  });

  it("keeps real Hue, discovery, cloud, scene, schedule, and routine paths absent", () => {
    const packageJson = read("package.json");
    const adapterSource = [
      read("src/room/adapters/contract.ts"),
      read("src/room/adapters/fake-room-adapter.ts"),
      read("src/room/adapters/fake-hue-bridge.ts"),
      read("src/room/adapters/fake-events.ts"),
      read("src/room/adapters/phase-16-disabled-guards.ts"),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(adapterSource).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });

  it("documents the closeout verdict and Phase 16B prerequisites", () => {
    const closeoutPath = "docs/phase-16/phase-16a-closeout.md";
    expect(existsSync(join(repoRoot, closeoutPath))).toBe(true);

    const doc = read(closeoutPath);
    for (const required of [
      "PASS WITH NOTES",
      "Completed 16A Slices",
      "Remaining Phase 16B Prerequisites",
      "Explicit Disabled Features Still Pinned Off",
      "Phase 16B.1 - Real Hue Read-Only Contract Scaffold",
      "node-hue-api",
      "Hue auto-discovery",
      "Hue Cloud Remote API",
      "scenes/macros",
      "schedules/time-based device actions",
      "trust-class elevation",
      "JARVIS policy edits",
    ]) {
      expect(doc).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
