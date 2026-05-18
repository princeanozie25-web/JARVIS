import type { EmbeddingConfig } from "./embedding-config";

export interface EmbeddingRequest {
  text: string;
  signal?: AbortSignal;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimension: number;
  provider: string;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimension: number;
  embed(input: EmbeddingRequest): Promise<EmbeddingResult>;
}

function assertEmbeddingDimension(
  embedding: number[],
  expectedDimension: number,
): void {
  if (embedding.length !== expectedDimension) {
    throw new Error(
      `Embedding dimension mismatch: expected ${expectedDimension}, received ${embedding.length}.`,
    );
  }
}

function combineAbortSignals(input: {
  timeoutMs: number;
  parent?: AbortSignal;
}): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("Embedding request timed out."));
  }, input.timeoutMs);
  const abortFromParent = () => controller.abort(input.parent?.reason);
  input.parent?.addEventListener("abort", abortFromParent, { once: true });

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      input.parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = "ollama";

  constructor(
    readonly model: string,
    readonly dimension: number,
    private readonly opts: {
      baseUrl?: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async embed(input: EmbeddingRequest): Promise<EmbeddingResult> {
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const baseUrl = this.opts.baseUrl ?? "http://127.0.0.1:11434";
    const timeoutMs = this.opts.timeoutMs ?? 10_000;
    const abort = combineAbortSignals({
      timeoutMs,
      parent: input.signal,
    });

    try {
      const res = await fetchImpl(
        `${baseUrl.replace(/\/+$/, "")}/api/embeddings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: this.model, prompt: input.text }),
          signal: abort.signal,
        },
      );
      if (!res.ok) {
        throw new Error(`Ollama embedding request failed with ${res.status}.`);
      }
      const body = (await res.json()) as { embedding?: unknown };
      if (
        !Array.isArray(body.embedding) ||
        !body.embedding.every((value) => typeof value === "number")
      ) {
        throw new Error("Ollama embedding response did not include a vector.");
      }
      assertEmbeddingDimension(body.embedding, this.dimension);
      return {
        embedding: body.embedding,
        model: this.model,
        dimension: this.dimension,
        provider: this.id,
      };
    } finally {
      abort.cleanup();
    }
  }
}

type TransformerPipeline = (
  text: string,
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ data?: unknown } | number[]>;

async function loadTransformersPipeline(): Promise<
  (task: string, model: string) => Promise<TransformerPipeline>
> {
  const specifier = "@xenova/transformers";
  const imported = (await import(specifier)) as {
    pipeline?: (task: string, model: string) => Promise<TransformerPipeline>;
  };
  if (typeof imported.pipeline !== "function") {
    throw new Error("transformers.js pipeline export is unavailable.");
  }
  return imported.pipeline;
}

function tensorToArray(value: { data?: unknown } | number[]): number[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (ArrayBuffer.isView(value.data)) {
    return Array.from(value.data as Float32Array);
  }
  throw new Error("transformers.js embedding response did not include data.");
}

export class TransformersJsEmbeddingProvider implements EmbeddingProvider {
  readonly id = "transformers";
  private pipelinePromise?: Promise<TransformerPipeline>;

  constructor(
    readonly model: string,
    readonly dimension: number,
    private readonly loader = loadTransformersPipeline,
  ) {}

  async embed(input: EmbeddingRequest): Promise<EmbeddingResult> {
    this.pipelinePromise ??= this.loader().then((pipeline) =>
      pipeline("feature-extraction", this.model),
    );
    const extractor = await this.pipelinePromise;
    const raw = await extractor(input.text, {
      pooling: "mean",
      normalize: true,
    });
    const embedding = tensorToArray(raw);
    assertEmbeddingDimension(embedding, this.dimension);
    return {
      embedding,
      model: this.model,
      dimension: this.dimension,
      provider: this.id,
    };
  }
}

export class FallbackEmbeddingProvider implements EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  readonly dimension: number;

  constructor(
    private readonly primary: EmbeddingProvider,
    private readonly fallback: EmbeddingProvider,
  ) {
    this.id = `${primary.id}+${fallback.id}`;
    this.model = primary.model;
    this.dimension = primary.dimension;
  }

  async embed(input: EmbeddingRequest): Promise<EmbeddingResult> {
    try {
      return await this.primary.embed(input);
    } catch {
      return this.fallback.embed(input);
    }
  }
}

export function embeddingProviderFromConfig(
  config: EmbeddingConfig,
): EmbeddingProvider {
  if (config.provider === "transformers") {
    return new TransformersJsEmbeddingProvider(config.model, config.dimension);
  }

  return new FallbackEmbeddingProvider(
    new OllamaEmbeddingProvider(config.model, config.dimension, {
      baseUrl: config.ollamaBaseUrl,
      timeoutMs: config.timeoutMs,
    }),
    new TransformersJsEmbeddingProvider(
      config.fallbackModel,
      config.fallbackDimension,
    ),
  );
}

export { assertEmbeddingDimension };
