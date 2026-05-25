import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createModelRuntime,
  createModelRuntimeProviderKey,
  createOllamaHttpClient,
  createOllamaModelProvider,
  loadDefaultModelRegistry,
  type ModelProvider,
  type ModelProviderOutput,
  type ModelRegistryLoader,
  type ModelRuntime,
  type ModelRuntimeExecuteResult,
  type ModelRuntimeOptions,
  type OllamaClient,
} from "../src/models";

const SMOKE_MODEL_ID = "llama3.2:3b";
const SMOKE_INPUT = "Say exactly: JARVIS governed local runtime online.";
const SMOKE_TIMEOUT_MS = 30_000;

export class ModelRuntimeSmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRuntimeSmokeError";
  }
}

export interface ModelRuntimeSmokeDependencies {
  readonly loadRegistry?: () => ModelRegistryLoader;
  readonly createClient?: () => OllamaClient;
  readonly createProvider?: (client: OllamaClient) => ModelProvider;
  readonly createRuntime?: (options: ModelRuntimeOptions) => ModelRuntime;
  readonly now?: () => number;
  readonly writeLine?: (line: string) => void;
}

export interface ModelRuntimeSmokeReport {
  readonly result: ModelRuntimeExecuteResult;
  readonly response_preview: string;
}

export async function runModelRuntimeSmoke(
  dependencies: ModelRuntimeSmokeDependencies = {},
): Promise<ModelRuntimeSmokeReport> {
  const loadRegistry = dependencies.loadRegistry ?? loadDefaultModelRegistry;
  const createClient = dependencies.createClient ?? createOllamaHttpClient;
  const createProvider =
    dependencies.createProvider ??
    ((client: OllamaClient) => createOllamaModelProvider({ client }));
  const makeRuntime = dependencies.createRuntime ?? createModelRuntime;
  const now = dependencies.now ?? Date.now;
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));

  const registry = loadRegistry();
  const smokeEntry = registry.getModel(SMOKE_MODEL_ID);
  if (!smokeEntry) {
    throw new ModelRuntimeSmokeError(
      `Model runtime smoke requires ${SMOKE_MODEL_ID} in config/models/registry.yaml.`,
    );
  }

  const client = createClient();
  const provider = createProvider(client);
  const runtime = makeRuntime({
    registry,
    providers: {
      [createModelRuntimeProviderKey(smokeEntry)]: provider,
    },
    now,
  });

  const result = await runtime.execute({
    request_id: "model-runtime-smoke",
    capability: "chat",
    input: {
      kind: "text",
      content: SMOKE_INPUT,
    },
    resolver_options: {
      runtime_class: "local",
      max_priority: smokeEntry.priority,
      excluded_model_ids: registry
        .listModels()
        .filter((entry) => entry.id !== smokeEntry.id)
        .map((entry) => entry.id),
    },
    options: {
      temperature: 0,
      max_output_tokens: 64,
    },
    timeout_ms: SMOKE_TIMEOUT_MS,
  });

  if (!result.ok || !result.response) {
    throw new ModelRuntimeSmokeError(renderFailureMessage(result));
  }

  const responsePreview = previewOutput(result.response.output);
  writeLine("JARVIS model runtime smoke");
  writeLine("status: ok");
  writeLine(
    `selected_model_id: ${result.metadata.selected_model_id ?? "none"}`,
  );
  writeLine(`successful_model: ${result.metadata.successful_model ?? "none"}`);
  writeLine(`attempted_models: ${result.metadata.attempted_models.join(",")}`);
  writeLine(`fallback_used: ${String(result.metadata.fallback_used)}`);
  writeLine(`latency_ms: ${String(result.metadata.latency_ms)}`);
  writeLine(`degraded: ${String(result.metadata.degraded)}`);
  writeLine(
    `token_usage: input=${result.response.token_usage.input_tokens} output=${result.response.token_usage.output_tokens} total=${result.response.token_usage.total_tokens}`,
  );
  writeLine(`response_preview: ${responsePreview}`);

  return {
    result,
    response_preview: responsePreview,
  };
}

export async function runModelRuntimeSmokeCli(): Promise<void> {
  try {
    await runModelRuntimeSmoke();
    process.exitCode = 0;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Model runtime smoke failed closed with an unknown error.";
    console.error(`JARVIS model runtime smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

function renderFailureMessage(result: ModelRuntimeExecuteResult): string {
  const failureClass = result.metadata.failure_class ?? "unknown";
  const attempted = result.metadata.attempted_models.join(",") || "none";
  const failed = result.metadata.failed_models
    .map((failure) => `${failure.model_id}:${failure.failure_class}`)
    .join(", ");

  return [
    `Local Ollama model runtime smoke failed with ${failureClass}.`,
    "Ensure Ollama is running on http://127.0.0.1:11434 and llama3.2:3b is already installed.",
    "No model pull, install, telemetry persistence, or event store persistence was attempted.",
    `Attempted models: ${attempted}.`,
    failed ? `Failures: ${failed}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function previewOutput(output: ModelProviderOutput): string {
  if (output.kind === "text") {
    return output.content.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return `[${output.kind}]`;
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("model-runtime-smoke.ts");
}

if (isDirectCliInvocation()) {
  void runModelRuntimeSmokeCli();
}
