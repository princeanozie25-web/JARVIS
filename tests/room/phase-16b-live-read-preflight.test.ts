import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DisabledHueReadOnlyAdapter,
  evaluateHueLiveReadPreflight,
} from "../../src/room/adapters/hue-adapter";
import { EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG } from "../../src/room/adapters/hue-config";
import { DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS } from "../../src/room/adapters/phase-16-disabled-guards";

const repoRoot = process.cwd();

describe("Phase 16B.6 Hue live read boundary preflight", () => {
  it("denies live read preflight when manual config is missing", () => {
    expect(evaluateHueLiveReadPreflight()).toEqual({
      allowed: false,
      status: "denied",
      reason: "manual_config_missing",
      error_class: "config_missing",
      adapter_kind: "hue",
      mode: "read_only",
      source: "local_hue_bridge",
      config_status: "config_missing",
      fake_conformance_status: "required_and_pinned",
      disabled_guard_status: "pinned_off",
      enabled: false,
      read_only: true,
      network_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      writes_allowed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
      metadata_only: true,
      live_read_implemented: false,
    });
  });

  it("denies live read preflight when manual config is invalid", () => {
    const decision = evaluateHueLiveReadPreflight({
      ...EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
      bridge_ip: "https://not-manual.example",
      api_key_config_ref: "api_key=not-allowed",
    });

    expect(decision).toMatchObject({
      allowed: false,
      status: "denied",
      reason: "manual_config_invalid",
      error_class: "config_invalid",
      config_status: "config_invalid",
      network_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      writes_allowed: false,
      raw_config_ref_exposed: false,
      raw_api_key_exposed: false,
    });
    expect(JSON.stringify(decision)).not.toContain("api_key=not-allowed");
  });

  it("marks valid-looking manual config ready for future implementation but still denies execution", () => {
    const decision = evaluateHueLiveReadPreflight(
      EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
    );
    const adapterDecision =
      DisabledHueReadOnlyAdapter.withExampleConfig().getLiveReadPreflight();

    expect(decision).toEqual(adapterDecision);
    expect(decision).toMatchObject({
      allowed: false,
      status: "ready_for_manual_live_read_implementation",
      reason: "ready_but_live_read_not_implemented",
      error_class: "live_read_not_implemented",
      config_status: "ready_for_future_read_only",
      fake_conformance_status: "required_and_pinned",
      disabled_guard_status: "pinned_off",
      enabled: false,
      read_only: true,
      network_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      writes_allowed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
      live_read_implemented: false,
    });
    expect(JSON.stringify(decision)).not.toContain("config_ref:hue");
  });

  it("fails closed if Phase 16 disabled guard state is unsafe", () => {
    const unsafeGuards = {
      ...DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
      real_hue_adapter_enabled: true,
    } as unknown as Partial<
      typeof DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS
    >;

    const decision = evaluateHueLiveReadPreflight(
      EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
      {
        disabledGuards: unsafeGuards,
      },
    );

    expect(decision).toMatchObject({
      allowed: false,
      status: "denied",
      reason: "disabled_guard_unsafe",
      error_class: "disabled_guard_unsafe",
      config_status: "ready_for_future_read_only",
      disabled_guard_status: "unsafe",
      network_allowed: false,
      discovery_allowed: false,
      cloud_allowed: false,
      writes_allowed: false,
      network_called: false,
      discovery_attempted: false,
      cloud_attempted: false,
    });
  });

  it("keeps preflight free of SDK, network, discovery, and cloud implementations", () => {
    const packageJson = read("package.json");
    const hueSources = [
      read("src/room/adapters/hue-adapter.ts"),
      read("src/room/adapters/hue-config.ts"),
      read("src/room/adapters/hue-read-mapper.ts"),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(hueSources).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });

  it("documents that live Hue reads remain unimplemented after preflight", () => {
    const doc = read("docs/phase-16/phase-16b-read-only.md");

    for (const required of [
      "Live Read Boundary Preflight",
      "allowed: false",
      "ready_for_manual_live_read_implementation",
      "live Hue reads are still not implemented",
    ]) {
      expect(doc).toContain(required);
    }
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
