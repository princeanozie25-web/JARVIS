import type { ProviderToolDefinition } from "./types";

export interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function toStrictOpenAIParametersSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const strict = sanitizeOpenAISchemaNode(schema);
  if (!isRecord(strict) || strict.type !== "object") {
    return {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    };
  }
  return strict;
}

function sanitizeOpenAISchemaNode(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeOpenAISchemaNode);
  }

  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "$schema") continue;
    sanitized[key] = sanitizeOpenAISchemaNode(child);
  }

  if (sanitized.type === "object") {
    const properties = isRecord(sanitized.properties)
      ? (sanitized.properties as Record<string, unknown>)
      : {};
    sanitized.properties = properties;
    sanitized.required = Array.isArray(sanitized.required)
      ? sanitized.required
      : [];
    sanitized.additionalProperties = false;
  }

  return sanitized;
}

export function toOpenAITools(
  tools?: ProviderToolDefinition[],
): OpenAIToolDefinition[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toStrictOpenAIParametersSchema(tool.inputSchema),
    },
  }));
}

export function toAnthropicTools(
  tools?: ProviderToolDefinition[],
): AnthropicToolDefinition[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}
