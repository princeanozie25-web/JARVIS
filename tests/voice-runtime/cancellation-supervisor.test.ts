import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createVoiceCancellationSupervisor,
  type VoiceCancellationSupervisorTargets,
  type VoiceInterruptionEvent,
} from "../../src/lib/voice-runtime";

function supervisorSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/cancellation-supervisor.ts"),
    "utf8",
  );
}

function interruption(
  overrides: Partial<VoiceInterruptionEvent> = {},
): VoiceInterruptionEvent {
  return {
    interruption_id: "interrupt-1",
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    target: "playback",
    scope: "full_turn_interrupt",
    reason: "barge_in",
    created_at: 1000,
    metadata_only: true,
    ...overrides,
  };
}

function clock(start = 100): () => number {
  let current = start;
  return () => current++;
}

function targets(
  order: string[],
  failures: Partial<
    Record<keyof VoiceCancellationSupervisorTargets, boolean>
  > = {},
): VoiceCancellationSupervisorTargets {
  return {
    capture: {
      cancel: vi.fn((reason, options) => {
        order.push(`capture:${reason}:${Boolean(options?.abort_signal)}`);
        if (failures.capture) throw new Error("capture failed");
        return { ok: true, metadata_only: true };
      }),
    },
    stt: {
      cancel: vi.fn((reason, options) => {
        order.push(`stt:${reason}:${Boolean(options?.abort_signal)}`);
        if (failures.stt) throw new Error("stt failed");
        return { ok: true, metadata_only: true };
      }),
    },
    runtime: {
      cancel: vi.fn((reason, options) => {
        order.push(`runtime:${reason}:${Boolean(options?.abort_signal)}`);
        if (failures.runtime) throw new Error("runtime failed");
        return { ok: true, metadata_only: true };
      }),
    },
    tts: {
      cancel: vi.fn((reason, options) => {
        order.push(`tts:${reason}:${Boolean(options?.abort_signal)}`);
        if (failures.tts) throw new Error("tts failed");
        return { ok: true, metadata_only: true };
      }),
    },
    playback: {
      interrupt: vi.fn((reason, options) => {
        order.push(`playback:${reason}:${Boolean(options?.abort_signal)}`);
        if (failures.playback) throw new Error("playback failed");
        return { ok: true, metadata_only: true };
      }),
    },
    queue: {
      clear: vi.fn((reason, options) => {
        order.push(`queue:${reason}:${Boolean(options?.abort_signal)}`);
        if (failures.queue) throw new Error("queue failed");
        return { ok: true, metadata_only: true };
      }),
    },
  };
}

describe("Phase 14G.2 voice cancellation fanout supervisor", () => {
  it("applies full turn interruption in deterministic fanout order", async () => {
    const order: string[] = [];
    const controller = new AbortController();
    const supervisor = createVoiceCancellationSupervisor({
      targets: targets(order),
      now_ms: clock(200),
    });

    await expect(
      supervisor.applyInterruption(interruption(), {
        abort_signal: controller.signal,
        metadata_only: true,
      }),
    ).resolves.toEqual({
      ok: true,
      plan: {
        interruption_id: "interrupt-1",
        session_id: "voice-session-1",
        turn_id: "voice-turn-1",
        target: "playback",
        scope: "full_turn_interrupt",
        reason: "barge_in",
        created_at: 1000,
        targets: ["capture", "stt", "runtime", "tts", "playback", "queue"],
        scopes: [
          "cancel_capture",
          "cancel_stt",
          "cancel_runtime",
          "cancel_tts",
          "cancel_playback",
          "clear_queue",
        ],
        metadata_only: true,
      },
      target_results: [
        {
          target: "capture",
          scope: "cancel_capture",
          applied: true,
          cancelled: true,
          degraded: false,
          completed_at: 200,
          metadata_only: true,
        },
        {
          target: "stt",
          scope: "cancel_stt",
          applied: true,
          cancelled: true,
          degraded: false,
          completed_at: 201,
          metadata_only: true,
        },
        {
          target: "runtime",
          scope: "cancel_runtime",
          applied: true,
          cancelled: true,
          degraded: false,
          completed_at: 202,
          metadata_only: true,
        },
        {
          target: "tts",
          scope: "cancel_tts",
          applied: true,
          cancelled: true,
          degraded: false,
          completed_at: 203,
          metadata_only: true,
        },
        {
          target: "playback",
          scope: "cancel_playback",
          applied: true,
          cancelled: true,
          degraded: false,
          completed_at: 204,
          metadata_only: true,
        },
        {
          target: "queue",
          scope: "clear_queue",
          applied: true,
          cancelled: true,
          degraded: false,
          completed_at: 205,
          metadata_only: true,
        },
      ],
      snapshot: {
        interruption_id: "interrupt-1",
        turn_id: "voice-turn-1",
        session_id: "voice-session-1",
        applied: true,
        degraded: false,
        target_results: expect.any(Array),
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });
    expect(order).toEqual([
      "capture:barge_in:true",
      "stt:user_cancelled:true",
      "runtime:cancelled:true",
      "tts:user_cancelled:true",
      "playback:barge_in:true",
      "queue:clear_queue:true",
    ]);
  });

  it("supports partial cancellation scopes", async () => {
    const order: string[] = [];
    const supervisor = createVoiceCancellationSupervisor({
      targets: targets(order),
      now_ms: clock(300),
    });

    const result = await supervisor.applyInterruption(
      interruption({
        target: "runtime",
        scope: "cancel_runtime",
        reason: "timeout",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      target_results: [
        {
          target: "runtime",
          scope: "cancel_runtime",
          applied: true,
          cancelled: true,
          completed_at: 300,
        },
      ],
      snapshot: {
        applied: true,
        degraded: false,
      },
    });
    expect(order).toEqual(["runtime:cancelled:false"]);
  });

  it("continues bounded fanout when one target fails", async () => {
    const order: string[] = [];
    const supervisor = createVoiceCancellationSupervisor({
      targets: targets(order, { stt: true }),
      now_ms: clock(400),
    });

    const result = await supervisor.applyInterruption(interruption());

    expect(result).toMatchObject({
      ok: true,
      target_results: [
        { target: "capture", cancelled: true, degraded: false },
        {
          target: "stt",
          applied: true,
          cancelled: false,
          degraded: true,
          error_class: "target_failed",
        },
        { target: "runtime", cancelled: true, degraded: false },
        { target: "tts", cancelled: true, degraded: false },
        { target: "playback", cancelled: true, degraded: false },
        { target: "queue", cancelled: true, degraded: false },
      ],
      snapshot: {
        applied: true,
        degraded: true,
        last_error_class: "target_failed",
      },
    });
    expect(order).toEqual([
      "capture:barge_in:false",
      "stt:user_cancelled:false",
      "runtime:cancelled:false",
      "tts:user_cancelled:false",
      "playback:barge_in:false",
      "queue:clear_queue:false",
    ]);
  });

  it("records missing injected targets without skipping remaining targets", async () => {
    const order: string[] = [];
    const supervisor = createVoiceCancellationSupervisor({
      targets: {
        capture: targets(order).capture,
        runtime: targets(order).runtime,
      },
      now_ms: clock(500),
    });

    const result = await supervisor.applyInterruption(interruption());

    expect(result).toMatchObject({
      ok: true,
      target_results: [
        { target: "capture", cancelled: true, degraded: false },
        {
          target: "stt",
          applied: false,
          cancelled: false,
          degraded: true,
          error_class: "target_unavailable",
        },
        { target: "runtime", cancelled: true, degraded: false },
        {
          target: "tts",
          applied: false,
          cancelled: false,
          degraded: true,
          error_class: "target_unavailable",
        },
        {
          target: "playback",
          applied: false,
          cancelled: false,
          degraded: true,
        },
        {
          target: "queue",
          applied: false,
          cancelled: false,
          degraded: true,
        },
      ],
      snapshot: {
        degraded: true,
        last_error_class: "target_unavailable",
      },
    });
    expect(order).toEqual([
      "capture:barge_in:false",
      "runtime:cancelled:false",
    ]);
  });

  it("fails closed on malformed interruptions without invoking targets", async () => {
    const order: string[] = [];
    const supervisor = createVoiceCancellationSupervisor({
      targets: targets(order),
    });

    await expect(
      supervisor.applyInterruption({
        ...interruption(),
        target: "model",
      }),
    ).resolves.toMatchObject({
      ok: false,
      plan: null,
      target_results: [],
      reasons: ["invalid_target"],
      snapshot: {
        applied: false,
        degraded: true,
        last_error_class: "invalid_target",
      },
    });
    expect(order).toEqual([]);
  });

  it("keeps cancellation results and snapshots metadata-only", async () => {
    const supervisor = createVoiceCancellationSupervisor({
      targets: targets([]),
      now_ms: clock(600),
    });
    const result = await supervisor.applyInterruption(interruption());

    expect(JSON.stringify(result)).not.toMatch(
      /transcript|prompt|response|assistant_text|model_output|tool_output|raw_audio|audio_bytes|waveform|pcm|secret|api_key/i,
    );
    expect(supervisor.snapshot()).toEqual(result.snapshot);
    expect(supervisor.snapshot().target_results).not.toBe(
      result.snapshot.target_results,
    );
  });

  it("does not introduce runtime bypass, tool execution, persistence, cloud/network, UI/Tauri, wake word, always-listening, autoplay loops, or realtime streaming", () => {
    const source = supervisorSource();

    expect(source).not.toMatch(
      /createModelRuntime|executeVoiceRequest|executeTool|approveAction|runAction|shell_command|child_process|spawn\s*\(|exec\s*\(/i,
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
      /wake_word|wakeword|always_listening|always-listening|MediaStream|getUserMedia/i,
    );
    expect(source).not.toMatch(
      /autoplay|auto.?play|conversation_loop|setInterval|setTimeout|while\s*\(true\)/i,
    );
    expect(source).not.toMatch(
      /AsyncIterable|partial_token|partial_transcript|token-stream|tokenStream|realtime/i,
    );
  });
});
