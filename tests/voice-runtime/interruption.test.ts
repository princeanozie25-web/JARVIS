import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VOICE_CANCELLATION_SCOPES,
  VOICE_INTERRUPTION_TARGETS,
  applyVoiceInterruption,
  createVoiceCancellationPlan,
  createVoiceInterruption,
  isVoiceCancellationScope,
  isVoiceInterruptionTarget,
  snapshotVoiceInterruption,
  type VoiceInterruptionEvent,
} from "../../src/lib/voice-runtime";

function interruptionSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/interruption.ts"),
    "utf8",
  );
}

function event(
  overrides: Partial<VoiceInterruptionEvent> = {},
): VoiceInterruptionEvent {
  return {
    interruption_id: "interrupt-1",
    session_id: "voice-session-1",
    turn_id: "voice-turn-1",
    target: "playback",
    scope: "cancel_playback",
    reason: "barge_in",
    created_at: 1000,
    metadata_only: true,
    ...overrides,
  };
}

describe("Phase 14G.1 voice interruption and cancellation contracts", () => {
  it("creates deterministic metadata-only interruption events", () => {
    expect(createVoiceInterruption(event())).toEqual({
      ok: true,
      value: event(),
      snapshot: {
        interruption_id: "interrupt-1",
        turn_id: "voice-turn-1",
        session_id: "voice-session-1",
        target: "playback",
        scope: "cancel_playback",
        reason: "barge_in",
        created_at: 1000,
        planned_targets: ["playback"],
        planned_scopes: ["cancel_playback"],
        applied: false,
        degraded: false,
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });
  });

  it("creates deterministic single-scope cancellation plans", () => {
    expect(
      createVoiceCancellationPlan(
        event({
          target: "runtime",
          scope: "cancel_runtime",
          reason: "abort_signal",
        }),
      ),
    ).toEqual({
      ok: true,
      value: {
        interruption_id: "interrupt-1",
        session_id: "voice-session-1",
        turn_id: "voice-turn-1",
        target: "runtime",
        scope: "cancel_runtime",
        reason: "abort_signal",
        created_at: 1000,
        targets: ["runtime"],
        scopes: ["cancel_runtime"],
        metadata_only: true,
      },
      snapshot: {
        interruption_id: "interrupt-1",
        turn_id: "voice-turn-1",
        session_id: "voice-session-1",
        target: "runtime",
        scope: "cancel_runtime",
        reason: "abort_signal",
        created_at: 1000,
        planned_targets: ["runtime"],
        planned_scopes: ["cancel_runtime"],
        applied: false,
        degraded: false,
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });
  });

  it("expands full turn interruption across governed cancellation scopes", () => {
    const result = createVoiceCancellationPlan(
      event({
        target: "playback",
        scope: "full_turn_interrupt",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
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
      snapshot: {
        planned_targets: [
          "capture",
          "stt",
          "runtime",
          "tts",
          "playback",
          "queue",
        ],
        planned_scopes: [
          "cancel_capture",
          "cancel_stt",
          "cancel_runtime",
          "cancel_tts",
          "cancel_playback",
          "clear_queue",
        ],
        applied: false,
        metadata_only: true,
      },
    });
  });

  it("applies interruption metadata without executing cancellation fanout", () => {
    const result = applyVoiceInterruption(event());

    expect(result).toEqual({
      ok: true,
      value: {
        interruption_id: "interrupt-1",
        turn_id: "voice-turn-1",
        session_id: "voice-session-1",
        target: "playback",
        scope: "cancel_playback",
        reason: "barge_in",
        created_at: 1000,
        planned_targets: ["playback"],
        planned_scopes: ["cancel_playback"],
        applied: true,
        degraded: false,
        metadata_only: true,
      },
      snapshot: {
        interruption_id: "interrupt-1",
        turn_id: "voice-turn-1",
        session_id: "voice-session-1",
        target: "playback",
        scope: "cancel_playback",
        reason: "barge_in",
        created_at: 1000,
        planned_targets: ["playback"],
        planned_scopes: ["cancel_playback"],
        applied: true,
        degraded: false,
        metadata_only: true,
      },
      reasons: [],
      metadata_only: true,
    });
  });

  it("fails closed on invalid targets, scopes, reasons, mismatches, unknown fields, and external action payloads", () => {
    expect(
      createVoiceInterruption({
        ...event(),
        target: "model",
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["invalid_target"],
      snapshot: {
        error_class: "invalid_target",
        degraded: true,
      },
    });

    expect(
      createVoiceInterruption({
        ...event(),
        scope: "cancel_model",
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["invalid_scope"],
    });

    expect(
      createVoiceInterruption({
        ...event(),
        reason: "approved_action_cancel",
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["invalid_reason"],
    });

    expect(
      createVoiceInterruption({
        ...event(),
        target: "stt",
        scope: "cancel_runtime",
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["target_scope_mismatch"],
    });

    expect(
      createVoiceInterruption({
        ...event(),
        surprise: true,
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["invalid_event"],
    });

    expect(
      createVoiceInterruption({
        ...event(),
        approved_action: "do-not-cancel-this-action",
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["unsafe_payload"],
    });
  });

  it("snapshots are metadata-only and defensive-copy safe", () => {
    const planResult = createVoiceCancellationPlan(
      event({ scope: "full_turn_interrupt" }),
    );
    if (!planResult.ok) throw new Error("expected plan");

    const snapshotResult = snapshotVoiceInterruption(planResult.value);
    if (!snapshotResult.ok) throw new Error("expected snapshot");

    (snapshotResult.value.planned_targets as string[]).push("runtime");
    (planResult.value.targets as string[]).push("runtime");

    expect(snapshotVoiceInterruption(planResult.value)).toMatchObject({
      ok: false,
      reasons: ["invalid_event"],
    });
    expect(
      snapshotVoiceInterruption(
        createVoiceCancellationPlan(event({ scope: "full_turn_interrupt" })),
      ),
    ).toMatchObject({
      ok: false,
      reasons: ["invalid_event"],
    });

    const cleanSnapshot = snapshotVoiceInterruption(
      event({ scope: "full_turn_interrupt" }),
    );
    expect(cleanSnapshot).toMatchObject({
      ok: true,
      value: {
        planned_targets: [
          "capture",
          "stt",
          "runtime",
          "tts",
          "playback",
          "queue",
        ],
      },
    });
    expect(JSON.stringify(cleanSnapshot)).not.toMatch(
      /transcript|prompt|assistant response|assistant_text|model_output|tool_output|raw_audio|audio_bytes|waveform|pcm/i,
    );
  });

  it("exports stable targets, scopes, and predicates", () => {
    expect(VOICE_INTERRUPTION_TARGETS).toEqual([
      "capture",
      "stt",
      "runtime",
      "tts",
      "playback",
      "queue",
    ]);
    expect(VOICE_CANCELLATION_SCOPES).toEqual([
      "cancel_capture",
      "cancel_stt",
      "cancel_runtime",
      "cancel_tts",
      "cancel_playback",
      "clear_queue",
      "full_turn_interrupt",
    ]);
    expect(isVoiceInterruptionTarget("runtime")).toBe(true);
    expect(isVoiceInterruptionTarget("router")).toBe(false);
    expect(isVoiceCancellationScope("full_turn_interrupt")).toBe(true);
    expect(isVoiceCancellationScope("cancel_cloud")).toBe(false);
  });

  it("does not introduce realtime fanout, autoplay loops, wake word, always-listening, persistence, cloud/network, UI/Tauri, or runtime bypass", () => {
    const source = interruptionSource();

    expect(source).not.toMatch(
      /AsyncIterable|WebSocket|EventSource|XMLHttpRequest|stream\s*\(|partial_token|partial_transcript|realtime/i,
    );
    expect(source).not.toMatch(
      /autoplay|auto.?play|conversation_loop|setInterval|setTimeout|while\s*\(true\)/i,
    );
    expect(source).not.toMatch(
      /wake_word|wakeword|always_listening|always-listening|MediaStream|getUserMedia/i,
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
      /createModelRuntime|executeVoiceRequest|executeTool|approveAction|runAction|shell_command|child_process|spawn\s*\(|exec\s*\(/i,
    );
  });
});
