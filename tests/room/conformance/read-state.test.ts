import { describe, expect, it } from "vitest";

import { conformanceSubjects, expectNoSideEffects, readState } from "./harness";

describe("room adapter conformance: read_state", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} returns deterministic defensive read-state results`, async () => {
      const adapter = subject.create();
      const first = await readState(adapter, subject.devices.power);
      const second = await readState(adapter, subject.devices.power);

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        ok: true,
        operation: "read_state",
        mode: "read_only",
        failure_class: null,
        state: { power: "off" },
      });
      expectNoSideEffects(first);

      if (!first.state || !("power" in first.state)) {
        throw new Error("Expected device state.");
      }
      first.state.power = "on";

      await expect(
        readState(adapter, subject.devices.power),
      ).resolves.toMatchObject({
        state: { power: "off" },
      });
    });
  }
});
