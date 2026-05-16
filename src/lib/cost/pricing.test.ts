import { describe, expect, it } from "vitest";
import { calculateOpenAICostUsd } from "./pricing";

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

  it("throws when usage is present but model pricing is unknown", () => {
    expect(() => calculateOpenAICostUsd("unknown-model", 1, 1)).toThrow(
      "Missing OpenAI pricing for model: unknown-model",
    );
  });
});
