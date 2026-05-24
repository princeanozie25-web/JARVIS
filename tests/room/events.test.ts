import { describe, expect, it } from "vitest";

import { FakeDeviceEventEmitter } from "../../src/room/adapters/fake-events";
import { FakeRoomAdapter } from "../../src/room/adapters/fake-room-adapter";
import { loadDefaultRoomRegistry } from "../../src/room/registry";
import type { RoomAdapterCommand } from "../../src/room/adapters/contract";

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
    command_id: "command-events-1",
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

describe("Phase 10B.8 fake device event emitter", () => {
  it("fake state reads emit metadata-only state_read events", async () => {
    const fake = adapter();

    await fake.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(fake.getEvents()).toEqual([
      expect.objectContaining({
        event_id: "fake-event-000001",
        event_type: "state_read",
        timestamp: 1,
        adapter_id: "fake-room-adapter",
        adapter_kind: "fake",
        room_id: "bedroom-workspace",
        profile_id: "bedroom-workspace-default",
        device_id: "desk_lamp",
        sensor_id: null,
        capability: "power.observe",
        result_status: "ok",
        failure_class: null,
        fake_only: true,
        local_only: true,
        metadata_only: true,
        redacted: true,
        raw_payload_included: false,
        secrets_included: false,
      }),
    ]);
  });

  it("dry-run planning emits command_planned events with provenance", async () => {
    const fake = adapter();

    await fake.planCommand({
      command: command(),
      context: { mode: "dry_run", timeoutMs: 5_000 },
    });

    expect(fake.getEvents()).toEqual([
      expect.objectContaining({
        event_type: "command_planned",
        command_id: "command-events-1",
        plan_id: "plan-command-events-1",
        result_status: "planned",
        provenance: expect.objectContaining({
          correlation_id: "plan-command-events-1",
          requested_by: "jarvis_room_os",
          source_phase: "10B.3",
          metadata_only: true,
        }),
      }),
    ]);
  });

  it("approved execution emits command_executed events", async () => {
    const fake = adapter();

    await fake.executeCommand({
      command: command({ mode: "approved_execution" }),
      context: {
        mode: "approved_execution",
        timeoutMs: 5_000,
        approvalId: "approval-events-1",
      },
    });

    expect(fake.getEvents()).toEqual([
      expect.objectContaining({
        event_type: "command_executed",
        command_id: "command-events-1",
        result_status: "ok",
        failure_class: null,
        provenance: expect.objectContaining({
          approval_id: "approval-events-1",
          device_id: "desk_lamp",
          capability: "power.switch",
        }),
      }),
    ]);
  });

  it("verification reads emit verification_read events", async () => {
    const fake = adapter();
    const approved = command({ mode: "approved_execution" });
    await fake.executeCommand({
      command: approved,
      context: {
        mode: "approved_execution",
        timeoutMs: 5_000,
        approvalId: "approval-events-1",
      },
    });

    await fake.verifyState({
      command: approved,
      context: {
        mode: "approved_execution",
        timeoutMs: 5_000,
        approvalId: "approval-events-1",
      },
    });

    expect(fake.getEvents().map((event) => event.event_type)).toEqual([
      "command_executed",
      "verification_read",
    ]);
    expect(fake.getEvents()[1]).toMatchObject({
      event_type: "verification_read",
      command_id: "command-events-1",
      result_status: "ok",
    });
  });

  it("rejected commands emit command_rejected events", async () => {
    const fake = adapter();

    await fake.executeCommand({
      command: command({ mode: "approved_execution" }),
      context: { mode: "approved_execution", timeoutMs: 5_000 },
    });

    expect(fake.getEvents()).toEqual([
      expect.objectContaining({
        event_type: "command_rejected",
        command_id: "command-events-1",
        result_status: "rejected",
        failure_class: "approval_missing",
      }),
    ]);
  });

  it("simulated failures emit failure_simulated events", async () => {
    const fake = adapter();
    fake.enableFailure("offline", "desk_lamp");

    await fake.readState({
      deviceId: "desk_lamp",
      capability: "power.observe",
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(fake.getEvents().map((event) => event.event_type)).toEqual([
      "state_read",
      "failure_simulated",
    ]);
    expect(fake.getEvents()[1]).toMatchObject({
      event_type: "failure_simulated",
      device_id: "desk_lamp",
      capability: "power.observe",
      result_status: "failed",
      failure_class: "adapter_unavailable",
    });
  });

  it("health checks emit health_checked events", async () => {
    const fake = adapter();

    await fake.healthCheck({
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(fake.getEvents()).toEqual([
      expect.objectContaining({
        event_type: "health_checked",
        result_status: "checked",
        capability: null,
        device_id: null,
        sensor_id: null,
        provenance: null,
      }),
    ]);
  });

  it("events do not expose raw payloads or secrets", async () => {
    const fake = adapter();

    await fake.executeCommand({
      command: command({
        mode: "approved_execution",
        capability: "light.color",
        action: "set_color",
        device_id: "led_strip",
        value: "#abcdef",
      }),
      context: {
        mode: "approved_execution",
        timeoutMs: 5_000,
        approvalId: "approval-events-1",
      },
    });

    const serialized = JSON.stringify(fake.getEvents());
    expect(serialized).not.toContain("#abcdef");
    expect(serialized).not.toContain("value");
    expect(fake.getEvents()[0]).toMatchObject({
      metadata_only: true,
      redacted: true,
      raw_payload_included: false,
      secrets_included: false,
    });
  });

  it("event snapshots are defensive copies", async () => {
    const fake = adapter();
    await fake.healthCheck({
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    const snapshot = fake.getEvents();
    (snapshot[0] as { event_type: string }).event_type = "command_executed";

    expect(fake.getEvents()[0].event_type).toBe("health_checked");
  });

  it("fresh adapters and emitters start clean", async () => {
    const first = adapter();
    await first.healthCheck({
      context: { mode: "read_only", timeoutMs: 5_000 },
    });

    expect(first.getEvents()).toHaveLength(1);
    expect(adapter().getEvents()).toEqual([]);
    expect(new FakeDeviceEventEmitter().snapshot()).toEqual([]);
  });

  it("exposes no persistence, network, hardware, UI, or provider path", async () => {
    const eventsModule = await import("../../src/room/adapters/fake-events");
    const adapterModule =
      await import("../../src/room/adapters/fake-room-adapter");
    const exportedNames = [
      ...Object.keys(eventsModule),
      ...Object.keys(adapterModule),
    ];

    expect(
      exportedNames.some((name) =>
        /persist|network|hardware|provider|render|discover|sdk|connect/i.test(
          name,
        ),
      ),
    ).toBe(false);
    expect(
      new FakeDeviceEventEmitter().emit({
        event_type: "health_checked",
        adapter_id: "fake-room-adapter",
        result_status: "checked",
      }),
    ).toMatchObject({
      persisted: false,
      network_called: false,
      hardware_io_performed: false,
      ui_rendered: false,
      provider_called: false,
    });
  });
});
