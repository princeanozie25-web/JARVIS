import type {
  ModelProviderFailureClass,
  ModelProviderFinishReason,
  ModelProviderOutput,
  ModelRuntime,
  ModelRuntimeExecuteRequest,
  ModelRuntimeExecuteResult,
} from "../../models";
import {
  isVoiceRuntimeAdapterRequest,
  type VoiceRuntimeAdapter,
  type VoiceRuntimeAdapterFailureClass,
  type VoiceRuntimeAdapterHealth,
  type VoiceRuntimeAdapterOptions,
  type VoiceRuntimeAdapterRequest,
  type VoiceRuntimeAdapterResponse,
  type VoiceRuntimeFinishReason,
} from "./runtime-adapter";

export interface RealVoiceRuntimeAdapterOptions {
  readonly runtime: Pick<ModelRuntime, "execute">;
  readonly provider_id?: string;
  readonly default_timeout_ms?: number;
}

export class RealVoiceRuntimeAdapterError extends Error {
  readonly reason: VoiceRuntimeAdapterFailureClass;
  readonly metadata_only = true;

  constructor(reason: VoiceRuntimeAdapterFailureClass) {
    super(reason);
    this.name = "RealVoiceRuntimeAdapterError";
    this.reason = reason;
  }
}

export function createRealVoiceRuntimeAdapter(
  options: RealVoiceRuntimeAdapterOptions,
): VoiceRuntimeAdapter {
  const providerId = options.provider_id ?? "governed-model-runtime";
  const runtime = isRuntimeExecutor(options.runtime) ? options.runtime : null;
  const defaultTimeoutMs = options.default_timeout_ms ?? 30_000;
  let cancelled: VoiceRuntimeAdapterFailureClass | null = null;

  return {
    id: providerId,
    metadata_only: true,
    executeVoiceRequest: async (request, executeOptions) => {
      if (cancelled) throw new RealVoiceRuntimeAdapterError(cancelled);
      if (executeOptions?.abort_signal?.aborted) {
        throw new RealVoiceRuntimeAdapterError("cancelled");
      }
      if (!runtime) throw new RealVoiceRuntimeAdapterError("unavailable");
      if (!isVoiceRuntimeAdapterRequest(request)) {
        throw new RealVoiceRuntimeAdapterError("invalid_request");
      }

      try {
        const executeRuntime = runtime.execute.bind(runtime);
        const result = await executeRuntime(
          createRuntimeExecuteRequest(
            request,
            executeOptions,
            defaultTimeoutMs,
          ),
        );
        return mapRuntimeResult(result);
      } catch (error) {
        if (error instanceof RealVoiceRuntimeAdapterError) throw error;
        if (executeOptions?.abort_signal?.aborted) {
          throw new RealVoiceRuntimeAdapterError("cancelled");
        }
        throw new RealVoiceRuntimeAdapterError("provider_error");
      }
    },
    cancel: async (reason) => {
      cancelled = reason;
    },
    health: async (): Promise<VoiceRuntimeAdapterHealth> => ({
      ok: runtime !== null,
      degraded: false,
      provider_id: providerId,
      ...(runtime === null ? { error_class: "unavailable" as const } : {}),
      metadata_only: true,
    }),
  };
}

function createRuntimeExecuteRequest(
  request: VoiceRuntimeAdapterRequest,
  options: VoiceRuntimeAdapterOptions | undefined,
  defaultTimeoutMs: number,
): ModelRuntimeExecuteRequest {
  return {
    request_id: request.request_id,
    capability: "chat",
    input: {
      kind: "messages",
      messages: [
        {
          role: "user",
          content: request.transcript,
        },
      ],
    },
    resolver_options: {
      runtime_class: "local",
      allow_cloud: false,
      allow_disabled: false,
      required_tools: false,
      required_vision: false,
    },
    options: {
      tool_choice: "none",
    },
    timeout_ms: options?.timeout_ms ?? defaultTimeoutMs,
    abort_signal: options?.abort_signal,
  };
}

function mapRuntimeResult(
  result: ModelRuntimeExecuteResult,
): VoiceRuntimeAdapterResponse {
  if (!isRuntimeExecuteResult(result)) {
    throw new RealVoiceRuntimeAdapterError("provider_error");
  }
  if (!result.ok || !result.response) {
    throw new RealVoiceRuntimeAdapterError(
      mapRuntimeFailure(result.metadata.failure_class),
    );
  }
  if (result.response.finish_reason === "tool_calls") {
    throw new RealVoiceRuntimeAdapterError("policy_blocked");
  }

  const output = result.response.output;
  if (!isAssistantProseOutput(output)) {
    throw new RealVoiceRuntimeAdapterError("policy_blocked");
  }

  return {
    response_id: result.metadata.execution_summary.execution_id,
    assistant_text: output.content,
    latency_ms: result.metadata.latency_ms,
    degraded: result.metadata.degraded || result.response.degraded,
    provider_id:
      result.metadata.execution_summary.selected_provider ??
      result.response.provider_id,
    finish_reason: mapFinishReason(result.response.finish_reason),
    metadata_only: true,
  };
}

function isAssistantProseOutput(
  output: ModelProviderOutput,
): output is Extract<ModelProviderOutput, { readonly kind: "text" }> {
  if (output.kind !== "text") return false;
  const record = output as Record<string, unknown>;
  if (
    record.content_class !== undefined &&
    record.content_class !== "assistant_prose"
  ) {
    return false;
  }
  if (output.content.trim().length === 0) return false;
  return !/```|^\s*(tool_output|tool result|tool_call|tool:|approval_required|approval required|approval:)/i.test(
    output.content,
  );
}

function mapRuntimeFailure(
  failureClass: ModelProviderFailureClass | undefined,
): VoiceRuntimeAdapterFailureClass {
  if (failureClass === "invalid_request") return "invalid_request";
  if (failureClass === "unavailable" || failureClass === "model_missing") {
    return "unavailable";
  }
  if (failureClass === "cancelled" || failureClass === "timeout") {
    return "cancelled";
  }
  if (failureClass === "policy_blocked" || failureClass === "budget_blocked") {
    return "policy_blocked";
  }
  if (failureClass === "unknown") return "unknown";
  return "provider_error";
}

function mapFinishReason(
  finishReason: ModelProviderFinishReason,
): VoiceRuntimeFinishReason {
  if (
    finishReason === "stop" ||
    finishReason === "length" ||
    finishReason === "cancelled" ||
    finishReason === "timeout" ||
    finishReason === "error" ||
    finishReason === "budget_blocked" ||
    finishReason === "policy_blocked"
  ) {
    return finishReason;
  }
  throw new RealVoiceRuntimeAdapterError("policy_blocked");
}

function isRuntimeExecutor(
  runtime: unknown,
): runtime is Pick<ModelRuntime, "execute"> {
  return (
    typeof runtime === "object" &&
    runtime !== null &&
    "execute" in runtime &&
    typeof (runtime as { readonly execute?: unknown }).execute === "function"
  );
}

function isRuntimeExecuteResult(
  value: unknown,
): value is ModelRuntimeExecuteResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.request_id === "string" &&
    typeof result.ok === "boolean" &&
    typeof result.metadata === "object" &&
    result.metadata !== null
  );
}
