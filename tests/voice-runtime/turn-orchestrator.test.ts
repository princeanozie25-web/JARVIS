import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  FAKE_VOICE_RUNTIME_RESPONSE_TEXT,
  createRealVoiceRuntimeAdapter,
  createFakeVoiceRuntimeAdapter,
  createPlaybackQueue,
  createVoiceTurnOrchestrator,
  type VoiceCancellationSupervisor,
  type VoiceCancellationSupervisorResult,
  type PlaybackQueue,
  type PlaybackQueueItem,
  type SttProvider,
  type SttProviderHealth,
  type SttTranscriptionResult,
  type TtsProvider,
  type TtsProviderHealth,
  type TtsSynthesisResult,
  type VoiceRuntimeAdapter,
  type VoiceRuntimeAdapterHealth,
  type VoiceRuntimeBridgeCapturedAudioMetadata,
} from "../../src/lib/voice-runtime";
import type { ModelRuntime, ModelRuntimeExecuteResult } from "../../src/models";

const SAFE_TRANSCRIPT = "Good evening. All systems are operational.";
const SAFE_OUTPUT_REF = "C:/tmp/jarvis-fake-tts.wav";

function orchestratorSource(): string {
  return [
    "src/lib/voice-runtime/turn-orchestrator.ts",
    "src/lib/voice-runtime/index.ts",
  ]
    .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
    .join("\n");
}

function capturedAudio(
  overrides: Partial<VoiceRuntimeBridgeCapturedAudioMetadata> = {},
): VoiceRuntimeBridgeCapturedAudioMetadata {
  return {
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    audio_ref: "C:/tmp/jarvis-capture.wav",
    duration_ms: 1200,
    size_bytes: 32000,
    sample_rate_hz: 16000,
    channel_count: 1,
    degraded: false,
    started_at: "2026-05-27T07:00:00.000Z",
    stopped_at: "2026-05-27T07:00:01.200Z",
    metadata_only: true,
    ...overrides,
  };
}

function playbackItem(
  overrides: Partial<PlaybackQueueItem> = {},
): PlaybackQueueItem {
  return {
    item_id: "existing-playback-item",
    session_id: "voice-session-existing",
    turn_id: "voice-turn-existing",
    chunk_id: "existing-chunk",
    provider_id: "fake-local-tts",
    voice_id: "fake-voice",
    audio_ref: "C:/tmp/existing.wav",
    duration_ms: 100,
    size_bytes: 200,
    content_class: "assistant_prose",
    created_at: "2026-05-27T07:00:00.000Z",
    metadata_only: true,
    ...overrides,
  };
}

function sttResult(transcript = SAFE_TRANSCRIPT): SttTranscriptionResult {
  return {
    request_id: "voice-runtime-voice-session-1-voice-turn-1",
    provider_id: "fake-local-stt",
    transcript,
    language: "en",
    latency_ms: 12,
    degraded: false,
    confidence_band: "high",
    metadata_only: true,
  };
}

function ttsResult(): TtsSynthesisResult {
  return {
    request_id: "fake-runtime-response-e1ffcce3",
    chunk: {
      chunk_id: "tts-chunk-1",
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

function fakeSttProvider(
  options: {
    readonly ok?: boolean;
    readonly transcribeFails?: boolean;
    readonly order?: string[];
  } = {},
): SttProvider {
  const health: SttProviderHealth = {
    provider_id: "fake-local-stt",
    ok: options.ok ?? true,
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
    transcribe: vi.fn(async () => {
      options.order?.push("stt.transcribe");
      if (options.transcribeFails) throw new Error("stt failed");
      return sttResult();
    }),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => {
      options.order?.push("stt.health");
      return health;
    }),
  };
}

function fakeTtsProvider(
  options: {
    readonly ok?: boolean;
    readonly synthesizeFails?: boolean;
    readonly order?: string[];
  } = {},
): TtsProvider {
  const health: TtsProviderHealth = {
    provider_id: "fake-local-tts",
    ok: options.ok ?? true,
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
    synthesize: vi.fn(async () => {
      options.order?.push("tts.synthesize");
      if (options.synthesizeFails) throw new Error("tts failed");
      return ttsResult();
    }),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(async () => {
      options.order?.push("tts.health");
      return health;
    }),
  };
}

function orderedRuntimeAdapter(order: string[]): VoiceRuntimeAdapter {
  const runtime = createFakeVoiceRuntimeAdapter({ now_ms: () => 1000 });
  return {
    ...runtime,
    health: vi.fn(async () => {
      order.push("runtime.health");
      return runtime.health();
    }),
    executeVoiceRequest: vi.fn(async (request, options) => {
      order.push("runtime.execute");
      return runtime.executeVoiceRequest(request, options);
    }),
  };
}

function spiedRuntimeAdapter(): VoiceRuntimeAdapter {
  const runtime = createFakeVoiceRuntimeAdapter({ now_ms: () => 1000 });
  return {
    ...runtime,
    health: vi.fn(runtime.health),
    executeVoiceRequest: vi.fn(runtime.executeVoiceRequest),
    cancel: vi.fn(runtime.cancel),
  };
}

function failingRuntimeAdapter(
  mode: "unavailable" | "fail" | "cancelled",
): VoiceRuntimeAdapter {
  if (mode === "cancelled") {
    return {
      id: "fake-voice-runtime",
      metadata_only: true,
      health: vi.fn(
        async (): Promise<VoiceRuntimeAdapterHealth> => ({
          ok: true,
          degraded: false,
          provider_id: "fake-voice-runtime",
          metadata_only: true,
        }),
      ),
      executeVoiceRequest: vi.fn(async () => {
        throw { reason: "cancelled", metadata_only: true };
      }),
      cancel: vi.fn(async () => undefined),
    };
  }
  return createFakeVoiceRuntimeAdapter({ mode });
}

function createHarness(
  options: {
    readonly stt?: SttProvider;
    readonly runtime?: VoiceRuntimeAdapter;
    readonly tts?: TtsProvider;
    readonly playbackQueue?: PlaybackQueue;
    readonly queueDepth?: number;
    readonly cancellationSupervisor?: VoiceCancellationSupervisor;
  } = {},
) {
  const playbackQueue =
    options.playbackQueue ??
    createPlaybackQueue({
      max_queue_depth: options.queueDepth ?? 4,
      allow_sensitive_content: false,
      metadata_only: true,
    });
  const stt = options.stt ?? fakeSttProvider();
  const runtime = options.runtime ?? spiedRuntimeAdapter();
  const tts = options.tts ?? fakeTtsProvider();
  const orchestrator = createVoiceTurnOrchestrator({
    stt_provider: stt,
    runtime_adapter: runtime,
    tts_provider: tts,
    playback_queue: playbackQueue,
    cancellation_supervisor: options.cancellationSupervisor,
    now_ms: () => 2000,
    interruption_id_factory: () => "voice-interruption-test",
  });
  return { orchestrator, playbackQueue, stt, runtime, tts };
}

function fakeCancellationSupervisor(
  playbackQueue: PlaybackQueue,
  order: string[],
  options: { readonly fail?: boolean } = {},
): VoiceCancellationSupervisor {
  return {
    applyInterruption: vi.fn(async (input) => {
      const event = input as {
        readonly interruption_id: string;
        readonly session_id: string;
        readonly turn_id: string;
        readonly target: "playback";
        readonly scope: "full_turn_interrupt";
        readonly reason: "barge_in";
        readonly created_at: number;
        readonly metadata_only: true;
      };
      order.push(`${event.scope}:${event.turn_id}:${event.reason}`);
      if (options.fail) {
        return {
          ok: false,
          plan: null,
          target_results: [],
          snapshot: {
            interruption_id: event.interruption_id,
            turn_id: event.turn_id,
            session_id: event.session_id,
            applied: false,
            degraded: true,
            target_results: [],
            last_error_class: "target_failed",
            metadata_only: true,
          },
          reasons: ["target_failed"],
          metadata_only: true,
        } satisfies VoiceCancellationSupervisorResult;
      }
      playbackQueue.clear("full_turn_interrupt");
      return {
        ok: true,
        plan: {
          ...event,
          targets: ["capture", "stt", "runtime", "tts", "playback", "queue"],
          scopes: [
            "cancel_capture",
            "cancel_stt",
            "cancel_runtime",
            "cancel_tts",
            "cancel_playback",
            "clear_queue",
          ],
        },
        target_results: [
          "capture",
          "stt",
          "runtime",
          "tts",
          "playback",
          "queue",
        ].map((target, index) => ({
          target,
          scope: [
            "cancel_capture",
            "cancel_stt",
            "cancel_runtime",
            "cancel_tts",
            "cancel_playback",
            "clear_queue",
          ][index],
          applied: true,
          cancelled: true,
          degraded: false,
          completed_at: 2100 + index,
          metadata_only: true,
        })),
        snapshot: {
          interruption_id: event.interruption_id,
          turn_id: event.turn_id,
          session_id: event.session_id,
          applied: true,
          degraded: false,
          target_results: [],
          metadata_only: true,
        },
        reasons: [],
        metadata_only: true,
      } as VoiceCancellationSupervisorResult;
    }),
    snapshot: vi.fn(() => ({
      interruption_id: null,
      turn_id: null,
      session_id: null,
      applied: false,
      degraded: false,
      target_results: [],
      metadata_only: true as const,
    })),
  };
}

function governedRuntimeResult(content: string): ModelRuntimeExecuteResult {
  return {
    request_id: "voice-runtime-voice-session-1-voice-turn-1",
    ok: true,
    response: {
      request_id: "voice-runtime-voice-session-1-voice-turn-1",
      model_id: "local-primary",
      provider_id: "governed-provider",
      output: {
        kind: "text",
        content,
      },
      latency_ms: 15,
      token_usage: {
        input_tokens: 4,
        output_tokens: 3,
        total_tokens: 7,
      },
      finish_reason: "stop",
      degraded: false,
      redaction_status: "metadata_only",
    },
    metadata: {
      selected_model_id: "local-primary",
      attempted_models: ["local-primary"],
      successful_model: "local-primary",
      failed_models: [],
      fallback_used: false,
      governance_flags: [],
      latency_ms: 17,
      degraded: false,
      execution_summary: {
        execution_id: "voice-runtime-voice-session-1-voice-turn-1",
        request_id: "voice-runtime-voice-session-1-voice-turn-1",
        capability: "chat",
        selected_model_id: "local-primary",
        selected_provider: "governed-provider",
        attempted_models: ["local-primary"],
        successful_model: "local-primary",
        failed_models: [],
        fallback_used: false,
        fallback_chain: [],
        latency_ms: 17,
        token_usage: {
          input_tokens: 4,
          output_tokens: 3,
          total_tokens: 7,
        },
        degraded: false,
        finish_reason: "stop",
        governance_flags: [],
        redaction_status: "metadata_only",
        runtime_class: "local",
        provider_kind: "ollama",
      },
    },
  };
}

describe("Phase 14F.3 voice turn orchestrator with fake runtime", () => {
  it("runs the fake-first voice turn and queues playback metadata without autoplay", async () => {
    const { orchestrator, playbackQueue } = createHarness();

    await expect(
      orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true }),
    ).resolves.toEqual({
      ok: true,
      value: {
        session_id: "voice-session-1",
        turn_id: "voice-turn-1",
        runtime_response_id: "fake-runtime-response-4899149a",
        runtime_latency_ms: 48,
        runtime_provider_id: "fake-voice-runtime",
        runtime_finish_reason: "stop",
        playback_item_id: "voice-playback-tts-chunk-1",
        playback_queue_depth: 1,
        degraded: false,
        metadata_only: true,
      },
      snapshot: {
        session_id: "voice-session-1",
        turn_id: "voice-turn-1",
        phase: "queued_for_playback",
        stt_status: "complete",
        runtime_status: "complete",
        tts_status: "complete",
        playback_status: "complete",
        playback_queue_depth: 1,
        degraded: false,
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });

    expect(playbackQueue.snapshot()).toMatchObject({
      depth: 1,
      items: [
        {
          item_id: "voice-playback-tts-chunk-1",
          content_class: "assistant_prose",
          audio_ref: SAFE_OUTPUT_REF,
        },
      ],
    });
    expect(JSON.stringify(orchestrator.snapshot())).not.toContain(
      SAFE_TRANSCRIPT,
    );
    expect(JSON.stringify(orchestrator.snapshot())).not.toContain(
      FAKE_VOICE_RUNTIME_RESPONSE_TEXT,
    );
  });

  it("calls STT, runtime adapter, and TTS in deterministic order", async () => {
    const order: string[] = [];
    const { orchestrator } = createHarness({
      stt: fakeSttProvider({ order }),
      runtime: orderedRuntimeAdapter(order),
      tts: fakeTtsProvider({ order }),
    });

    await orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true });

    expect(order).toEqual([
      "stt.health",
      "stt.transcribe",
      "runtime.health",
      "runtime.execute",
      "tts.health",
      "tts.synthesize",
    ]);
  });

  it("can explicitly run through the real governed runtime adapter without autoplay", async () => {
    const execute = vi.fn(
      async (): Promise<ModelRuntimeExecuteResult> =>
        governedRuntimeResult("real-runtime-answer"),
    );
    const runtime: ModelRuntime = {
      execute,
      stream: async function* () {
        return;
      },
    };
    const { orchestrator, playbackQueue } = createHarness({
      runtime: createRealVoiceRuntimeAdapter({ runtime }),
    });

    const result = await orchestrator.runVoiceTurn(capturedAudio(), {
      metadata_only: true,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        runtime_response_id: "voice-runtime-voice-session-1-voice-turn-1",
        runtime_provider_id: "governed-provider",
        runtime_latency_ms: 17,
        runtime_finish_reason: "stop",
        playback_queue_depth: 1,
      },
      snapshot: {
        phase: "queued_for_playback",
        playback_status: "complete",
      },
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "chat",
        resolver_options: expect.objectContaining({
          runtime_class: "local",
          allow_cloud: false,
          allow_disabled: false,
          required_tools: false,
        }),
        options: {
          tool_choice: "none",
        },
      }),
    );
    expect(playbackQueue.snapshot().depth).toBe(1);
  });

  it("passes AbortSignal to STT, runtime, and TTS without exposing payloads", async () => {
    const controller = new AbortController();
    const { orchestrator, stt, runtime, tts } = createHarness();

    const result = await orchestrator.runVoiceTurn(capturedAudio(), {
      abort_signal: controller.signal,
      timeout_ms: 1234,
      metadata_only: true,
    });

    expect(result.ok).toBe(true);
    expect(stt.transcribe).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        abort_signal: controller.signal,
        timeout_ms: 1234,
        metadata_only: true,
      }),
    );
    expect(runtime.executeVoiceRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        abort_signal: controller.signal,
        timeout_ms: 1234,
        metadata_only: true,
      }),
    );
    expect(tts.synthesize).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        abort_signal: controller.signal,
        timeout_ms: 1234,
        metadata_only: true,
      }),
    );
  });

  it("fails closed before any provider call when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { orchestrator, stt, runtime, tts } = createHarness();

    await expect(
      orchestrator.runVoiceTurn(capturedAudio(), {
        abort_signal: controller.signal,
        metadata_only: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["cancelled"],
      snapshot: {
        phase: "cancelled",
        stt_status: "cancelled",
        runtime_status: "cancelled",
        tts_status: "cancelled",
        playback_status: "cancelled",
      },
    });

    expect(stt.transcribe).not.toHaveBeenCalled();
    expect(runtime.executeVoiceRequest).not.toHaveBeenCalled();
    expect(tts.synthesize).not.toHaveBeenCalled();
  });

  it("fails closed for missing capture metadata and STT failures", async () => {
    await expect(
      createHarness().orchestrator.runVoiceTurn(null, {
        metadata_only: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["malformed_capture"],
      snapshot: {
        phase: "failed",
        stt_status: "failed",
      },
    });

    await expect(
      createHarness({
        stt: fakeSttProvider({ ok: false }),
      }).orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["stt_unavailable"],
      snapshot: {
        phase: "failed",
        stt_status: "failed",
      },
    });

    await expect(
      createHarness({
        stt: fakeSttProvider({ transcribeFails: true }),
      }).orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["stt_failed"],
      snapshot: {
        phase: "failed",
        stt_status: "failed",
      },
    });
  });

  it("fails closed for runtime adapter unavailable, failed, or cancelled states", async () => {
    await expect(
      createHarness({
        runtime: failingRuntimeAdapter("unavailable"),
      }).orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["runtime_unavailable"],
      snapshot: {
        phase: "failed",
        runtime_status: "failed",
      },
    });

    await expect(
      createHarness({
        runtime: failingRuntimeAdapter("fail"),
      }).orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["runtime_failed"],
      snapshot: {
        phase: "failed",
        runtime_status: "failed",
      },
    });

    await expect(
      createHarness({
        runtime: failingRuntimeAdapter("cancelled"),
      }).orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["runtime_cancelled"],
      snapshot: {
        phase: "cancelled",
        runtime_status: "cancelled",
      },
    });
  });

  it("fails closed for unsafe assistant content, TTS failures, and enqueue failures", async () => {
    const unsafe = createHarness();
    await expect(
      unsafe.orchestrator.runVoiceTurn(capturedAudio(), {
        assistant_content_class: "tool_output",
        metadata_only: true,
      }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
      snapshot: {
        phase: "failed",
        tts_status: "idle",
      },
    });
    expect(unsafe.tts.synthesize).not.toHaveBeenCalled();

    await expect(
      createHarness({
        tts: fakeTtsProvider({ ok: false }),
      }).orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["tts_unavailable"],
      snapshot: {
        phase: "failed",
        tts_status: "failed",
      },
    });

    await expect(
      createHarness({
        tts: fakeTtsProvider({ synthesizeFails: true }),
      }).orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true }),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["tts_failed"],
      snapshot: {
        phase: "failed",
        tts_status: "failed",
      },
    });

    const fullQueue = createPlaybackQueue({
      max_queue_depth: 1,
      allow_sensitive_content: false,
      metadata_only: true,
    });
    expect(fullQueue.enqueue(playbackItem()).ok).toBe(true);
    await expect(
      createHarness({ playbackQueue: fullQueue }).orchestrator.runVoiceTurn(
        capturedAudio(),
        { metadata_only: true },
      ),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["enqueue_failed"],
      snapshot: {
        phase: "failed",
        playback_status: "failed",
        playback_queue_depth: 1,
      },
    });
  });

  it("reset clears metadata state and playback queue without exposing transcripts", async () => {
    const { orchestrator, playbackQueue } = createHarness();

    await orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true });
    expect(playbackQueue.snapshot().depth).toBe(1);

    expect(orchestrator.reset()).toEqual({
      ok: true,
      value: null,
      snapshot: {
        session_id: null,
        turn_id: null,
        phase: "idle",
        stt_status: "idle",
        runtime_status: "idle",
        tts_status: "idle",
        playback_status: "idle",
        playback_queue_depth: 0,
        degraded: false,
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });
    expect(playbackQueue.snapshot().depth).toBe(0);
  });

  it("interrupts an active turn through the default cancellation supervisor and clears queued playback", async () => {
    const { orchestrator, playbackQueue, stt, runtime, tts } = createHarness();

    await orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true });
    expect(playbackQueue.snapshot().depth).toBe(1);

    const interruption = await orchestrator.interruptActiveTurn("barge_in", {
      interruption_id: "interrupt-active-turn",
      metadata_only: true,
    });

    expect(interruption).toMatchObject({
      ok: true,
      value: {
        active_turn_id: null,
        interrupted_turn_id: "voice-turn-1",
        interruption_status: "interrupted",
        cancellation_result_count: 6,
        metadata_only: true,
      },
      snapshot: {
        phase: "interrupted",
        stt_status: "cancelled",
        runtime_status: "cancelled",
        tts_status: "cancelled",
        playback_status: "cancelled",
        playback_queue_depth: 0,
        active_turn_id: null,
        interrupted_turn_id: "voice-turn-1",
        interruption_status: "interrupted",
        cancellation_result_count: 6,
      },
    });
    expect(playbackQueue.snapshot().depth).toBe(0);
    expect(stt.cancel).toHaveBeenCalledWith(
      "user_cancelled",
      expect.objectContaining({ metadata_only: true }),
    );
    expect(runtime.cancel).toHaveBeenCalledWith(
      "cancelled",
      expect.objectContaining({ metadata_only: true }),
    );
    expect(tts.cancel).toHaveBeenCalledWith(
      "user_cancelled",
      expect.objectContaining({ metadata_only: true }),
    );
  });

  it("begins a new explicit PTT turn only after full-turn interruption fanout", async () => {
    const order: string[] = [];
    const playbackQueue = createPlaybackQueue({
      max_queue_depth: 4,
      allow_sensitive_content: false,
      metadata_only: true,
    });
    const cancellationSupervisor = fakeCancellationSupervisor(
      playbackQueue,
      order,
    );
    const { orchestrator } = createHarness({
      playbackQueue,
      cancellationSupervisor,
    });

    await orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true });
    expect(playbackQueue.snapshot().items).toHaveLength(1);

    const result = await orchestrator.beginNewTurnWithInterruption(
      capturedAudio({ turn_id: "voice-turn-2" }),
      { metadata_only: true },
    );

    expect(cancellationSupervisor.applyInterruption).toHaveBeenCalledWith(
      {
        interruption_id: "voice-interruption-test",
        session_id: "voice-session-1",
        turn_id: "voice-turn-1",
        target: "playback",
        scope: "full_turn_interrupt",
        reason: "barge_in",
        created_at: 2000,
        metadata_only: true,
      },
      {
        abort_signal: undefined,
        metadata_only: true,
      },
    );
    expect(order).toEqual(["full_turn_interrupt:voice-turn-1:barge_in"]);
    expect(result).toMatchObject({
      ok: true,
      value: {
        turn_id: "voice-turn-2",
        playback_queue_depth: 1,
      },
      snapshot: {
        turn_id: "voice-turn-2",
        active_turn_id: "voice-turn-2",
        interrupted_turn_id: "voice-turn-1",
        interruption_status: "interrupted",
        cancellation_result_count: 6,
        playback_queue_depth: 1,
      },
    });
    expect(playbackQueue.snapshot().items).toMatchObject([
      {
        turn_id: "voice-turn-2",
        content_class: "assistant_prose",
      },
    ]);
  });

  it("fails closed and does not start a new turn when interruption fanout fails", async () => {
    const order: string[] = [];
    const playbackQueue = createPlaybackQueue({
      max_queue_depth: 4,
      allow_sensitive_content: false,
      metadata_only: true,
    });
    const stt = fakeSttProvider();
    const cancellationSupervisor = fakeCancellationSupervisor(
      playbackQueue,
      order,
      { fail: true },
    );
    const { orchestrator } = createHarness({
      playbackQueue,
      stt,
      cancellationSupervisor,
    });

    await orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true });
    expect(stt.transcribe).toHaveBeenCalledTimes(1);

    await expect(
      orchestrator.beginNewTurnWithInterruption(
        capturedAudio({ turn_id: "voice-turn-2" }),
        { metadata_only: true },
      ),
    ).resolves.toMatchObject({
      ok: false,
      reasons: ["interruption_failed"],
      snapshot: {
        phase: "failed",
        error_class: "interruption_failed",
        interruption_status: "failed",
      },
    });
    expect(stt.transcribe).toHaveBeenCalledTimes(1);
    expect(playbackQueue.snapshot().items).toHaveLength(1);
  });

  it("does not interrupt when no prior turn is active", async () => {
    const order: string[] = [];
    const playbackQueue = createPlaybackQueue({
      max_queue_depth: 4,
      allow_sensitive_content: false,
      metadata_only: true,
    });
    const cancellationSupervisor = fakeCancellationSupervisor(
      playbackQueue,
      order,
    );
    const { orchestrator } = createHarness({
      playbackQueue,
      cancellationSupervisor,
    });

    const result = await orchestrator.beginNewTurnWithInterruption(
      capturedAudio({ turn_id: "voice-turn-first" }),
      { metadata_only: true },
    );

    expect(cancellationSupervisor.applyInterruption).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        active_turn_id: "voice-turn-first",
        interruption_status: "not_required",
        cancellation_result_count: 0,
      },
    });
  });

  it("snapshots remain metadata-only and never expose transcript, assistant text, prompts, responses, tool output, or raw audio", async () => {
    const { orchestrator } = createHarness();

    await orchestrator.runVoiceTurn(capturedAudio(), { metadata_only: true });
    const snapshot = orchestrator.snapshot();

    expect(Object.keys(snapshot)).toEqual([
      "turn_id",
      "session_id",
      "phase",
      "stt_status",
      "runtime_status",
      "tts_status",
      "playback_status",
      "playback_queue_depth",
      "degraded",
      "metadata_only",
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|transcript|assistant_text|prompt|response|model_output|tool_output|Good evening/i,
    );
  });

  it("does not introduce real runtime/router/model execution, tools, persistence, cloud, UI, wake word, always-listening, streaming, or autoplay", () => {
    const source = orchestratorSource();

    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|from\s+["'][^"']*\/router|router\.|modelProvider|providerMap/i,
    );
    expect(source).not.toMatch(
      /tool_call|executeTool|approveAction|runAction|shell_command|child_process|spawn\s*\(|exec\s*\(/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore|better-sqlite3/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api/i,
    );
    expect(source).not.toMatch(
      /wake_word|wakeword|always_listening|always-listening|MediaStream|AsyncIterable|partial_transcript|partial_token|partial_result/i,
    );
    expect(source).not.toMatch(
      /playback_autostart|beginPlayback\s*\(|playLoaded\s*\(|loadNext\s*\(|autoplay/i,
    );
  });
});
