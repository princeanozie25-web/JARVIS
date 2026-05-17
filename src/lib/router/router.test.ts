import { describe, expect, it } from "vitest";
import type { ModelEntry } from "../models";
import { matchCapability } from "./capability";
import { enforceRouterSafety } from "./enforcement";
import { classifyIntent } from "./intent";
import { routeMessages } from "./index";
import { classifySafety } from "./safety";
import { selectModel } from "./selection";
import type { IntentClass, SafetyTag } from "./types";

const samples: Array<{
  text: string;
  intent: IntentClass;
  safetyTag: SafetyTag;
}> = [
  { text: "hello Jarvis", intent: "CONVERSATIONAL", safetyTag: "ALLOW" },
  {
    text: "what time is it?",
    intent: "INFORMATION_REQUEST",
    safetyTag: "ALLOW",
  },
  {
    text: "write a short update",
    intent: "CREATIVE_TASK",
    safetyTag: "CONFIRM_ONCE",
  },
  {
    text: "rewrite this sentence",
    intent: "CREATIVE_TASK",
    safetyTag: "ALLOW",
  },
  { text: "review this code", intent: "REASONING_TASK", safetyTag: "ALLOW" },
  { text: "debug this error", intent: "REASONING_TASK", safetyTag: "ALLOW" },
  {
    text: "open Downloads",
    intent: "DETERMINISTIC_COMMAND",
    safetyTag: "ALLOW",
  },
  {
    text: "delete that file",
    intent: "AMBIGUOUS",
    safetyTag: "CONFIRM_ALWAYS",
  },
  { text: "my api key is exposed", intent: "AMBIGUOUS", safetyTag: "BLOCK" },
  {
    text: "compare these two designs",
    intent: "REASONING_TASK",
    safetyTag: "ALLOW",
  },
];

describe("router stages", () => {
  it.each(samples)("classifies $text", ({ text, intent, safetyTag }) => {
    const messages = [{ role: "user" as const, content: text }];

    expect(classifyIntent(messages).intent).toBe(intent);
    expect(classifySafety(messages).safetyTag).toBe(safetyTag);
  });

  it("matches normal chat to the current cloud chat tier", () => {
    const capability = matchCapability(
      { intent: "CONVERSATIONAL", reason: "test" },
      { safetyTag: "ALLOW", reason: "test" },
    );

    expect(capability.tier).toBe("T3");
    expect(capability.requiredCapabilities).toEqual(["text", "stream"]);
  });

  it("selects OpenAI by default for normal chat", () => {
    const decision = routeMessages([{ role: "user", content: "hello Jarvis" }]);

    expect(decision.selection.providerId).toBe("openai");
    expect(decision.selection.model.modelName).toBe("gpt-4o-mini");
    expect(decision.capability.tier).toBe("T3");
  });

  it("preserves an explicit provider request", () => {
    const decision = routeMessages(
      [{ role: "user", content: "hello Jarvis" }],
      { requestedProvider: "anthropic" },
    );

    expect(decision.selection.providerId).toBe("anthropic");
  });

  it("keeps command-shaped chat on the current model until tools exist", () => {
    const decision = routeMessages([
      { role: "user", content: "open Downloads" },
    ]);

    expect(decision.intent.intent).toBe("DETERMINISTIC_COMMAND");
    expect(decision.capability.tier).toBe("T0");
    expect(decision.capability.requiredCapabilities).toEqual(["tools"]);
    expect(decision.selection.providerId).toBe("openai");
    expect(decision.selection.model.modelName).toBe("gpt-4o-mini");
  });

  it("falls back to any capable model if requested provider has no candidate", () => {
    const candidates: ModelEntry[] = [
      {
        id: "openai/test",
        provider: "openai",
        modelName: "test-model",
        tier: "T3",
        capabilities: ["text", "stream"],
        enabled: true,
      },
    ];

    const selected = selectModel(
      {
        tier: "T3",
        requiredCapabilities: ["text", "stream"],
        reason: "test",
      },
      { requestedProvider: "anthropic", candidates },
    );

    expect(selected.providerId).toBe("openai");
  });

  it("allows ALLOW decisions to continue", () => {
    const decision = routeMessages([{ role: "user", content: "hello Jarvis" }]);

    expect(decision.safety.safetyTag).toBe("ALLOW");
    expect(enforceRouterSafety(decision)).toBeNull();
  });

  it("blocks BLOCK decisions before execution", () => {
    const decision = routeMessages([
      { role: "user", content: "my api key is exposed" },
    ]);
    const response = enforceRouterSafety(decision);

    expect(response).toMatchObject({
      status: 403,
      eventType: "safety_blocked",
      body: {
        reason: "safety_blocked",
        safetyTag: "BLOCK",
      },
    });
  });

  it("carries CONFIRM_ONCE decisions without blocking chat", () => {
    const decision = routeMessages([
      { role: "user", content: "write a short update" },
    ]);
    const response = enforceRouterSafety(decision);

    expect(decision.safety.safetyTag).toBe("CONFIRM_ONCE");
    expect(response).toBeNull();
  });

  it("carries CONFIRM_ALWAYS decisions without blocking chat", () => {
    const decision = routeMessages([
      { role: "user", content: "delete that file" },
    ]);
    const response = enforceRouterSafety(decision);

    expect(decision.safety.safetyTag).toBe("CONFIRM_ALWAYS");
    expect(response).toBeNull();
  });
});
