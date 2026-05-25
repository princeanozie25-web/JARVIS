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
  type ModelRuntimeStreamEvent,
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

export interface ModelRuntimeStreamingSmokeReport {
  readonly terminal_event: Extract<
    ModelRuntimeStreamEvent,
    { readonly type: "done" | "error" | "cancelled" }
  >;
  readonly stream_preview: string;
  readonly token_event_count: number;
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

export async function runModelRuntimeStreamingSmoke(
  dependencies: ModelRuntimeSmokeDependencies = {},
): Promise<ModelRuntimeStreamingSmokeReport> {
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
      `Model runtime streaming smoke requires ${SMOKE_MODEL_ID} in config/models/registry.yaml.`,
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

  const preview = createBoundedPreview(120);
  let tokenEventCount = 0;
  let terminalEvent: Extract<
    ModelRuntimeStreamEvent,
    { readonly type: "done" | "error" | "cancelled" }
  > | null = null;

  writeLine("JARVIS model runtime streaming smoke");
  writeLine("status: streaming");

  for await (const event of runtime.stream({
    request_id: "model-runtime-stream-smoke",
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
  })) {
    if (event.type === "start") {
      writeLine(`selected_model_id: ${event.selected_model_id ?? "none"}`);
      writeLine(`provider_id: ${event.provider_id ?? "none"}`);
      writeLine(`attempted_models: ${event.attempted_models.join(",")}`);
      writeLine(`fallback_used: ${String(event.fallback_used)}`);
      continue;
    }

    if (event.type === "token") {
      tokenEventCount += 1;
      preview.append(event.delta);
      continue;
    }

    terminalEvent = event;
  }

  if (!terminalEvent) {
    throw new ModelRuntimeSmokeError(
      "Local Ollama model runtime streaming smoke failed without a terminal event.",
    );
  }

  if (terminalEvent.type !== "done") {
    throw new ModelRuntimeSmokeError(
      renderStreamingFailureMessage(terminalEvent),
    );
  }

  const streamPreview = preview.value();
  writeLine("status: ok");
  writeLine(`token_events: ${String(tokenEventCount)}`);
  writeLine(
    `token_usage: input=${terminalEvent.token_usage.input_tokens} output=${terminalEvent.token_usage.output_tokens} total=${terminalEvent.token_usage.total_tokens}`,
  );
  writeLine(`latency_ms: ${String(terminalEvent.latency_ms)}`);
  writeLine(`degraded: ${String(terminalEvent.degraded)}`);
  writeLine(`stream_preview: ${streamPreview}`);

  return {
    terminal_event: terminalEvent,
    stream_preview: streamPreview,
    token_event_count: tokenEventCount,
  };
}

export async function runModelRuntimeSmokeCli(): Promise<void> {
  try {
    if (process.argv.includes("--stream")) {
      await runModelRuntimeStreamingSmoke();
    } else {
      await runModelRuntimeSmoke();
    }
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

function renderStreamingFailureMessage(
  event: Extract<
    ModelRuntimeStreamEvent,
    { readonly type: "error" | "cancelled" }
  >,
): string {
  const attempted = event.attempted_models.join(",") || "none";
  const reason =
    event.type === "cancelled"
      ? `${event.failure_class}:${event.reason}`
      : event.failure_class;

  return [
    `Local Ollama model runtime streaming smoke failed with ${reason}.`,
    "Ensure Ollama is running on http://127.0.0.1:11434 and llama3.2:3b is already installed.",
    "No model pull, install, telemetry persistence, or event store persistence was attempted.",
    `Attempted models: ${attempted}.`,
  ].join(" ");
}

function previewOutput(output: ModelProviderOutput): string {
  if (output.kind === "text") {
    return output.content.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return `[${output.kind}]`;
}

function createBoundedPreview(limit: number): {
  readonly append: (delta: string) => void;
  readonly value: () => string;
} {
  let preview = "";
  return {
    append: (delta: string) => {
      if (preview.length >= limit) return;
      preview = `${preview}${delta}`
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    },
    value: () => preview,
  };
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
