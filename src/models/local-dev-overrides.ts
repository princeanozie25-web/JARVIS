import { createModelRegistry } from "./registry";
import type { ModelRegistry, ModelRegistryEntry } from "./types";
import type { ModelRegistryLoader } from "./registry";

export const DEEPSEEK_LIVE_OVERRIDE_ENV = "JARVIS_ENABLE_DEEPSEEK_LIVE";
export const DEEPSEEK_LIVE_MODEL_IDS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
] as const;

export type DeepSeekLiveModelId = (typeof DEEPSEEK_LIVE_MODEL_IDS)[number];

export interface DeepSeekLiveOverrideResult {
  readonly registry: ModelRegistryLoader;
  readonly override_applied: boolean;
  readonly enabled_model_ids: readonly DeepSeekLiveModelId[];
}

export function isDeepSeekLiveOverrideEnabled(
  env: Record<string, string | undefined>,
): boolean {
  return env[DEEPSEEK_LIVE_OVERRIDE_ENV]?.trim().toLowerCase() === "true";
}

export function applyDeepSeekLiveRegistryOverride(
  registry: ModelRegistryLoader,
  env: Record<string, string | undefined>,
): DeepSeekLiveOverrideResult {
  if (!isDeepSeekLiveOverrideEnabled(env)) {
    return {
      registry,
      override_applied: false,
      enabled_model_ids: [],
    };
  }

  const source = registry.getRegistry();
  const enabledModelIds: DeepSeekLiveModelId[] = [];
  const models = source.models.map((entry) => {
    if (!isDeepSeekLiveModelId(entry.id)) return entry;
    assertDeepSeekCloudEntry(entry);
    enabledModelIds.push(entry.id);
    return {
      ...entry,
      visibility: "enabled" as const,
      metadata: {
        ...entry.metadata,
        governance_notes: [
          entry.metadata.governance_notes,
          "Local-dev live override view only; committed registry default remains disabled.",
        ].join(" "),
      },
    };
  });

  return {
    registry: createModelRegistry({
      ...source,
      models,
    } satisfies ModelRegistry),
    override_applied: true,
    enabled_model_ids: enabledModelIds,
  };
}

function isDeepSeekLiveModelId(id: string): id is DeepSeekLiveModelId {
  return DEEPSEEK_LIVE_MODEL_IDS.includes(id as DeepSeekLiveModelId);
}

function assertDeepSeekCloudEntry(entry: ModelRegistryEntry): void {
  if (entry.provider !== "deepseek" || entry.runtime_class !== "cloud") {
    throw new Error(
      `${entry.id} cannot be enabled by ${DEEPSEEK_LIVE_OVERRIDE_ENV}; expected a DeepSeek cloud registry entry.`,
    );
  }
}
