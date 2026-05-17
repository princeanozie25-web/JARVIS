import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_ID, models, ModelRegistry } from "./index";
import type { ModelEntry } from "./types";

const sampleEntry: ModelEntry = {
  id: "test/sample",
  provider: "openai",
  modelName: "sample-model",
  tier: "T3",
  capabilities: ["text"],
  enabled: true,
};

describe("ModelRegistry", () => {
  it("registers and retrieves entries by id", () => {
    const reg = new ModelRegistry();
    reg.register(sampleEntry);
    expect(reg.has("test/sample")).toBe(true);
    expect(reg.get("test/sample")).toEqual(sampleEntry);
  });

  it("throws when getting an unregistered id", () => {
    const reg = new ModelRegistry();
    expect(() => reg.get("missing/id")).toThrow("Model not registered");
  });

  it("getDefaultForProvider returns first enabled match", () => {
    const reg = new ModelRegistry();
    reg.register({ ...sampleEntry, id: "openai/disabled", enabled: false });
    reg.register({ ...sampleEntry, id: "openai/active" });
    reg.register({ ...sampleEntry, id: "openai/second-active" });

    expect(reg.getDefaultForProvider("openai").id).toBe("openai/active");
  });

  it("getDefaultForProvider throws when nothing matches", () => {
    const reg = new ModelRegistry();
    expect(() => reg.getDefaultForProvider("anthropic")).toThrow(
      "No enabled model registered",
    );
  });
});

describe("seeded models registry", () => {
  it("registers the OpenAI and Anthropic defaults", () => {
    expect(models.has(DEFAULT_MODEL_ID)).toBe(true);
    expect(models.getDefaultForProvider("openai").id).toBe(DEFAULT_MODEL_ID);
    const anthropic = models.getDefaultForProvider("anthropic");
    expect(anthropic.modelName).toBe("claude-haiku-4-5-20251001");
    expect(anthropic.pricing).toEqual({
      inputPerMillionUsd: 1,
      outputPerMillionUsd: 5,
    });
  });
});
