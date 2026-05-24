import { describe, expect, it } from "vitest";

import {
  approvedContext,
  conformanceSubjects,
  enableFailure,
  readState,
  roomCommand,
} from "./harness";

describe("room adapter conformance: offline failure", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} fails closed for offline reads and writes`, async () => {
      const adapter = subject.create();
      enableFailure(adapter, "offline", subject.devices.power);

      await expect(
        readState(adapter, subject.devices.power),
      ).resolves.toMatchObject({
        ok: false,
        state: null,
        failure_class: "adapter_unavailable",
      });
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
        failure_class: "adapter_unavailable",
        state: { power: "off" },
      });
    });
  }
});
