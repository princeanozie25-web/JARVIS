import { describe, expect, it } from "vitest";

import {
  approvedContext,
  conformanceSubjects,
  enableFailure,
  roomCommand,
} from "./harness";

describe("room adapter conformance: auth failure", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} returns typed simulated auth failures`, async () => {
      const adapter = subject.create();
      enableFailure(adapter, "auth_error", subject.devices.power);

      await expect(
        adapter.executeCommand({
          command: {
            ...roomCommand({
              deviceId: subject.devices.power,
              capability: "power.switch",
              value: true,
            }),
            mode: "approved_execution",
          },
          context: approvedContext(),
        }),
      ).resolves.toMatchObject({
        ok: false,
        failure_class: "auth_error",
        state: { power: "off" },
      });
    });
  }
});
