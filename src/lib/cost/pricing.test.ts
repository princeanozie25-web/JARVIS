import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateOpenAICostUsd } from "./pricing";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("calculateOpenAICostUsd", () => {
  it("calculates token-based cost for gpt-4o-mini", () => {
    expect(calculateOpenAICostUsd("gpt-4o-mini", 1_000, 2_000)).toBeCloseTo(
      0.00135,
    );
  });

  it("uses a safe fallback when usage is missing", () => {
    expect(calculateOpenAICostUsd("gpt-4o-mini")).toBe(0.001);
    expect(calculateOpenAICostUsd("gpt-4o-mini", 1_000)).toBe(0.001);
  });

  it("falls back to a safe cost and warns when model pricing is unknown", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(calculateOpenAICostUsd("unknown-model", 1, 1)).toBe(0.001);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("unknown-model");
  });
});
