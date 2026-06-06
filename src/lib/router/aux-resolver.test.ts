import { describe, expect, it } from "vitest";

import type { ModelEntry } from "../models";
import {
  evaluateAuxOutputQuality,
  parseAuxRoutingConfig,
  resolveAuxModel,
} from "./aux-resolver";
import { routeMessages } from "./index";

const T2_MODEL: ModelEntry = {
  id: "openai/t2-aux",
  provider: "openai",
  modelName: "t2-aux",
  tier: "T2",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: {
    inputPerMillionUsd: 0.2,
    outputPerMillionUsd: 0.8,
  },
};

const T3_MODEL: ModelEntry = {
  id: "openai/t3-main",
  provider: "openai",
  modelName: "t3-main",
  tier: "T3",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: {
    inputPerMillionUsd: 1,
    outputPerMillionUsd: 4,
  },
};

const T4_MODEL: ModelEntry = {
  id: "anthropic/t4-large",
  provider: "anthropic",
  modelName: "t4-large",
  tier: "T4",
  capabilities: ["text", "stream"],
  enabled: true,
};

describe("router auxiliary model resolver", () => {
  it("resolves summary to a T2/T3 aux model instead of the main model", () => {
    const main = routeMessages([{ role: "user", content: "hello Jarvis" }]);
    const aux = resolveAuxModel("summary");

    expect(aux.selection.model.tier).toMatch(/^T[23]$/);
    expect(aux.selection.model.id).not.toBe(main.selection.model.id);
    expect(aux.selection.model.id).toBe("anthropic/claude-haiku-summary-aux");
    expect(aux.safety.safetyTag).toBe("ALLOW");
  });

  it("respects maxTier and never selects T3/T4 when clamped to T2", () => {
    const aux = resolveAuxModel("summary", {
      candidates: [T2_MODEL, T3_MODEL, T4_MODEL],
      config: {
        summary: {
          minTier: "T1",
          maxTier: "T2",
          requires: ["text", "stream"],
          prefer: "cheapest",
        },
      },
      fallbackModel: T3_MODEL,
    });

    expect(aux.selection.model.id).toBe("openai/t2-aux");
    expect(aux.selection.model.tier).toBe("T2");
  });

  it("uses user overrides from aux-routing yaml", () => {
    const config = parseAuxRoutingConfig(`
summary: { minTier: T1, maxTier: T1, requires: [text], prefer: cheapest }
`);
    const aux = resolveAuxModel("summary", { config });

    expect(aux.selection.model.id).toBe("anthropic/claude-haiku-title-aux");
    expect(aux.selection.model.tier).toBe("T1");
  });

  it("escalates visibly when aux output fails schema validation", () => {
    const aux = resolveAuxModel("summary", {
      candidates: [T2_MODEL, T3_MODEL],
      config: {
        summary: {
          minTier: "T2",
          maxTier: "T3",
          requires: ["text", "stream"],
          prefer: "cheapest",
        },
      },
      fallbackModel: T3_MODEL,
    });

    const quality = evaluateAuxOutputQuality({
      resolution: aux,
      schemaValid: false,
      candidates: [T2_MODEL, T3_MODEL],
      config: {
        summary: {
          minTier: "T2",
          maxTier: "T3",
          requires: ["text", "stream"],
          prefer: "cheapest",
        },
      },
    });

    expect(quality).toMatchObject({
      status: "escalated",
      reason: "schema_validation_failed",
      silent: false,
      from_model: { id: "openai/t2-aux" },
      to_model: { id: "openai/t3-main" },
      maxTier: "T3",
    });
  });

  it("falls back to the main model and logs when config is missing", () => {
    const logged: string[] = [];
    const aux = resolveAuxModel("summary", {
      config: {},
      logger: (message) => logged.push(message),
    });

    expect(aux.fallback_used).toBe(true);
    expect(aux.fallback_reason).toBe("missing_config");
    expect(aux.selection.model.id).toBe("openai/gpt-4o-mini");
    expect(logged.join("\n")).toContain("missing aux routing config");
  });

  it("keeps normal top-level routing unchanged", () => {
    const decision = routeMessages([{ role: "user", content: "hello Jarvis" }]);

    expect({
      intent: decision.intent.intent,
      safety: decision.safety.safetyTag,
      tier: decision.capability.tier,
      provider: decision.selection.providerId,
      model: decision.selection.model.modelName,
    }).toMatchInlineSnapshot(`
      {
        "intent": "CONVERSATIONAL",
        "model": "gpt-4o-mini",
        "provider": "openai",
        "safety": "ALLOW",
        "tier": "T3",
      }
    `);
  });
});
