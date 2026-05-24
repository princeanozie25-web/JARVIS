import { describe, expect, it } from "vitest";

import {
  approvedContext,
  conformanceSubjects,
  enableFailure,
  roomCommand,
} from "./harness";

describe("room adapter conformance: timeout failure", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} returns typed timeout failures without waiting`, async () => {
      const adapter = subject.create();
      enableFailure(adapter, "timeout", subject.devices.power);
      const startedAt = Date.now();

      const result = await adapter.executeCommand({
        command: {
          ...roomCommand({
            deviceId: subject.devices.power,
            capability: "power.switch",
            value: true,
          }),
          mode: "approved_execution",
        },
        context: approvedContext(),
      });

      expect(Date.now() - startedAt).toBeLessThan(50);
      expect(result).toMatchObject({
        ok: false,
        failure_class: "timeout",
        state: { power: "off" },
      });
    });
  }
});
