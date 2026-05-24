import { describe, expect, it } from "vitest";

import { conformanceSubjects, enableFailure, readState } from "./harness";

describe("room adapter conformance: stale failure", () => {
  for (const subject of conformanceSubjects) {
    it(`${subject.name} returns readable state marked stale`, async () => {
      const adapter = subject.create();
      enableFailure(adapter, "stale", subject.devices.power);

      await expect(
        readState(adapter, subject.devices.power),
      ).resolves.toMatchObject({
        ok: true,
        failure_class: null,
        state: {
          power: "off",
          freshness: {
            observed_at_ms: 0,
            stale_after_ms: 1,
            expires_at_ms: 1,
            source: "mock",
          },
        },
      });
    });
  }
});
