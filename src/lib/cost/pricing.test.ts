import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateCostUsd } from "./pricing";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("calculateCostUsd", () => {
  it("calculates token-based cost for a registered model with pricing", () => {
    expect(calculateCostUsd("gpt-4o-mini", 1_000, 2_000)).toBeCloseTo(0.00135);
  });

  it("uses a safe fallback when usage is missing", () => {
    expect(calculateCostUsd("gpt-4o-mini")).toBe(0.001);
    expect(calculateCostUsd("gpt-4o-mini", 1_000)).toBe(0.001);
  });

  it("falls back silently when the model is registered without pricing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(calculateCostUsd("claude-haiku-4-5-20251001", 1_000, 2_000)).toBe(
      0.001,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back with a warning when the model is not registered at all", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(calculateCostUsd("unknown-model", 1, 1)).toBe(0.001);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("unknown-model");
  });
});
