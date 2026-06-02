import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createDeepSeekHttpClient,
  createDeepSeekModelProvider,
  createModelRuntime,
  createModelRuntimeProviderKey,
  applyDeepSeekLiveRegistryOverride,
  DEEPSEEK_LIVE_OVERRIDE_ENV,
  loadDefaultModelRegistry,
  type DeepSeekClient,
  type ModelProvider,
  type ModelRegistryEntry,
  type ModelRegistryLoader,
  type ModelRuntime,
  type ModelRuntimeExecuteResult,
  type ModelRuntimeOptions,
} from "../src/models";

const DEEPSEEK_API_KEY_ENV = "DEEPSEEK_API_KEY";
const DEEPSEEK_BASE_URL_ENV = "DEEPSEEK_BASE_URL";
const DEEPSEEK_MODEL_IDS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
const DEEPSEEK_SMOKE_INPUT = "Reply with exactly OK.";
const DEEPSEEK_SMOKE_TIMEOUT_MS = 30_000;

export class DeepSeekSmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeepSeekSmokeError";
  }
}

export interface DeepSeekSmokeDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly loadRegistry?: () => ModelRegistryLoader;
  readonly createClient?: (config: DeepSeekSmokeConfig) => DeepSeekClient;
  readonly createProvider?: (client: DeepSeekClient) => ModelProvider;
  readonly createRuntime?: (options: ModelRuntimeOptions) => ModelRuntime;
  readonly now?: () => number;
  readonly writeLine?: (line: string) => void;
}

export type DeepSeekSmokeConfig =
  | {
      readonly status: "skipped";
      readonly reason: "missing DEEPSEEK_API_KEY";
    }
  | {
      readonly status: "configured";
      readonly api_key: string;
      readonly base_url?: string;
    };

export interface DeepSeekSmokeReport {
  readonly status: "skipped" | "ok";
  readonly results: readonly ModelRuntimeExecuteResult[];
}

export async function runDeepSeekSmoke(
  dependencies: DeepSeekSmokeDependencies = {},
): Promise<DeepSeekSmokeReport> {
  const env = dependencies.env ?? process.env;
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  const config = loadDeepSeekSmokeConfig(env);

  writeLine("JARVIS DeepSeek smoke");

  if (config.status === "skipped") {
    writeLine("status: skipped");
    writeLine(`reason: ${config.reason}`);
    writeLine(
      `enablement: set DEEPSEEK_API_KEY in .env.local and run with ${DEEPSEEK_LIVE_OVERRIDE_ENV}=true for local live tests`,
    );
    return {
      status: "skipped",
      results: [],
    };
  }

  const loadRegistry = dependencies.loadRegistry ?? loadDefaultModelRegistry;
  const createClient =
    dependencies.createClient ??
    ((clientConfig: DeepSeekSmokeConfig) => {
      if (clientConfig.status !== "configured") {
        throw new DeepSeekSmokeError("DeepSeek smoke is not configured.");
      }
      return createDeepSeekHttpClient({
        api_key: clientConfig.api_key,
        base_url: clientConfig.base_url,
      });
    });
  const createProvider =
    dependencies.createProvider ??
    ((client: DeepSeekClient) => createDeepSeekModelProvider({ client }));
  const makeRuntime = dependencies.createRuntime ?? createModelRuntime;
  const now = dependencies.now ?? Date.now;

  const override = applyDeepSeekLiveRegistryOverride(loadRegistry(), env);
  const registry = override.registry;
  const entries = resolveEnabledDeepSeekEntries(registry);
  const client = createClient(config);
  const provider = createProvider(client);
  const results: ModelRuntimeExecuteResult[] = [];

  for (const entry of entries) {
    const runtime = makeRuntime({
      registry,
      providers: {
        [createModelRuntimeProviderKey(entry)]: provider,
      },
      cloudExecutionPolicy: {
        enabled_provider_kinds: ["deepseek"],
        enabled_model_ids: [entry.id],
      },
      now,
    });

    const result = await runtime.execute({
      request_id: `deepseek-smoke:${entry.id}`,
      capability: "chat",
      input: {
        kind: "text",
        content: DEEPSEEK_SMOKE_INPUT,
      },
      resolver_options: {
        runtime_class: "cloud",
        allow_cloud: true,
        allow_disabled: false,
        excluded_model_ids: registry
          .listModels()
          .filter((candidate) => candidate.id !== entry.id)
          .map((candidate) => candidate.id),
      },
      options: {
        temperature: 0,
        max_output_tokens: 16,
      },
      timeout_ms: DEEPSEEK_SMOKE_TIMEOUT_MS,
    });

    if (!result.ok || !result.response) {
      throw new DeepSeekSmokeError(renderFailureMessage(entry.id, result));
    }

    results.push(result);
    writeResultMetadata(writeLine, entry.id, result);
  }

  writeLine("status: ok");
  return {
    status: "ok",
    results,
  };
}

export function loadDeepSeekSmokeConfig(
  env: Record<string, string | undefined>,
): DeepSeekSmokeConfig {
  const apiKey = env[DEEPSEEK_API_KEY_ENV]?.trim();
  if (!apiKey) {
    return {
      status: "skipped",
      reason: "missing DEEPSEEK_API_KEY",
    };
  }

  const rawBaseUrl = env[DEEPSEEK_BASE_URL_ENV]?.trim();
  if (!rawBaseUrl) {
    return {
      status: "configured",
      api_key: apiKey,
    };
  }

  const baseUrl = normalizeDeepSeekBaseUrl(rawBaseUrl);
  return {
    status: "configured",
    api_key: apiKey,
    base_url: baseUrl,
  };
}

export async function runDeepSeekSmokeCli(): Promise<void> {
  try {
    await runDeepSeekSmoke();
    process.exitCode = 0;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "DeepSeek smoke failed closed with an unknown error.";
    console.error(`JARVIS DeepSeek smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

function resolveEnabledDeepSeekEntries(
  registry: ModelRegistryLoader,
): ModelRegistryEntry[] {
  return DEEPSEEK_MODEL_IDS.map((modelId) => {
    const entry = registry.getModel(modelId);
    if (!entry) {
      throw new DeepSeekSmokeError(
        `DeepSeek smoke requires ${modelId} in config/models/registry.yaml.`,
      );
    }
    if (entry.provider !== "deepseek" || entry.runtime_class !== "cloud") {
      throw new DeepSeekSmokeError(
        `DeepSeek smoke requires ${modelId} to remain a DeepSeek cloud registry entry.`,
      );
    }
    if (entry.visibility !== "enabled") {
      throw new DeepSeekSmokeError(
        `${modelId} is disabled. Keep config/models/registry.yaml disabled and run local live tests with ${DEEPSEEK_LIVE_OVERRIDE_ENV}=true.`,
      );
    }
    return entry;
  });
}

function normalizeDeepSeekBaseUrl(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:") {
      throw new Error("https required");
    }
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new DeepSeekSmokeError(
      "DEEPSEEK_BASE_URL must be a valid https URL.",
    );
  }
}

function writeResultMetadata(
  writeLine: (line: string) => void,
  modelId: string,
  result: ModelRuntimeExecuteResult,
) {
  if (!result.response) return;
  writeLine(`model_id: ${modelId}`);
  writeLine(`provider_id: ${result.response.provider_id}`);
  writeLine(
    `selected_model_id: ${result.metadata.selected_model_id ?? "none"}`,
  );
  writeLine(`successful_model: ${result.metadata.successful_model ?? "none"}`);
  writeLine(`latency_ms: ${String(result.metadata.latency_ms)}`);
  writeLine(`finish_reason: ${result.response.finish_reason}`);
  writeLine(`degraded: ${String(result.metadata.degraded)}`);
  writeLine(
    `token_usage: input=${result.response.token_usage.input_tokens} output=${result.response.token_usage.output_tokens} total=${result.response.token_usage.total_tokens}`,
  );
}

function renderFailureMessage(
  modelId: string,
  result: ModelRuntimeExecuteResult,
): string {
  const failureClass = result.metadata.failure_class ?? "unknown";
  const attempted = result.metadata.attempted_models.join(",") || "none";
  const failed = result.metadata.failed_models
    .map((failure) => `${failure.model_id}:${failure.failure_class}`)
    .join(", ");

  return [
    `DeepSeek smoke failed for ${modelId} with ${failureClass}.`,
    "No API key, prompt, or raw response was printed.",
    `Attempted models: ${attempted}.`,
    failed ? `Failures: ${failed}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("deepseek-smoke.ts");
}

if (isDirectCliInvocation()) {
  void runDeepSeekSmokeCli();
}
