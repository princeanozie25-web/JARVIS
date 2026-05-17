import { describe, expect, it } from "vitest";
import { providerToolMetadata, tools } from "../tools";
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
          parameters: {
            type: "object",
            properties: {
              echo: { type: "string" },
            },
            required: [],
            additionalProperties: false,
          },
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

  it("converts read-only filesystem tools to strict OpenAI object schemas", () => {
    const metadata = providerToolMetadata(tools, (toolId) =>
      ["fs.list_dir", "fs.read_file", "fs.stat"].includes(toolId),
    );

    const openAiTools = toOpenAITools(metadata.definitions);

    expect(openAiTools?.map((item) => item.function.name)).toEqual([
      "fs_list_dir",
      "fs_read_file",
      "fs_stat",
    ]);
    for (const toolDef of openAiTools ?? []) {
      expect(toolDef.function.parameters).toMatchObject({
        type: "object",
        properties: {
          path: expect.objectContaining({ type: "string" }),
        },
        required: [],
        additionalProperties: false,
      });
      expect(
        objectSchemasMissingAdditionalProperties(toolDef.function.parameters),
      ).toEqual([]);
    }
  });

  it("fills empty OpenAI parameter objects with strict object defaults", () => {
    const emptyTool: ProviderToolDefinition = {
      id: "mock.empty",
      name: "mock_empty",
      description: "Empty object input.",
      inputSchema: { type: "object" },
    };

    expect(toOpenAITools([emptyTool])?.[0]?.function.parameters).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
  });

  it("recursively sets additionalProperties false on OpenAI object schemas", () => {
    const nestedTool: ProviderToolDefinition = {
      id: "mock.nested",
      name: "mock_nested",
      description: "Nested object input.",
      inputSchema: {
        type: "object",
        properties: {
          nested: {
            type: "object",
            properties: {
              value: { type: "string" },
            },
          },
        },
      },
    };

    const parameters = toOpenAITools([nestedTool])?.[0]?.function.parameters;

    expect(parameters).toMatchObject({
      additionalProperties: false,
      properties: {
        nested: {
          additionalProperties: false,
          required: [],
        },
      },
    });
    expect(objectSchemasMissingAdditionalProperties(parameters)).toEqual([]);
  });
});

function objectSchemasMissingAdditionalProperties(
  value: unknown,
  path = "$",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      objectSchemasMissingAdditionalProperties(item, `${path}[${index}]`),
    );
  }
  if (value === null || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const missing =
    record.type === "object" && record.additionalProperties !== false
      ? [path]
      : [];

  return [
    ...missing,
    ...Object.entries(record).flatMap(([key, child]) =>
      objectSchemasMissingAdditionalProperties(child, `${path}.${key}`),
    ),
  ];
}
