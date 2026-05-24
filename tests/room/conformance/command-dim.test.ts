import { describe, expect, it } from "vitest";

import {
  conformanceSubjects,
  executeApproved,
  expectNoSideEffects,
  planDryRun,
  readState,
  roomCommand,
} from "./harness";

describe("room adapter conformance: dim command", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} plans and executes one brightness action`, async () => {
      const adapter = subject.create();
      const command = roomCommand({
        deviceId: subject.devices.dim,
        capability: "light.dimmer",
        value: 64,
      });

      const plan = await planDryRun(adapter, command);
      expect(plan).toMatchObject({
        command: {
          device_id: subject.devices.dim,
          capability: "light.dimmer",
          action: "set_brightness",
          one_command_one_action: true,
        },
        intended_state: { brightness_percent: 64 },
      });
      await expect(
        readState(adapter, subject.devices.dim),
      ).resolves.toMatchObject({
        state: { brightness_percent: 0 },
      });

      const result = await executeApproved(adapter, command);
      expect(result).toMatchObject({
        ok: true,
        state: { brightness_percent: 64 },
      });
      expectNoSideEffects(result);
    });
  }
});
