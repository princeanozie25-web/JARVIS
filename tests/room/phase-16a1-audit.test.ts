import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const AUDIT_PATH = join(
  process.cwd(),
  "docs/phase-16/phase-16a1-fake-adapter-gap-map.md",
);

describe("Phase 16A.1 fake adapter hardening audit", () => {
  it("documents the fake adapter gap map and Phase 16A requirements", () => {
    expect(existsSync(AUDIT_PATH)).toBe(true);
    const markdown = readFileSync(AUDIT_PATH, "utf8");

    expect(markdown).toContain(
      "# Phase 16A.1 Fake Adapter Hardening Audit + Gap Map",
    );
    expect(markdown).toContain("**PARTIAL**");
    expect(markdown).toContain("Current Fake Adapter Capabilities");
    expect(markdown).toContain("Current Conformance Coverage");
    expect(markdown).toContain("Missing Requirements For Phase 16A");
    expect(markdown).toContain("Recommended Next Slices");
    expect(markdown).toContain("Do Not Implement Yet");
    expect(markdown).toContain("Fake-to-real mismatch risk");

    for (const required of [
      "offline",
      "stale",
      "timeout",
      "auth_error",
      "partial_success",
      "Command rejection",
      "verification read",
      "rollback",
      "real Hue writes disabled",
      "auto-discovery disabled",
      "cloud Hue API disabled",
      "scenes/macros disabled",
      "schedules/time-based device actions disabled",
      "voice/JARVIS trust-class elevation disabled",
      "JARVIS policy edits disabled",
      "Do Not Implement Yet",
      "node-hue-api",
      "Real Hue bridge discovery",
    ]) {
      expect(markdown).toContain(required);
    }
  });
});
