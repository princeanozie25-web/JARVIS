import { describe, expect, it } from "vitest";

import {
  FAKE_DEVICE_FAILURE_MODES,
  FakeFailureController,
  fakeBlockingFailureClassFor,
  fakeFailureClassFor,
} from "../../../src/room/adapters/fake-failures";
import { FakeHueBridge } from "../../../src/room/adapters/fake-hue-bridge";
import { FakeRoomAdapter } from "../../../src/room/adapters/fake-room-adapter";
import { loadDefaultRoomRegistry } from "../../../src/room/registry";
import type { RoomAdapterCommand } from "../../../src/room/adapters/contract";

function adapter() {
  return new FakeRoomAdapter({
    profile: loadDefaultRoomRegistry().getProfile(),
  });
}

function bridge() {
  return new FakeHueBridge(loadDefaultRoomRegistry().getProfile());
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
    mode: "approved_execution",
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

describe("Phase 10B.6 fake device failure modes", () => {
  it("defines every fake-only failure mode deterministically", () => {
    expect(FAKE_DEVICE_FAILURE_MODES).toEqual([
      "offline",
      "stale",
      "timeout",
      "auth_error",
      "partial_success",
    ]);
    expect(fakeFailureClassFor("offline")).toBe("adapter_unavailable");
    expect(fakeBlockingFailureClassFor("timeout")).toBe("timeout");
    expect(fakeBlockingFailureClassFor("auth_error")).toBe("auth_error");
    expect(fakeFailureClassFor("partial_success")).toBe("partial_success");
  });

  it("offline read and write fail closed without mutating state", async () => {
    const fake = adapter();
    fake.enableFailure("offline", "desk_lamp");

    await expect(
      fake.readState({
        deviceId: "desk_lamp",
        capability: "power.observe",
        context: { mode: "read_only", timeoutMs: 5_000 },
      }),
    ).resolves.toMatchObject({
      ok: false,
      state: null,
      failure_class: "adapter_unavailable",
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
      ui_rendered: false,
    });

    await expect(
      fake.executeCommand({
        command: command(),
        context: {
          mode: "approved_execution",
          timeoutMs: 5_000,
          approvalId: "approval-1",
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "adapter_unavailable",
      state: { power: "off" },
    });

    fake.clearFailure("offline", "desk_lamp");
    await expect(
      fake.readState({
        deviceId: "desk_lamp",
        capability: "power.observe",
        context: { mode: "read_only", timeoutMs: 5_000 },
      }),
    ).resolves.toMatchObject({ ok: true, state: { power: "off" } });
  });

  it("stale reads remain readable but unsafe for freshness-sensitive policy", async () => {
    const fake = adapter();
    fake.enableFailure("stale", "desk_lamp");

    const result = await fake.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(result).toMatchObject({
      ok: true,
      failure_class: null,
      state: {
        freshness: {
          observed_at_ms: 0,
          stale_after_ms: 1,
          expires_at_ms: 1,
          source: "mock",
        },
      },
    });
  });

  it("timeout returns a typed timeout failure without a real wait", async () => {
    const fake = adapter();
    fake.enableFailure("timeout", "desk_lamp");
    const startedAt = Date.now();

    const result = await fake.executeCommand({
      command: command(),
      context: {
        mode: "approved_execution",
        timeoutMs: 5_000,
        approvalId: "approval-1",
      },
    });

    expect(Date.now() - startedAt).toBeLessThan(50);
    expect(result).toMatchObject({
      ok: false,
      failure_class: "timeout",
      state: { power: "off" },
    });
  });

  it("auth_error returns a typed simulated auth failure", async () => {
    const fake = adapter();
    fake.enableFailure("auth_error", "desk_lamp");

    await expect(
      fake.executeCommand({
        command: command(),
        context: {
          mode: "approved_execution",
          timeoutMs: 5_000,
          approvalId: "approval-1",
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      failure_class: "auth_error",
      state: { power: "off" },
    });
  });

  it("partial_success only occurs when explicitly configured and requested", () => {
    const fake = bridge();
    fake.enableFailure("partial_success", "desk_lamp");

    expect(
      fake.setLightState("desk_lamp", {
        on: true,
        color_hex: "#ffffff",
      }),
    ).toMatchObject({
      ok: false,
      error: "unsupported_capability",
      partial_success: false,
      applied_capabilities: [],
      state: { on: false, color_hex: null },
    });
    expect(fake.getLight("desk_lamp")?.state).toMatchObject({
      on: false,
      color_hex: null,
    });

    expect(
      fake.setLightState(
        "desk_lamp",
        {
          on: true,
          color_hex: "#ffffff",
        },
        { allowPartialSuccess: true },
      ),
    ).toMatchObject({
      ok: false,
      error: "partial_success",
      partial_success: true,
      applied_capabilities: ["power.switch"],
      rejected_capabilities: ["light.color"],
      state: { on: true, color_hex: null },
    });
  });

  it("fake Hue offline and stale modes are readable through typed fake results", () => {
    const fake = bridge();
    fake.enableFailure("stale", "desk_lamp");

    expect(fake.readLight("desk_lamp")).toMatchObject({
      ok: true,
      light: { state: { stale: true } },
      error: null,
      network_called: false,
      hardware_io_performed: false,
      persisted: false,
    });

    fake.clearFailure("stale", "desk_lamp");
    fake.enableFailure("offline", "desk_lamp");

    expect(fake.readLight("desk_lamp")).toMatchObject({
      ok: false,
      light: null,
      error: "adapter_unavailable",
    });
    expect(fake.setOn("desk_lamp", true)).toMatchObject({
      ok: false,
      error: "adapter_unavailable",
      state: { on: false },
    });
  });

  it("failure state can be cleared and recovers in memory", async () => {
    const fake = adapter();
    fake.enableFailure("offline", "desk_lamp");
    fake.clearAllFailures();

    await expect(
      fake.executeCommand({
        command: command(),
        context: {
          mode: "approved_execution",
          timeoutMs: 5_000,
          approvalId: "approval-1",
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      state: { power: "on" },
      failure_class: null,
    });
  });

  it("fresh adapter instances start clean from the profile", async () => {
    const failing = adapter();
    failing.enableFailure("offline", "desk_lamp");

    const fresh = adapter();
    await expect(
      fresh.readState({
        deviceId: "desk_lamp",
        capability: "power.observe",
        context: { mode: "read_only", timeoutMs: 5_000 },
      }),
    ).resolves.toMatchObject({
      ok: true,
      state: { power: "off" },
      failure_class: null,
    });
  });

  it("failure controller is in-memory only and exposes no provider path", async () => {
    const controller = new FakeFailureController([
      { mode: "offline", targetId: "desk_lamp" },
    ]);
    const moduleExports = Object.keys(
      await import("../../../src/room/adapters/fake-failures"),
    );

    expect(controller.snapshot()).toEqual([
      { mode: "offline", targetId: "desk_lamp" },
    ]);
    expect(
      moduleExports.some((name) =>
        /persist|network|hardware|provider|render|discover|sdk|connect/i.test(
          name,
        ),
      ),
    ).toBe(false);
  });
});
