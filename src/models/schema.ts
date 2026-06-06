import { z } from "zod";
import {
  MODEL_CAPABILITIES,
  MODEL_PROVIDER_KINDS,
  MODEL_RUNTIME_CLASSES,
  MODEL_TIERS,
  MODEL_VISIBILITIES,
} from "./types";

const ModelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

export const ModelProviderKindSchema = z.enum(MODEL_PROVIDER_KINDS);
export const ModelTierSchema = z.enum(MODEL_TIERS);
export const ModelCapabilitySchema = z.enum(MODEL_CAPABILITIES);
export const ModelRuntimeClassSchema = z.enum(MODEL_RUNTIME_CLASSES);
export const ModelVisibilitySchema = z.enum(MODEL_VISIBILITIES);

export const ModelRegistryEntryMetadataSchema = z.strictObject({
  display_name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(500),
  approximate_memory_mb: z.number().int().nonnegative().nullable(),
  cost_class: z.string().trim().min(1).max(80),
  governance_notes: z.string().trim().min(1).max(700),
});

export const ModelRegistryEntrySchema = z
  .strictObject({
    id: ModelIdSchema,
    provider: ModelProviderKindSchema,
    tier: ModelTierSchema,
    runtime_class: ModelRuntimeClassSchema,
    capabilities: z.array(ModelCapabilitySchema).min(1),
    context_window: z.number().int().positive(),
    visibility: ModelVisibilitySchema,
    priority: z.number().int().nonnegative(),
    supports_streaming: z.boolean(),
    supports_tools: z.boolean(),
    supports_vision: z.boolean(),
    eol_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    replacement_id: ModelIdSchema.optional(),
    metadata: ModelRegistryEntryMetadataSchema,
  })
  .superRefine((entry, ctx) => {
    addDuplicateCapabilityIssues(entry.capabilities, ctx);
    validateProviderRuntimeCombination(entry, ctx);
    validateCapabilityCombination(entry, ctx);
  });

export const ModelRegistrySchema = z
  .strictObject({
    schema_version: z.literal(1),
    models: z.array(ModelRegistryEntrySchema),
  })
  .superRefine((registry, ctx) => {
    const seen = new Set<string>();
    registry.models.forEach((entry, index) => {
      if (seen.has(entry.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["models", index, "id"],
          message: "Model id must be unique within the registry.",
        });
      }
      seen.add(entry.id);
    });
  });

export function parseModelRegistry(input: unknown) {
  return ModelRegistrySchema.parse(input);
}

export function validateModelRegistry(input: unknown) {
  return ModelRegistrySchema.safeParse(input);
}

type ModelRegistryEntryInput = z.infer<typeof ModelRegistryEntrySchema>;

function addDuplicateCapabilityIssues(
  capabilities: ModelRegistryEntryInput["capabilities"],
  ctx: z.RefinementCtx,
) {
  const seen = new Set<string>();
  capabilities.forEach((capability, index) => {
    if (seen.has(capability)) {
      ctx.addIssue({
        code: "custom",
        path: ["capabilities", index],
        message: "Model capabilities must be unique.",
      });
    }
    seen.add(capability);
  });
}

function validateProviderRuntimeCombination(
  entry: ModelRegistryEntryInput,
  ctx: z.RefinementCtx,
) {
  const supportedRuntimeByProvider = {
    ollama: "local",
    deepseek: "cloud",
    anthropic: "cloud",
    openai: "cloud",
    mock: "mock",
  } as const;
  const supportedRuntime = supportedRuntimeByProvider[entry.provider];

  if (entry.runtime_class !== supportedRuntime) {
    ctx.addIssue({
      code: "custom",
      path: ["runtime_class"],
      message: `${entry.provider} models must declare runtime_class ${supportedRuntime}.`,
    });
  }

  if (
    entry.runtime_class === "cloud" &&
    entry.visibility === "enabled" &&
    entry.provider !== "deepseek"
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["visibility"],
      message:
        "Only DeepSeek cloud entries may be intentionally enabled for the governed smoke path.",
    });
  }
}

function validateCapabilityCombination(
  entry: ModelRegistryEntryInput,
  ctx: z.RefinementCtx,
) {
  const capabilities = new Set(entry.capabilities);

  if (capabilities.has("embed") && capabilities.size > 1) {
    ctx.addIssue({
      code: "custom",
      path: ["capabilities"],
      message:
        "Embedding models must not declare chat or reasoning capabilities.",
    });
  }

  if (capabilities.has("tool_reasoning") && !capabilities.has("chat")) {
    ctx.addIssue({
      code: "custom",
      path: ["capabilities"],
      message: "tool_reasoning requires chat capability.",
    });
  }

  if (entry.supports_tools !== capabilities.has("tool_reasoning")) {
    ctx.addIssue({
      code: "custom",
      path: ["supports_tools"],
      message: "supports_tools must match the tool_reasoning capability.",
    });
  }

  if (entry.supports_vision !== capabilities.has("vision")) {
    ctx.addIssue({
      code: "custom",
      path: ["supports_vision"],
      message: "supports_vision must match the vision capability.",
    });
  }

  if (
    entry.supports_streaming &&
    !capabilities.has("chat") &&
    !capabilities.has("summarize")
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["supports_streaming"],
      message: "Streaming support requires chat or summarize capability.",
    });
  }
}
