import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { models } from "@/lib/models";
import { matchCapability } from "@/lib/router/capability";
import {
  resolveDefaultChatProvider,
  selectModel,
} from "@/lib/router/selection";

// E-037 — default chat routing is configuration, and the local brain is a
// first-class provider. The frozen router tests still see OpenAI with an
// empty env; this file covers the local-first path.

const chat = matchCapability(
  { intent: "CONVERSATIONAL", reason: "test" },
  { safetyTag: "ALLOW", reason: "test" },
);

describe("E-037 default chat provider", () => {
  it("resolves ollama from JARVIS_LOCAL_ONLY, an explicit override wins, empty env keeps the pre-25 default", () => {
    expect(resolveDefaultChatProvider({})).toBe("openai");
    expect(resolveDefaultChatProvider({ JARVIS_LOCAL_ONLY: "true" })).toBe(
      "ollama",
    );
    expect(
      resolveDefaultChatProvider({
        JARVIS_LOCAL_ONLY: "true",
        JARVIS_DEFAULT_CHAT_PROVIDER: "openai",
      }),
    ).toBe("openai");
    expect(
      resolveDefaultChatProvider({ JARVIS_DEFAULT_CHAT_PROVIDER: "ollama" }),
    ).toBe("ollama");
    expect(
      resolveDefaultChatProvider({ JARVIS_DEFAULT_CHAT_PROVIDER: "bogus" }),
    ).toBe("openai");
  });

  it("routes normal chat to the 9B workhorse when ollama is the default", () => {
    const selection = selectModel(chat, { defaultProvider: "ollama" });
    expect(selection.providerId).toBe("ollama");
    expect(selection.model.modelName).toBe("qwen3.5:9b-mlx");
    expect(selection.reason).toBe("Selected default ollama chat model.");
  });

  it("registers both M1 Max models at zero cost (tools offered on-stream, not as the T0 tier flag)", () => {
    const nine = models.get("ollama/qwen3.5-9b-mlx");
    const twentySeven = models.get("ollama/qwen3.5-27b-mlx");
    for (const entry of [nine, twentySeven]) {
      expect(entry.provider).toBe("ollama");
      expect(entry.enabled).toBe(true);
      expect(entry.capabilities).toEqual(
        expect.arrayContaining(["text", "stream", "vision"]),
      );
      expect(entry.capabilities).not.toContain("tools");
      expect(entry.pricing).toEqual({
        inputPerMillionUsd: 0,
        outputPerMillionUsd: 0,
      });
    }
    expect(models.getDefaultForProvider("ollama").modelName).toBe(
      "qwen3.5:9b-mlx",
    );
  });

  it("cloud keys are optional at import and cloud providers register only when keyed", () => {
    const config = readFileSync("src/lib/runtime/config.ts", "utf8");
    expect(config).not.toContain("requiredEnv");
    expect(config).toContain('optionalEnv("OPENAI_API_KEY")');
    const registry = readFileSync("src/lib/providers/registry.ts", "utf8");
    expect(registry).toContain("registry.register(new OllamaProvider());");
    expect(registry).toContain(
      "if (config.openai.apiKey) registry.register(new OpenAIProvider());",
    );
    expect(registry).toContain(
      "if (config.anthropic.apiKey) registry.register(new AnthropicProvider());",
    );
  });

  it("the provider never touches the Gate executor files", () => {
    const source = readFileSync("src/lib/providers/ollama.ts", "utf8");
    expect(source).not.toMatch(
      /tool-approvals|tool-continuation|tools\/runtime|mcp-gateway|runTool/,
    );
    expect(source).not.toMatch(/console\.log|writeFile|appendFile/);
  });
});
