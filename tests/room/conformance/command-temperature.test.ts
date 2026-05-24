import { describe, expect, it } from "vitest";

import {
  conformanceSubjects,
  executeApproved,
  expectNoSideEffects,
  planDryRun,
  readState,
  roomCommand,
} from "./harness";

describe("room adapter conformance: temperature command", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} plans and executes one color-temperature action`, async () => {
      const adapter = subject.create();
      const command = roomCommand({
        deviceId: subject.devices.temperature,
        capability: "light.temperature",
        value: 2700,
      });

      const plan = await planDryRun(adapter, command);
      expect(plan).toMatchObject({
        command: {
          device_id: subject.devices.temperature,
          capability: "light.temperature",
          action: "set_temperature",
          one_command_one_action: true,
        },
        intended_state: { color_temperature_kelvin: 2700 },
      });
      await expect(
        readState(adapter, subject.devices.temperature),
      ).resolves.toMatchObject({
        state: { color_temperature_kelvin: null },
      });

      const result = await executeApproved(adapter, command);
      expect(result).toMatchObject({
        ok: true,
        state: { color_temperature_kelvin: 2700 },
      });
      expectNoSideEffects(result);
    });
  }
});
