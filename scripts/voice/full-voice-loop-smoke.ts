import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { getDb } from "../../src/lib/db/client-node";
import { insertTelemetryEvent } from "../../src/lib/db/telemetry";
import type { TelemetryEvent } from "../../src/lib/telemetry/types";
import { createVoiceEngineFailoverTelemetrySink } from "../../src/lib/voice/tts-engine";

import {
  createFasterWhisperSttProvider,
  createLocalPlaybackAdapter,
  createLocalPlaybackDriver,
  createPiperTtsProvider,
  createPlaybackQueue,
  createPlaybackSupervisor,
  createRealVoiceRuntimeAdapter,
  createVoiceTurnOrchestrator,
  loadFasterWhisperSttLocalConfig,
  loadPiperTtsLocalConfig,
  type FasterWhisperProviderConfig,
  type LocalPlaybackAdapter,
  type PlaybackDriver,
  type PlaybackSupervisor,
  type PiperProviderConfig,
  type SttProvider,
  type TtsProvider,
  type VoiceRuntimeAdapter,
} from "../../src/lib/voice-runtime";
import {
  createModelRuntime,
  createModelRuntimeProviderKey,
  createOllamaHttpClient,
  createOllamaModelProvider,
  loadDefaultModelRegistry,
  type ModelProvider,
  type ModelRegistryLoader,
  type ModelRuntime,
  type ModelRuntimeOptions,
  type OllamaClient,
} from "../../src/models";

export const FULL_LOOP_AUDIO_REF_ENV = "JARVIS_FULL_LOOP_AUDIO_REF";
export const FULL_LOOP_DURATION_MS_ENV = "JARVIS_FULL_LOOP_DURATION_MS";
export const FULL_LOOP_PREVIEW_LIMIT = 80;
const FULL_LOOP_MODEL_ID = "llama3.2:3b";
const FULL_LOOP_TIMEOUT_MS = 30_000;

export class FullVoiceLoopSmokeError extends Error {
  readonly metadata_only = true;

  constructor(message: string) {
    super(message);
    this.name = "FullVoiceLoopSmokeError";
  }
}

export interface FullVoiceLoopSmokeDependencies {
  readonly env?: Record<string, string | undefined>;
  readonly statAudio?: (audioRef: string) => Promise<{ readonly size: number }>;
  readonly loadSttConfig?: (
    env: Record<string, string | undefined>,
  ) => ReturnType<typeof loadFasterWhisperSttLocalConfig>;
  readonly loadTtsConfig?: (
    env: Record<string, string | undefined>,
  ) => ReturnType<typeof loadPiperTtsLocalConfig>;
  readonly createSttProvider?: (
    config: FasterWhisperProviderConfig,
  ) => SttProvider;
  readonly createTtsProvider?: (config: PiperProviderConfig) => TtsProvider;
  readonly loadRegistry?: () => ModelRegistryLoader;
  readonly createClient?: () => OllamaClient;
  readonly createModelProvider?: (client: OllamaClient) => ModelProvider;
  readonly createRuntime?: (options: ModelRuntimeOptions) => ModelRuntime;
  readonly createRuntimeAdapter?: (
    runtime: ModelRuntime,
  ) => VoiceRuntimeAdapter;
  readonly createDriver?: () => PlaybackDriver;
  readonly createAdapter?: (driver: PlaybackDriver) => LocalPlaybackAdapter;
  readonly createSupervisor?: (
    adapter: LocalPlaybackAdapter,
  ) => PlaybackSupervisor;
  readonly writeLine?: (line: string) => void;
  readonly now?: () => number;
  /** E-012: fallback providers for the LIVE chain after the primary (priority
   * order); the audit sink's recordEvent (defaults to the app DB's
   * telemetry_events via insertTelemetryEvent — the non-server-only client). */
  readonly fallbackTtsProviders?: readonly TtsProvider[];
  readonly recordEvent?: (event: TelemetryEvent) => void;
}

export interface FullVoiceLoopSmokeReport {
  readonly status: "ok";
  readonly session_id: string;
  readonly turn_id: string;
  readonly stt_status: string;
  readonly runtime_status: string;
  readonly tts_status: string;
  readonly playback_status: string;
  readonly provider_ids: {
    readonly stt: string;
    readonly runtime: string | null;
    readonly tts: string;
    readonly playback: string;
  };
  readonly latency_ms: {
    readonly stt: number | null;
    readonly runtime: number | null;
    readonly tts: number | null;
  };
  readonly degraded: boolean;
  readonly interruption_status: string | null;
  readonly transcript_preview: string;
  readonly assistant_preview: string;
  readonly metadata_only: true;
}

export async function runFullVoiceLoopSmoke(
  dependencies: FullVoiceLoopSmokeDependencies = {},
): Promise<FullVoiceLoopSmokeReport> {
  const env = dependencies.env ?? process.env;
  const writeLine = dependencies.writeLine ?? ((line) => console.log(line));
  const audioRef = requiredEnv(env[FULL_LOOP_AUDIO_REF_ENV]);
  if (!audioRef) {
    throw new FullVoiceLoopSmokeError(
      "Set JARVIS_FULL_LOOP_AUDIO_REF to an explicit local WAV file path. No capture, STT, runtime, TTS, or playback was attempted.",
    );
  }

  const statAudio = dependencies.statAudio ?? stat;
  const audioStats = await statAudio(audioRef);
  if (!Number.isFinite(audioStats.size) || audioStats.size <= 0) {
    throw new FullVoiceLoopSmokeError(
      "Full voice loop audio metadata failed closed.",
    );
  }
  const durationMs =
    parsePositiveInteger(env[FULL_LOOP_DURATION_MS_ENV]) ?? 1000;

  const loadSttConfig =
    dependencies.loadSttConfig ?? loadFasterWhisperSttLocalConfig;
  const loadTtsConfig = dependencies.loadTtsConfig ?? loadPiperTtsLocalConfig;
  const sttConfig = loadSttConfig(env);
  if (!sttConfig.ok) {
    throw new FullVoiceLoopSmokeError(
      `Full voice loop STT config is invalid: ${sttConfig.reasons.join(",")}.`,
    );
  }
  const ttsConfig = loadTtsConfig(env);
  if (!ttsConfig.ok) {
    throw new FullVoiceLoopSmokeError(
      `Full voice loop TTS config is invalid: ${ttsConfig.reasons.join(",")}.`,
    );
  }

  const createStt =
    dependencies.createSttProvider ??
    ((config: FasterWhisperProviderConfig) =>
      createFasterWhisperSttProvider({ config }));
  const createTts =
    dependencies.createTtsProvider ??
    ((config: PiperProviderConfig) => createPiperTtsProvider({ config }));
  const sttProvider = wrapSttProvider(createStt(sttConfig.config));
  const ttsProvider = wrapTtsProvider(createTts(ttsConfig.config));
  const runtimeAdapter = wrapRuntimeAdapter(
    dependencies.createRuntimeAdapter
      ? dependencies.createRuntimeAdapter(createGovernedRuntime(dependencies))
      : createRealVoiceRuntimeAdapter({
          runtime: createGovernedRuntime(dependencies),
        }),
  );

  const playbackQueue = createPlaybackQueue({
    max_queue_depth: 4,
    allow_sensitive_content: false,
    metadata_only: true,
  });
  const orchestrator = createVoiceTurnOrchestrator({
    stt_provider: sttProvider.provider,
    runtime_adapter: runtimeAdapter.adapter,
    tts_provider: ttsProvider.provider,
    playback_queue: playbackQueue,
    now_ms: dependencies.now ?? Date.now,
    interruption_id_factory: () => "full-voice-loop-smoke-interruption",
    // E-012: the live chain + persisted failover audit (metadata only).
    fallback_tts_providers: dependencies.fallbackTtsProviders ?? [],
    failover_telemetry: createVoiceEngineFailoverTelemetrySink({
      sessionId: "full-voice-loop-smoke-session",
      recordEvent:
        dependencies.recordEvent ??
        ((event) => insertTelemetryEvent(getDb(), event)),
    }),
  });

  const sessionId = "full-voice-loop-smoke-session";
  const turnId = "full-voice-loop-smoke-turn";
  const turnResult = await orchestrator.runVoiceTurn(
    {
      session_id: sessionId,
      turn_id: turnId,
      audio_ref: audioRef,
      duration_ms: durationMs,
      size_bytes: audioStats.size,
      sample_rate_hz: 16000,
      channel_count: 1,
      degraded: false,
      started_at: timestamp(dependencies.now?.() ?? Date.now()),
      stopped_at: timestamp((dependencies.now?.() ?? Date.now()) + durationMs),
      metadata_only: true,
    },
    {
      timeout_ms: FULL_LOOP_TIMEOUT_MS,
      assistant_content_class: "assistant_prose",
      metadata_only: true,
    },
  );

  if (!turnResult.ok || !turnResult.value) {
    throw new FullVoiceLoopSmokeError(
      `Full voice loop turn failed closed: ${turnResult.reasons.join(",")}.`,
    );
  }

  const playbackSnapshot = await playQueuedSmokeAudio(
    dependencies,
    playbackQueue,
  );
  const report: FullVoiceLoopSmokeReport = {
    status: "ok",
    session_id: sessionId,
    turn_id: turnId,
    stt_status: turnResult.snapshot.stt_status,
    runtime_status: turnResult.snapshot.runtime_status,
    tts_status: turnResult.snapshot.tts_status,
    playback_status: playbackSnapshot.playback_state,
    provider_ids: {
      stt: sttProvider.provider.id,
      runtime: turnResult.value.runtime_provider_id,
      tts: ttsProvider.provider.id,
      playback: playbackSnapshot.provider_id ?? "local-playback",
    },
    latency_ms: {
      stt: sttProvider.latency_ms,
      runtime: turnResult.value.runtime_latency_ms,
      tts: ttsProvider.latency_ms,
    },
    degraded:
      turnResult.value.degraded || sttProvider.degraded || ttsProvider.degraded,
    interruption_status: turnResult.snapshot.interruption_status ?? null,
    transcript_preview: sttProvider.transcript_preview,
    assistant_preview: runtimeAdapter.assistant_preview,
    metadata_only: true,
  };

  writeLine("JARVIS full voice loop smoke");
  writeLine(`status: ${report.status}`);
  writeLine(`session_id: ${report.session_id}`);
  writeLine(`turn_id: ${report.turn_id}`);
  writeLine(`stt_status: ${report.stt_status}`);
  writeLine(`runtime_status: ${report.runtime_status}`);
  writeLine(`tts_status: ${report.tts_status}`);
  writeLine(`playback_status: ${report.playback_status}`);
  writeLine(`provider_ids: ${renderProviderIds(report.provider_ids)}`);
  writeLine(
    `latency_ms: stt=${renderNullableNumber(report.latency_ms.stt)} runtime=${renderNullableNumber(report.latency_ms.runtime)} tts=${renderNullableNumber(report.latency_ms.tts)}`,
  );
  writeLine(`degraded: ${String(report.degraded)}`);
  if (report.interruption_status) {
    writeLine(`interruption_status: ${report.interruption_status}`);
  }
  writeLine(`transcript_preview: ${report.transcript_preview}`);
  writeLine(`assistant_preview: ${report.assistant_preview}`);

  return report;
}

export async function runFullVoiceLoopSmokeCli(): Promise<void> {
  try {
    await runFullVoiceLoopSmoke();
    process.exitCode = 0;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Full voice loop smoke failed closed with an unknown error.";
    console.error(`JARVIS full voice loop smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

function createGovernedRuntime(
  dependencies: FullVoiceLoopSmokeDependencies,
): ModelRuntime {
  const loadRegistry = dependencies.loadRegistry ?? loadDefaultModelRegistry;
  const createClient = dependencies.createClient ?? createOllamaHttpClient;
  const createProvider =
    dependencies.createModelProvider ??
    ((client: OllamaClient) => createOllamaModelProvider({ client }));
  const createRuntime = dependencies.createRuntime ?? createModelRuntime;
  const registry = loadRegistry();
  const smokeEntry = registry.getModel(FULL_LOOP_MODEL_ID);
  if (!smokeEntry) {
    throw new FullVoiceLoopSmokeError(
      `Full voice loop smoke requires ${FULL_LOOP_MODEL_ID} in config/models/registry.yaml.`,
    );
  }
  const client = createClient();
  const provider = createProvider(client);
  return createRuntime({
    registry,
    providers: {
      [createModelRuntimeProviderKey(smokeEntry)]: provider,
    },
    now: dependencies.now ?? Date.now,
  });
}

async function playQueuedSmokeAudio(
  dependencies: FullVoiceLoopSmokeDependencies,
  playbackQueue: ReturnType<typeof createPlaybackQueue>,
) {
  const createDriver =
    dependencies.createDriver ?? (() => createLocalPlaybackDriver());
  const createAdapter =
    dependencies.createAdapter ??
    ((driver: PlaybackDriver) => createLocalPlaybackAdapter({ driver }));
  const createSupervisor =
    dependencies.createSupervisor ??
    ((adapter: LocalPlaybackAdapter) =>
      createPlaybackSupervisor({ adapter, queue: playbackQueue }));

  const supervisor = createSupervisor(createAdapter(createDriver()));
  const load = await supervisor.loadNext();
  if (!load.ok) {
    throw new FullVoiceLoopSmokeError(
      `Full voice loop playback load failed closed: ${load.reasons.join(",")}.`,
    );
  }
  const playback = await supervisor.beginPlayback();
  if (!playback.ok) {
    throw new FullVoiceLoopSmokeError(
      `Full voice loop playback failed closed: ${playback.reasons.join(",")}.`,
    );
  }
  const completed = await supervisor.complete();
  if (!completed.ok) {
    throw new FullVoiceLoopSmokeError(
      `Full voice loop playback completion failed closed: ${completed.reasons.join(",")}.`,
    );
  }
  return completed.snapshot;
}

function wrapSttProvider(provider: SttProvider): {
  readonly provider: SttProvider;
  transcript_preview: string;
  latency_ms: number | null;
  degraded: boolean;
} {
  const state = {
    provider,
    transcript_preview: "",
    latency_ms: null as number | null,
    degraded: false,
  };
  state.provider = {
    ...provider,
    transcribe: async (request, options) => {
      const result = await provider.transcribe(request, options);
      state.transcript_preview = boundedPreview(result.transcript);
      state.latency_ms = result.latency_ms;
      state.degraded = result.degraded;
      return result;
    },
  };
  return state;
}

function wrapTtsProvider(provider: TtsProvider): {
  readonly provider: TtsProvider;
  latency_ms: number | null;
  degraded: boolean;
} {
  const state = {
    provider,
    latency_ms: null as number | null,
    degraded: false,
  };
  state.provider = {
    ...provider,
    synthesize: async (request, options) => {
      const result = await provider.synthesize(request, options);
      state.latency_ms = result.latency_ms;
      state.degraded = result.degraded;
      return result;
    },
  };
  return state;
}

function wrapRuntimeAdapter(adapter: VoiceRuntimeAdapter): {
  readonly adapter: VoiceRuntimeAdapter;
  assistant_preview: string;
} {
  const state = {
    adapter,
    assistant_preview: "",
  };
  state.adapter = {
    ...adapter,
    executeVoiceRequest: async (request, options) => {
      const result = await adapter.executeVoiceRequest(request, options);
      state.assistant_preview = boundedPreview(result.assistant_text);
      return result;
    },
  };
  return state;
}

function requiredEnv(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (value === undefined || value.trim().length === 0) return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function boundedPreview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, FULL_LOOP_PREVIEW_LIMIT);
}

function renderProviderIds(
  providerIds: FullVoiceLoopSmokeReport["provider_ids"],
): string {
  return `stt=${providerIds.stt} runtime=${providerIds.runtime ?? "none"} tts=${providerIds.tts} playback=${providerIds.playback}`;
}

function renderNullableNumber(value: number | null): string {
  return value === null ? "unknown" : String(value);
}

function timestamp(ms: number): string {
  return new Date(ms).toISOString();
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("full-voice-loop-smoke.ts");
}

if (isDirectCliInvocation()) {
  void runFullVoiceLoopSmokeCli();
}
