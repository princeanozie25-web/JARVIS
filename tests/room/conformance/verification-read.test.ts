import { describe, expect, it } from "vitest";

import {
  approvedContext,
  conformanceSubjects,
  executeApproved,
  expectNoSideEffects,
  roomCommand,
} from "./harness";

describe("room adapter conformance: verification read", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} verification reads reflect post-command state`, async () => {
      const adapter = subject.create();
      const command = roomCommand({
        deviceId: subject.devices.power,
        capability: "power.switch",
        value: true,
      });

      await executeApproved(adapter, command);
      const verification = await adapter.verifyState({
        command: { ...command, mode: "approved_execution" },
        context: approvedContext(),
      });

      expect(verification).toMatchObject({
        ok: true,
        operation: "verify_state",
        mode: "approved_execution",
        state: { power: "on" },
        provenance: {
          device_id: subject.devices.power,
          capability: "power.switch",
          metadata_only: true,
        },
      });
      expectNoSideEffects(verification);
    });
  }
});
