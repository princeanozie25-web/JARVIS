import { disabledTranscriptionResult } from "./disabled-provider";
import {
  LocalWhisperRuntime,
  localWhisperRuntimeCapabilities,
  type LocalWhisperRuntimeConfig,
} from "./local-whisper-runtime";
import type {
  LocalTranscriptionTelemetryEvent,
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionProviderStatus,
  TranscriptionResult,
} from "./types";

export interface LocalWhisperTranscriptionProviderOptions {
  config: LocalWhisperRuntimeConfig;
  runtime: LocalWhisperRuntime;
  status?: TranscriptionProviderStatus;
  emitTelemetry?: (
    event: LocalTranscriptionTelemetryEvent,
  ) => void | Promise<void>;
  now?: () => number;
}

export function createLocalWhisperTranscriptionProvider(
  opts: LocalWhisperTranscriptionProviderOptions,
): TranscriptionProvider {
  const now = opts.now ?? (() => Date.now());
  const providerId = "local-whisper-placeholder";
  const enabled = opts.config.enabled === true;

  return {
    id: providerId,
    enabled,
    status: opts.status ?? (enabled ? "ready" : "disabled"),
    config: opts.config,
    capabilities: localWhisperRuntimeCapabilities,
    async transcribe(
      input: TranscriptionInput,
      runOptions: { signal?: AbortSignal } = {},
    ): Promise<TranscriptionResult> {
      if (!enabled) {
        return disabledTranscriptionResult("provider_disabled", providerId);
      }

      const startedAt = now();
      await opts.emitTelemetry?.({
        eventType: "local_transcription_started",
        providerId,
        success: true,
      });

      try {
        const status = await opts.runtime.initialize();
        if (status.status !== "ready") {
          const reason =
            status.status === "not_installed"
              ? "not_installed"
              : "transcription_failed";
          await opts.emitTelemetry?.({
            eventType: "local_transcription_failed",
            providerId,
            success: false,
            durationMs: Math.max(0, now() - startedAt),
            error: reason,
          });
          return {
            status: "error",
            providerId,
            text: "",
            reason,
            errorMessage: status.message ?? "Local Whisper runtime not ready.",
          };
        }

        const result = await opts.runtime.transcribe(input, {
          signal: runOptions.signal,
        });
        const text = result.text.trim();
        if (!text) {
          throw new Error("Local Whisper returned an empty transcript.");
        }

        await opts.emitTelemetry?.({
          eventType: "local_transcription_completed",
          providerId,
          success: true,
          durationMs: Math.max(0, now() - startedAt),
        });
        return {
          status: "completed",
          providerId,
          text,
          confidence: result.confidence,
          language: result.language,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await opts.emitTelemetry?.({
          eventType: "local_transcription_failed",
          providerId,
          success: false,
          durationMs: Math.max(0, now() - startedAt),
          error: telemetryError(message),
        });
        return {
          status: "error",
          providerId,
          text: "",
          reason: "transcription_failed",
          errorMessage: message,
        };
      } finally {
        await opts.runtime.shutdown();
      }
    },
  };
}

function telemetryError(message: string): string {
  if (message.includes("timed out")) return "timeout";
  if (message.includes("cancel")) return "cancelled";
  return "transcription_failed";
}
