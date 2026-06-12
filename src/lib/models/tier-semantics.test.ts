import { describe, expect, it } from "vitest";

import { resolveAuxModel } from "../router/aux-resolver";
import "./entries";
import { models } from "./registry";
import type { ModelEntry, ModelTier } from "./types";

const T3_FLOOR_MODEL: ModelEntry = {
  id: "openai/t3-floor",
  provider: "openai",
  modelName: "t3-floor",
  tier: "T3",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: {
    inputPerMillionUsd: 1,
    outputPerMillionUsd: 4,
  },
};

const T4_FRONTIER_MODEL: ModelEntry = {
  id: "anthropic/t4-frontier",
  provider: "anthropic",
  modelName: "t4-frontier",
  tier: "T4",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: {
    inputPerMillionUsd: 5,
    outputPerMillionUsd: 20,
  },
};

describe("Phase 23A model tier semantics", () => {
  it("keeps T4 in the ModelTier union", () => {
    const frontier: ModelTier = "T4";

    expect(["T0", "T1", "T2", "T3", "T4"]).toContain(frontier);
    expect(T4_FRONTIER_MODEL.tier).toBe("T4");
  });

  it("registers zero production T4 entries", () => {
    expect(models.list((entry) => entry.tier === "T4")).toHaveLength(0);
  });

  it("treats the analysis tier as a floor: picks T3 when T3 and T4 both qualify", () => {
    const aux = resolveAuxModel("summary", {
      candidates: [T3_FLOOR_MODEL, T4_FRONTIER_MODEL],
      config: {
        summary: {
          minTier: "T3",
          maxTier: "T4",
          requires: ["text", "stream"],
          prefer: "cheapest",
        },
      },
      fallbackModel: T3_FLOOR_MODEL,
    });

    expect(aux.fallback_used).toBe(false);
    expect(aux.selection.model.tier).toBe("T3");
    expect(aux.selection.model.id).toBe("openai/t3-floor");
  });
});
