import { describe, expect, it } from "vitest";
import type { ProviderToolDefinition } from "./types";
import { toAnthropicTools, toOpenAITools } from "./tools";

const tool: ProviderToolDefinition = {
  id: "mock.status",
  name: "mock_status",
  description: "Mock status check.",
  inputSchema: {
    type: "object",
    properties: {
      echo: { type: "string" },
    },
  },
};

describe("provider tool metadata adapters", () => {
  it("maps internal tool metadata to OpenAI function tools", () => {
    expect(toOpenAITools([tool])).toEqual([
      {
        type: "function",
        function: {
          name: "mock_status",
          description: "Mock status check.",
          parameters: tool.inputSchema,
        },
      },
    ]);
  });

  it("maps internal tool metadata to Anthropic tools", () => {
    expect(toAnthropicTools([tool])).toEqual([
      {
        name: "mock_status",
        description: "Mock status check.",
        input_schema: tool.inputSchema,
      },
    ]);
  });

  it("omits provider tool payloads when no tools are supplied", () => {
    expect(toOpenAITools()).toBeUndefined();
    expect(toAnthropicTools([])).toBeUndefined();
  });
});
