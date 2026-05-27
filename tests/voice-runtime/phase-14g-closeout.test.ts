import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createPlaybackQueue,
  createVoiceCancellationSupervisor,
  createVoiceInterruption,
  createVoiceTurnOrchestrator,
  type PlaybackQueue,
  type PlaybackQueueItem,
  type SttProvider,
  type SttProviderHealth,
  type SttTranscriptionResult,
  type TtsProvider,
  type TtsProviderHealth,
  type TtsSynthesisResult,
  type VoiceCancellationSupervisor,
  type VoiceRuntimeAdapter,
  type VoiceRuntimeAdapterHealth,
  type VoiceRuntimeAdapterResponse,
} from "../../src/lib/voice-runtime";

const SAFE_TRANSCRIPT = "Good evening. All systems are operational.";
const SAFE_OUTPUT_REF = "C:/tmp/jarvis-closeout-tts.wav";
const PHASE_14G_SAFE_FIXTURE = {
  interruption_observed: true,
  playback_queue_cleared: true,
  stale_enqueue_blocked: true,
  metadata_only: true,
} as const;

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

async function waitUntil(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let index = 0; index < 20; index += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await Promise.resolve();
    }
  }
  throw lastError;
}

function phase14GSource(): string {
  return [
    "src/lib/voice-runtime/interruption.ts",
    "src/lib/voice-runtime/cancellation-supervisor.ts",
    "src/lib/voice-runtime/turn-orchestrator.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

function captureMetadata(turnId = "voice-turn-1") {
  return {
    session_id: "voice-session-1",
    turn_id: turnId,
    audio_ref: "C:/tmp/jarvis-capture.wav",
    duration_ms: 1200,
    size_bytes: 32000,
    sample_rate_hz: 16000,
    channel_count: 1,
    degraded: false,
    started_at: "2026-05-27T07:00:00.000Z",
    stopped_at: "2026-05-27T07:00:01.200Z",
    metadata_only: true,
  };
}

function playbackItem(turnId = "voice-turn-existing"): PlaybackQueueItem {
  return {
    item_id: `item-${turnId}`,
    session_id: "voice-session-1",
    turn_id: turnId,
    chunk_id: `chunk-${turnId}`,
    provider_id: "fake-local-tts",
    voice_id: "fake-voice",
    audio_ref: "C:/tmp/existing.wav",
    duration_ms: 100,
    size_bytes: 200,
    content_class: "assistant_prose",
    created_at: "2026-05-27T07:00:00.000Z",
    metadata_only: true,
  };
}

function sttResult(): SttTranscriptionResult {
  return {
    request_id: "voice-runtime-voice-session-1-voice-turn-1",
    provider_id: "fake-local-stt",
    transcript: SAFE_TRANSCRIPT,
    language: "en",
    latency_ms: 12,
    degraded: false,
    confidence_band: "high",
    metadata_only: true,
  };
}

function ttsResult(): TtsSynthesisResult {
  return {
    request_id: "fake-runtime-response-closeout",
    chunk: {
      chunk_id: "tts-chunk-closeout",
      provider_id: "fake-local-tts",
      voice_id: "fake-voice",
      duration_ms: 1100,
      size_bytes: 24000,
      degraded: false,
      output_ref: SAFE_OUTPUT_REF,
      metadata_only: true,
    },
    latency_ms: 5,
    degraded: false,
    metadata_only: true,
  };
}

function fakeSttProvider(): SttProvider {
  const health: SttProviderHealth = {
    provider_id: "fake-local-stt",
    ok: true,
    provider_kind: "local",
    checked_at_ms: 0,
    degraded: false,
    metadata_only: true,
  };
  return {
    id: "fake-local-stt",
    kind: "local",
    config: {
      provider_id: "fake-local-stt",
      provider_kind: "local",
      model_id: "fake-stt",
      max_audio_bytes: 1_000_000,
      timeout_ms: 5000,
      metadata_only: true,
    },
    metadata_only: true,
    transcribe: vi.fn(async () => sttResult()),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => health),
  };
}

function fakeTtsProvider(): TtsProvider {
  const health: TtsProviderHealth = {
    provider_id: "fake-local-tts",
    ok: true,
    provider_kind: "local",
    checked_at_ms: 0,
    degraded: false,
    metadata_only: true,
  };
  return {
    id: "fake-local-tts",
    kind: "local",
    config: {
      provider_id: "fake-local-tts",
      provider_kind: "local",
      voice_id: "fake-voice",
      max_input_chars: 1000,
      timeout_ms: 5000,
      metadata_only: true,
    },
    metadata_only: true,
    synthesize: vi.fn(async () => ttsResult()),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => health),
  };
}

function fakeRuntimeAdapter(): VoiceRuntimeAdapter {
  const health: VoiceRuntimeAdapterHealth = {
    ok: true,
    degraded: false,
    provider_id: "fake-voice-runtime",
    metadata_only: true,
  };
  return {
    id: "fake-voice-runtime",
    metadata_only: true,
    health: vi.fn(async () => health),
    executeVoiceRequest: vi.fn(
      async (request): Promise<VoiceRuntimeAdapterResponse> => ({
        response_id: `runtime-${request.turn_id}`,
        assistant_text: "Good evening. Voice interruption closeout is safe.",
        latency_ms: 17,
        degraded: false,
        provider_id: "fake-voice-runtime",
        finish_reason: "stop",
        metadata_only: true,
      }),
    ),
    cancel: vi.fn(async () => undefined),
  };
}

function harness(
  overrides: {
    readonly stt?: SttProvider;
    readonly runtime?: VoiceRuntimeAdapter;
    readonly tts?: TtsProvider;
    readonly playbackQueue?: PlaybackQueue;
    readonly cancellationSupervisor?: VoiceCancellationSupervisor;
  } = {},
) {
  const playbackQueue =
    overrides.playbackQueue ??
    createPlaybackQueue({
      max_queue_depth: 4,
      allow_sensitive_content: false,
      metadata_only: true,
    });
  const stt = overrides.stt ?? fakeSttProvider();
  const runtime = overrides.runtime ?? fakeRuntimeAdapter();
  const tts = overrides.tts ?? fakeTtsProvider();
  const orchestrator = createVoiceTurnOrchestrator({
    stt_provider: stt,
    runtime_adapter: runtime,
    tts_provider: tts,
    playback_queue: playbackQueue,
    cancellation_supervisor: overrides.cancellationSupervisor,
    now_ms: () => 2000,
    interruption_id_factory: () => "phase-14g-closeout-interruption",
  });
  return { orchestrator, playbackQueue, stt, runtime, tts };
}

describe("Phase 14G closeout audit", () => {
  it("documents safe manual barge-in fixture metadata only", () => {
    expect(PHASE_14G_SAFE_FIXTURE).toEqual({
      interruption_observed: true,
      playback_queue_cleared: true,
      stale_enqueue_blocked: true,
      metadata_only: true,
    });
    expect(JSON.stringify(PHASE_14G_SAFE_FIXTURE)).not.toMatch(
      /transcript|prompt|response|tool_output|raw_audio|audio_bytes/i,
    );
  });

  it("keeps interruption explicit-only and queue cleanup deterministic", async () => {
    const { orchestrator, playbackQueue, stt, runtime, tts } = harness();

    await orchestrator.runVoiceTurn(captureMetadata(), {
      metadata_only: true,
    });
    expect(playbackQueue.snapshot().depth).toBe(1);
    expect(stt.cancel).not.toHaveBeenCalled();
    expect(runtime.cancel).not.toHaveBeenCalled();
    expect(tts.cancel).not.toHaveBeenCalled();

    const interruption = await orchestrator.interruptActiveTurn("barge_in", {
      metadata_only: true,
    });

    expect(interruption).toMatchObject({
      ok: true,
      value: {
        interruption_status: "interrupted",
        cancellation_result_count: 6,
      },
      snapshot: {
        phase: "interrupted",
        playback_queue_depth: 0,
        interrupted_turn_id: "voice-turn-1",
      },
    });
    expect(playbackQueue.snapshot().depth).toBe(0);
    expect(stt.cancel).toHaveBeenCalledTimes(1);
    expect(runtime.cancel).toHaveBeenCalledTimes(1);
    expect(tts.cancel).toHaveBeenCalledTimes(1);
  });

  it("preserves deterministic full-turn cancellation ordering", async () => {
    const order: string[] = [];
    const supervisor = createVoiceCancellationSupervisor({
      targets: {
        capture: { cancel: vi.fn(() => order.push("capture")) },
        stt: { cancel: vi.fn(() => order.push("stt")) },
        runtime: { cancel: vi.fn(() => order.push("runtime")) },
        tts: { cancel: vi.fn(() => order.push("tts")) },
        playback: { interrupt: vi.fn(() => order.push("playback")) },
        queue: { clear: vi.fn(() => order.push("queue")) },
      },
      now_ms: (() => {
        let current = 100;
        return () => current++;
      })(),
    });

    const result = await supervisor.applyInterruption({
      interruption_id: "phase-14g-order",
      session_id: "voice-session-1",
      turn_id: "voice-turn-1",
      target: "playback",
      scope: "full_turn_interrupt",
      reason: "barge_in",
      created_at: 1,
      metadata_only: true,
    });

    expect(result).toMatchObject({
      ok: true,
      target_results: [
        { target: "capture", scope: "cancel_capture" },
        { target: "stt", scope: "cancel_stt" },
        { target: "runtime", scope: "cancel_runtime" },
        { target: "tts", scope: "cancel_tts" },
        { target: "playback", scope: "cancel_playback" },
        { target: "queue", scope: "clear_queue" },
      ],
    });
    expect(order).toEqual([
      "capture",
      "stt",
      "runtime",
      "tts",
      "playback",
      "queue",
    ]);
  });

  it("keeps duplicate interruption idempotent", async () => {
    const queue = createPlaybackQueue({
      max_queue_depth: 4,
      allow_sensitive_content: false,
      metadata_only: true,
    });
    const clear = vi.spyOn(queue, "clear");
    const { orchestrator } = harness({ playbackQueue: queue });

    await orchestrator.runVoiceTurn(captureMetadata(), {
      metadata_only: true,
    });
    const first = await orchestrator.interruptActiveTurn("barge_in", {
      metadata_only: true,
    });
    const second = await orchestrator.interruptActiveTurn("barge_in", {
      metadata_only: true,
    });

    expect(first).toMatchObject({
      ok: true,
      value: {
        interrupted_turn_id: "voice-turn-1",
        cancellation_result_count: 6,
      },
    });
    expect(second).toMatchObject({
      ok: true,
      value: {
        interrupted_turn_id: "voice-turn-1",
        cancellation_result_count: 6,
      },
    });
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("prevents stale interrupted turns from enqueueing or completing playback", async () => {
    const ttsGate = deferred<TtsSynthesisResult>();
    const tts = fakeTtsProvider();
    tts.synthesize = vi.fn(async () => ttsGate.promise);
    const { orchestrator, playbackQueue } = harness({ tts });

    const oldTurn = orchestrator.runVoiceTurn(captureMetadata("stale-turn"), {
      metadata_only: true,
    });
    await waitUntil(() => expect(tts.synthesize).toHaveBeenCalledTimes(1));

    await orchestrator.interruptActiveTurn("barge_in", {
      metadata_only: true,
    });
    ttsGate.resolve(ttsResult());

    await expect(oldTurn).resolves.toMatchObject({
      ok: false,
      reasons: ["cancelled"],
      snapshot: {
        interrupted_turn_id: "stale-turn",
        stale_completion_count: 1,
      },
    });
    expect(playbackQueue.snapshot().items).toEqual([]);
    expect(orchestrator.snapshot()).toMatchObject({
      phase: "interrupted",
      playback_status: "cancelled",
      playback_queue_depth: 0,
    });
  });

  it("keeps unsafe outputs and tool output speech fail-closed", async () => {
    const { orchestrator, playbackQueue, tts } = harness();

    const result = await orchestrator.runVoiceTurn(captureMetadata(), {
      assistant_content_class: "tool_output",
      metadata_only: true,
    });

    expect(result).toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
      snapshot: {
        phase: "failed",
        error_class: "unsafe_content",
      },
    });
    expect(tts.synthesize).not.toHaveBeenCalled();
    expect(
      playbackQueue.enqueue(playbackItem("tool-output-turn")),
    ).toMatchObject({
      ok: true,
    });
    expect(
      playbackQueue.enqueue({
        ...playbackItem("blocked-tool-output"),
        content_class: "tool_output",
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
    });
  });

  it("rejects action-approval cancellation payloads and keeps runtime governance authoritative", () => {
    expect(
      createVoiceInterruption({
        interruption_id: "phase-14g-unsafe",
        session_id: "voice-session-1",
        turn_id: "voice-turn-1",
        target: "runtime",
        scope: "cancel_runtime",
        reason: "barge_in",
        approved_action: "already-approved-external-action",
        created_at: 1,
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["unsafe_payload"],
      snapshot: {
        degraded: true,
        error_class: "unsafe_payload",
      },
    });
  });

  it("keeps snapshots and results metadata-only", async () => {
    const { orchestrator } = harness();

    await orchestrator.runVoiceTurn(captureMetadata(), {
      metadata_only: true,
    });
    const interruption = await orchestrator.interruptActiveTurn("barge_in", {
      metadata_only: true,
    });
    const serialized = JSON.stringify({
      result: interruption,
      snapshot: orchestrator.snapshot(),
    });

    expect(interruption.snapshot).toMatchObject({
      interruption_status: "interrupted",
      cancellation_result_count: 6,
      degraded: expect.any(Boolean),
      metadata_only: true,
    });
    expect(serialized).not.toMatch(
      /transcript|prompt|response|assistant_text|model_output|tool_output|raw_audio|audio_bytes|waveform|pcm|Good evening/i,
    );
  });

  it("keeps Phase 14G source free of autonomous, streaming, persistence, cloud, UI, and wake-word wiring", () => {
    const source = phase14GSource();

    expect(source).not.toMatch(
      /AsyncIterable|WebSocket|EventSource|XMLHttpRequest|partial_token|partial_transcript|token-stream|tokenStream|streamingPlayback/i,
    );
    expect(source).not.toMatch(
      /autoplay|auto.?play|conversation_loop|setInterval|setTimeout|while\s*\(true\)|backgroundLoop/i,
    );
    expect(source).not.toMatch(
      /wake_word|wakeword|always_listening|always-listening|getUserMedia|MediaStream/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore|better-sqlite3/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api/i,
    );
    expect(source).not.toMatch(
      /approveAction|approvedAction|runAction|executeTool|tool_call|shell_command|child_process|spawn\s*\(|exec\s*\(/i,
    );
  });
});
