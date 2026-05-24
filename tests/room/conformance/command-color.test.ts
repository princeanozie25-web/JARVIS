import { describe, expect, it } from "vitest";

import {
  conformanceSubjects,
  executeApproved,
  expectNoSideEffects,
  planDryRun,
  readState,
  roomCommand,
} from "./harness";

describe("room adapter conformance: color command", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} plans and executes one color action`, async () => {
      const adapter = subject.create();
      const command = roomCommand({
        deviceId: subject.devices.color,
        capability: "light.color",
        value: "#ffffff",
      });

      const plan = await planDryRun(adapter, command);
      expect(plan).toMatchObject({
        command: {
          device_id: subject.devices.color,
          capability: "light.color",
          action: "set_color",
          one_command_one_action: true,
        },
        intended_state: { color_hex: "#ffffff" },
      });
      await expect(
        readState(adapter, subject.devices.color),
      ).resolves.toMatchObject({
        state: { color_hex: "#00aaff" },
      });

      const result = await executeApproved(adapter, command);
      expect(result).toMatchObject({
        ok: true,
        state: { color_hex: "#ffffff" },
      });
      expectNoSideEffects(result);
    });
  }
});
