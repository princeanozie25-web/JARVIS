import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseModelRegistry } from "./schema";
import type {
  ModelProviderKind,
  ModelRegistry,
  ModelRegistryEntry,
} from "./types";

export const DEFAULT_MODEL_REGISTRY_PATH = resolve(
  process.cwd(),
  "config/models/registry.yaml",
);

export interface ModelRegistryLoader {
  readonly schemaVersion: 1;
  getRegistry(): ModelRegistry;
  listModels(): ModelRegistryEntry[];
  listEnabledModels(): ModelRegistryEntry[];
  listByProvider(provider: ModelProviderKind): ModelRegistryEntry[];
  getModel(id: string): ModelRegistryEntry | null;
  getAuthoritySnapshot(): ModelRegistryAuthoritySnapshot;
}

export interface ModelRegistryAuthoritySnapshot {
  readonly networkCallsEnabled: false;
  readonly providerExecutionEnabled: false;
  readonly runtimeStateMutationEnabled: false;
  readonly routerMutationEnabled: false;
  readonly telemetryPersistenceEnabled: false;
  readonly environmentVariableMutationEnabled: false;
  readonly modelInstallationEnabled: false;
  readonly providerProbingEnabled: false;
}

export function loadDefaultModelRegistry(): ModelRegistryLoader {
  return loadModelRegistryFromFile(DEFAULT_MODEL_REGISTRY_PATH);
}

export function loadModelRegistryFromFile(path: string): ModelRegistryLoader {
  return createModelRegistryFromYaml(readFileSync(path, "utf8"));
}

export function createModelRegistryFromYaml(
  yamlText: string,
): ModelRegistryLoader {
  return createModelRegistry(parseModelRegistryYaml(yamlText));
}

export function parseModelRegistryYaml(yamlText: string): ModelRegistry {
  return parseModelRegistry(parseYaml(yamlText));
}

export function createModelRegistry(input: ModelRegistry): ModelRegistryLoader {
  const parsed = parseModelRegistry(input);
  const canonicalRegistry = deepFreeze({
    ...parsed,
    models: [...parsed.models].sort(compareRegistryEntries),
  });

  return {
    schemaVersion: canonicalRegistry.schema_version,
    getRegistry: () => clone(canonicalRegistry),
    listModels: () => clone(canonicalRegistry.models),
    listEnabledModels: () =>
      clone(
        canonicalRegistry.models.filter(
          (entry) => entry.visibility === "enabled",
        ),
      ),
    listByProvider: (provider) =>
      clone(
        canonicalRegistry.models.filter((entry) => entry.provider === provider),
      ),
    getModel: (id) =>
      clone(canonicalRegistry.models.find((entry) => entry.id === id) ?? null),
    getAuthoritySnapshot: () => ({
      networkCallsEnabled: false,
      providerExecutionEnabled: false,
      runtimeStateMutationEnabled: false,
      routerMutationEnabled: false,
      telemetryPersistenceEnabled: false,
      environmentVariableMutationEnabled: false,
      modelInstallationEnabled: false,
      providerProbingEnabled: false,
    }),
  };
}

function compareRegistryEntries(
  left: ModelRegistryEntry,
  right: ModelRegistryEntry,
) {
  return left.priority - right.priority || left.id.localeCompare(right.id);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}
