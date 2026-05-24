import { describe, expect, it } from "vitest";

import { RoomAdapterCommandSchema } from "../../../src/room/adapters/contract";
import {
  approvedContext,
  conformanceSubjects,
  expectNoSideEffects,
  planDryRun,
  roomCommand,
} from "./harness";

describe("room adapter conformance: audit trail", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} emits provenance, approval, and no-side-effect metadata`, async () => {
      const adapter = subject.create();
      const command = roomCommand({
        deviceId: subject.devices.power,
        capability: "power.switch",
        value: true,
      });

      const plan = await planDryRun(adapter, command);
      expect(plan).toMatchObject({
        provenance: {
          requested_by: "jarvis_room_os",
          source_phase: "10B.3",
          adapter_id: adapter.descriptor.identity.adapter_id,
          device_id: subject.devices.power,
          capability: "power.switch",
          mode: "dry_run",
          dry_run: true,
          metadata_only: true,
        },
        approval: {
          required: true,
          dry_run_required: true,
          auto_approval_allowed: false,
          voice_only_approval_allowed: false,
        },
      });
      expectNoSideEffects(plan);

      const result = await adapter.executeCommand({
        command: { ...command, mode: "approved_execution" },
        context: approvedContext("approval-audit-1"),
      });
      expect(result).toMatchObject({
        provenance: {
          approval_id: "approval-audit-1",
          metadata_only: true,
        },
        approval: { required: true },
      });
      expectNoSideEffects(result);
    });

    it(`${subject.name} enforces one command = one device/capability action`, () => {
      const command = roomCommand({
        deviceId: subject.devices.power,
        capability: "power.switch",
        value: true,
      });

      expect(RoomAdapterCommandSchema.parse(command)).toMatchObject({
        device_id: subject.devices.power,
        capability: "power.switch",
        action: "set_power",
        one_command_one_action: true,
      });
      expect(
        RoomAdapterCommandSchema.safeParse({
          ...command,
          device_ids: [subject.devices.power, subject.devices.dim],
        }).success,
      ).toBe(false);
      expect(
        RoomAdapterCommandSchema.safeParse({
          ...command,
          capabilities: ["power.switch", "light.dimmer"],
        }).success,
      ).toBe(false);
    });

    it(`${subject.name} exposes no network, hardware, persistence, UI, or provider path`, async () => {
      const adapter = subject.create();
      const adapterModule =
        await import("../../../src/room/adapters/fake-room-adapter");
      const exportedNames = Object.keys(adapterModule);

      expect(adapterModule.FakeRoomAdapter).toBeDefined();
      expect(adapter.descriptor.identity).toMatchObject({
        real_hardware_io: false,
        network_access: false,
        persistence_access: false,
        ui_access: false,
        implementation_enabled: false,
      });
      expect(
        exportedNames.some((name) =>
          /persist|network|hardware|provider|render|discover|sdk|connect/i.test(
            name,
          ),
        ),
      ).toBe(false);
    });
  }
});
