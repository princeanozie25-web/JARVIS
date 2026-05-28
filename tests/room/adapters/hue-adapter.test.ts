import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS,
  evaluatePhase16RoomAdapterDisabledFeature,
} from "../../../src/room/adapters/phase-16-disabled-guards";
import {
  DisabledHueReadOnlyAdapter,
  HUE_READ_ONLY_ADAPTER_MODE,
} from "../../../src/room/adapters/hue-adapter";
import {
  EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
  HueReadOnlyAdapterConfigSchema,
  parseHueReadOnlyAdapterConfig,
} from "../../../src/room/adapters/hue-config";
import { approvedContext, roomCommand } from "../conformance/harness";

describe("Phase 16B.1 disabled Hue read-only adapter scaffold", () => {
  it("is disabled by default and exposes read-only local Hue metadata", () => {
    const adapter = new DisabledHueReadOnlyAdapter();

    expect(HUE_READ_ONLY_ADAPTER_MODE).toEqual({
      adapter_kind: "hue",
      mode: "read_only",
      enabled: false,
      source: "local_hue_bridge",
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_called: false,
      real_reads_implemented: false,
      real_writes_implemented: false,
    });
    expect(adapter.getModeMetadata()).toEqual(HUE_READ_ONLY_ADAPTER_MODE);
    expect(adapter.descriptor).toMatchObject({
      identity: {
        adapter_id: "hue-read-only-disabled",
        adapter_kind: "hue",
        real_hardware_io: false,
        network_access: false,
        persistence_access: false,
        ui_access: false,
        implementation_enabled: false,
      },
      supported_capabilities: ["power.observe", "light.observe"],
      implementation_side_effects_enabled: false,
    });
  });

  it("does not perform real Hue reads while disabled", async () => {
    const adapter = new DisabledHueReadOnlyAdapter();

    await expect(
      adapter.readState({
        deviceId: "desk_lamp",
        capability: "light.observe",
        context: { mode: "read_only", timeoutMs: 5_000 },
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "adapter_unavailable",
      state: null,
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
      provenance: {
        adapter_id: "hue-read-only-disabled",
        metadata_only: true,
      },
    });
  });

  it("has no write authority and returns disabled metadata for execution paths", async () => {
    const adapter = new DisabledHueReadOnlyAdapter();
    const command = {
      ...roomCommand({
        commandId: "hue-write-disabled",
        deviceId: "desk_lamp",
        capability: "power.switch",
        value: true,
      }),
      mode: "approved_execution" as const,
    };

    await expect(
      adapter.planCommand({
        command: { ...command, mode: "dry_run" },
        context: { mode: "dry_run", timeoutMs: 5_000 },
      }),
    ).rejects.toThrow("disabled");
    await expect(
      adapter.executeCommand({
        command,
        context: approvedContext("approval-hue-disabled-1"),
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "hardware_io_disabled",
      state: null,
      approval: {
        required: true,
        dry_run_required: true,
        auto_approval_allowed: false,
        voice_only_approval_allowed: false,
      },
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
    });
    await expect(
      adapter.verifyState({
        command,
        context: approvedContext("approval-hue-disabled-1"),
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "hardware_io_disabled",
      hardware_io_performed: false,
      network_called: false,
    });
  });

  it("validates manual config placeholders without live connection or secrets", () => {
    expect(
      parseHueReadOnlyAdapterConfig(EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG),
    ).toMatchObject({
      enabled: false,
      read_only: true,
      source: "local_hue_bridge",
      writes_supported: false,
      discovery_supported: false,
      cloud_supported: false,
      network_calls_enabled: false,
      real_reads_implemented: false,
    });
    expect(
      HueReadOnlyAdapterConfigSchema.safeParse({
        ...EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
        enabled: true,
      }).success,
    ).toBe(false);
    expect(
      HueReadOnlyAdapterConfigSchema.safeParse({
        ...EXAMPLE_DISABLED_HUE_READ_ONLY_CONFIG,
        api_key_config_ref: "api_key=not-allowed",
      }).success,
    ).toBe(false);

    const yaml = parseYaml(
      readFileSync(join(process.cwd(), "config/room/hue.example.yaml"), "utf8"),
    );
    expect(parseHueReadOnlyAdapterConfig(yaml)).toMatchObject({
      enabled: false,
      read_only: true,
      bridge_ip: "192.0.2.10",
      api_key_config_ref: "config_ref:hue.local.placeholder",
    });
  });

  it("keeps Phase 16A disabled guards pinned", () => {
    expect(DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS).toMatchObject({
      real_hue_writes_enabled: false,
      hue_auto_discovery_enabled: false,
      hue_cloud_remote_api_enabled: false,
      scenes_macros_enabled: false,
      scheduled_device_actions_enabled: false,
      real_hue_adapter_enabled: false,
      network_called: false,
      hardware_io_performed: false,
      cloud_called: false,
    });
    expect(
      evaluatePhase16RoomAdapterDisabledFeature("real_hue_writes"),
    ).toMatchObject({
      allowed: false,
      reason: "phase_16a_fake_conformance_required",
    });
  });

  it("does not add SDK, discovery, cloud, or network call markers", () => {
    const packageJson = readFileSync(
      join(process.cwd(), "package.json"),
      "utf8",
    );
    const hueSource = [
      readFileSync(
        join(process.cwd(), "src/room/adapters/hue-adapter.ts"),
        "utf8",
      ),
      readFileSync(
        join(process.cwd(), "src/room/adapters/hue-config.ts"),
        "utf8",
      ),
    ].join("\n");

    expect(packageJson).not.toMatch(/node-hue-api|huejay|philips-hue/i);
    expect(hueSource).not.toMatch(
      /fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|node-hue-api|huejay|discoverBridge|discoverLights|remoteApi|cloudApi|createScene|createMacro|registerSchedule|executeRoutine|setInterval\s*\(/i,
    );
  });
});
