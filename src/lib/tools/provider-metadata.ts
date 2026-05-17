import type { ProviderToolDefinition } from "../providers";
import { z } from "zod";
import { ToolRegistry, tools } from "./registry";

export interface ProviderToolMetadata {
  definitions: ProviderToolDefinition[];
  nameToId: Map<string, string>;
}

export function providerToolName(toolId: string): string {
  return toolId.replace(/[^A-Za-z0-9_-]/g, "_");
}

function providerInputSchema(tool: ReturnType<ToolRegistry["list"]>[number]) {
  try {
    return z.toJSONSchema(tool.inputSchema, {
      io: "input",
    }) as ProviderToolDefinition["inputSchema"];
  } catch {
    return {
      type: "object" as const,
      properties: {},
      required: [],
      additionalProperties: false,
    };
  }
}

export function providerToolMetadata(
  registry: ToolRegistry = tools,
  filter: (toolId: string) => boolean = () => true,
): ProviderToolMetadata {
  const nameToId = new Map<string, string>();
  const definitions = registry
    .list()
    .filter((tool) => filter(tool.id))
    .map((tool) => {
      const name = providerToolName(tool.id);
      nameToId.set(name, tool.id);
      return {
        id: tool.id,
        name,
        description: tool.description,
        inputSchema: providerInputSchema(tool),
      };
    });

  return { definitions, nameToId };
}
