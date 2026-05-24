import { describe, expect, it } from "vitest";

import { RoomAdapterContractDescriptorSchema } from "../../../src/room/adapters/contract";
import { FakeRoomAdapter } from "../../../src/room/adapters/fake-room-adapter";
import { loadDefaultRoomRegistry } from "../../../src/room/registry";
import { parseRoomProfile } from "../../../src/room/schema";
import type { RoomAdapterCommand } from "../../../src/room/adapters/contract";
import type { RoomProfile } from "../../../src/room/types";

function adapter() {
  return new FakeRoomAdapter({
    profile: loadDefaultRoomRegistry().getProfile(),
  });
}

function approval(required = true) {
  return {
    required,
    policy_id: required ? "fake-room-approval-policy" : null,
    reason: required
      ? "Fake mutating command requires approval metadata."
      : null,
    dry_run_required: true,
    auto_approval_allowed: false,
    voice_only_approval_allowed: false,
  } as const;
}

function command(
  overrides: Partial<RoomAdapterCommand> = {},
): RoomAdapterCommand {
  return {
    command_id: "command-1",
    mode: "dry_run",
    device_id: "desk_lamp",
    capability: "power.switch",
    action: "set_power",
    value: true,
    one_command_one_action: true,
    approval: approval(true),
    timeout_ms: 5_000,
    cancellation_supported: true,
    ...overrides,
  } as RoomAdapterCommand;
}

function profileWithMeter(): RoomProfile {
  const profile = loadDefaultRoomRegistry().getProfile();
  return parseRoomProfile({
    ...profile,
    devices: [
      ...profile.devices,
      {
        id: "energy_meter",
        name: "Energy Meter",
        zone_id: "desk",
        kind: "plug",
        capabilities: ["meter.observe"],
        adapter: {
          adapter_id: "fake-energy-meter",
          kind: "fake",
          local_only: true,
          real_adapter: false,
          network_access: false,
          hardware_io: false,
        },
        state: {
          power: "unknown",
          brightness_percent: null,
          color_hex: null,
          derived: false,
          freshness: {
            observed_at_ms: 0,
            stale_after_ms: 30_000,
            expires_at_ms: 30_000,
            source: "mock",
          },
        },
      },
    ],
  });
}

describe("Phase 10B.4 fake room adapter", () => {
  it("implements the adapter contract descriptor", () => {
    const fake = adapter();

    expect(RoomAdapterContractDescriptorSchema.parse(fake.descriptor)).toEqual(
      fake.descriptor,
    );
    expect(fake.descriptor).toMatchObject({
      identity: {
        adapter_kind: "fake",
        fake_first: true,
        real_hardware_io: false,
        network_access: false,
        implementation_enabled: false,
      },
    });
  });

  it("read_state returns deterministic defensive copies", async () => {
    const fake = adapter();
    const first = await fake.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });
    const second = await fake.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(first).toEqual(second);
    if (!first.state || !("power" in first.state)) {
      throw new Error("expected device state");
    }
    first.state.power = "on";
    const reread = await fake.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });
    expect(reread.state).toMatchObject({ power: "off" });
  });

  it("plan_command returns a dry-run plan without mutating state", async () => {
    const fake = adapter();
    const plan = await fake.planCommand({
      command: command({ value: true }),
      context: { mode: "dry_run", timeoutMs: 5_000 },
    });
    const state = await fake.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(plan).toMatchObject({
      mode: "dry_run",
      executable_now: false,
      adapter_called: false,
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
    });
    expect(plan.intended_state).toMatchObject({ power: "on" });
    expect(state.state).toMatchObject({ power: "off" });
  });

  it("execute_command mutates only in-memory fake state", async () => {
    const fake = adapter();
    const result = await fake.executeCommand({
      command: command({ mode: "approved_execution" }),
      context: {
        mode: "approved_execution",
        timeoutMs: 5_000,
        approvalId: "approval-1",
      },
    });
    const state = await fake.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });
    const fresh = adapter();
    const freshState = await fresh.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(result).toMatchObject({
      ok: true,
      operation: "execute_command",
      hardware_io_performed: false,
      network_called: false,
      persisted: false,
      ui_rendered: false,
    });
    expect(state.state).toMatchObject({ power: "on" });
    expect(freshState.state).toMatchObject({ power: "off" });
  });

  it("verify_state confirms fake state after execution", async () => {
    const fake = adapter();
    const approved = command({ mode: "approved_execution" });
    await fake.executeCommand({
      command: approved,
      context: {
        mode: "approved_execution",
        timeoutMs: 5_000,
        approvalId: "approval-1",
      },
    });

    await expect(
      fake.verifyState({
        command: approved,
        context: {
          mode: "approved_execution",
          timeoutMs: 5_000,
          approvalId: "approval-1",
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      operation: "verify_state",
      state: { power: "on" },
    });
  });

  it("meter capability is read-only and cannot be executed", async () => {
    const fake = new FakeRoomAdapter({ profile: profileWithMeter() });

    await expect(
      fake.readState({
        deviceId: "energy_meter",
        capability: "meter.observe",
        context: { mode: "read_only", timeoutMs: 5_000 },
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      fake.executeCommand({
        command: command({
          mode: "approved_execution",
          device_id: "energy_meter",
          capability: "meter.observe",
          action: "read",
          value: null,
          approval: approval(false),
        }),
        context: {
          mode: "approved_execution",
          timeoutMs: 5_000,
          approvalId: "approval-1",
        },
      }),
    ).rejects.toThrow();
  });

  it("mutating commands require approval metadata", async () => {
    const fake = adapter();

    await expect(
      fake.planCommand({
        command: command({ approval: approval(false) }),
        context: { mode: "dry_run", timeoutMs: 5_000 },
      }),
    ).rejects.toThrow();
    await expect(
      fake.executeCommand({
        command: command({ mode: "approved_execution" }),
        context: { mode: "approved_execution", timeoutMs: 5_000 },
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "approval_missing",
    });
  });

  it("one command cannot target multiple devices or capabilities", async () => {
    const fake = adapter();

    await expect(
      fake.planCommand({
        command: {
          ...command(),
          device_ids: ["desk_lamp", "bed_lamp"],
        } as unknown as RoomAdapterCommand,
        context: { mode: "dry_run", timeoutMs: 5_000 },
      }),
    ).rejects.toThrow();
    await expect(
      fake.planCommand({
        command: {
          ...command(),
          capabilities: ["power.switch", "light.dimmer"],
        } as unknown as RoomAdapterCommand,
        context: { mode: "dry_run", timeoutMs: 5_000 },
      }),
    ).rejects.toThrow();
  });

  it("unsupported capabilities are rejected", async () => {
    const fake = adapter();

    await expect(
      fake.planCommand({
        command: command({
          device_id: "smart_plug",
          capability: "light.color",
          action: "set_color",
          value: "#ffffff",
        }),
        context: { mode: "dry_run", timeoutMs: 5_000 },
      }),
    ).rejects.toThrow("Unsupported fake room capability");
  });

  it("exposes no persistence, network, hardware, UI, or provider path", async () => {
    const fake = adapter();
    const moduleExports = Object.keys(
      await import("../../../src/room/adapters/fake-room-adapter"),
    );
    const health = await fake.healthCheck({
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(health).toEqual({
      adapter_id: "fake-room-adapter",
      status: "healthy",
      checked_at_ms: 0,
      failure_class: null,
      hardware_io_performed: false,
      network_called: false,
    });
    expect(
      moduleExports.some((name) =>
        /persist|network|hardware|provider|render/i.test(name),
      ),
    ).toBe(false);
  });
});
