import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VOICE_TELEMETRY_ALLOWED_FIELDS,
  VOICE_TELEMETRY_FORBIDDEN_FIELDS,
  assertVoiceTelemetrySafe,
  isVoiceTelemetrySafe,
  sanitizeVoiceTelemetryEvent,
  type VoiceTelemetryEvent,
} from "../../src/lib/voice-runtime";

function allowedEvent(
  overrides: Partial<VoiceTelemetryEvent> = {},
): VoiceTelemetryEvent {
  return {
    event_type: "voice_capture_completed",
    session_id: "voice-session-1",
    turn_id: "turn-1",
    provider_id: "local-stt",
    provider_kind: "stt",
    duration_ms: 1200,
    latency_ms: 35,
    capture_state: "transcribing",
    playback_state: "idle",
    degraded: false,
    cancellation_reason: "user_cancelled",
    error_class: "none",
    redaction_status: "metadata_only",
    timestamp: "2026-05-25T12:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 14A.3 voice telemetry redaction guards", () => {
  it("defines the strict voice telemetry allowlist", () => {
    expect(VOICE_TELEMETRY_ALLOWED_FIELDS).toEqual([
      "event_type",
      "session_id",
      "turn_id",
      "provider_id",
      "provider_kind",
      "duration_ms",
      "latency_ms",
      "capture_state",
      "playback_state",
      "degraded",
      "cancellation_reason",
      "error_class",
      "redaction_status",
      "timestamp",
    ]);
  });

  it("passes and defensively copies allowed metadata-only telemetry", () => {
    const input = allowedEvent();
    const result = sanitizeVoiceTelemetryEvent(input);

    expect(result).toEqual({
      ok: true,
      event: input,
      reasons: [],
    });
    if (!result.ok) throw new Error("expected safe telemetry");
    expect(result.event).not.toBe(input);
    expect(isVoiceTelemetrySafe(input)).toBe(true);
    expect(assertVoiceTelemetrySafe(input)).toEqual(input);
  });

  it.each(VOICE_TELEMETRY_FORBIDDEN_FIELDS)(
    "fails closed when forbidden field %s is present",
    (field) => {
      const result = sanitizeVoiceTelemetryEvent({
        ...allowedEvent(),
        [field]: "unsafe payload",
      });

      expect(result).toEqual({
        ok: false,
        event: null,
        reasons: ["forbidden_field_present"],
      });
      expect(
        isVoiceTelemetrySafe({ ...allowedEvent(), [field]: "unsafe payload" }),
      ).toBe(false);
      expect(() =>
        assertVoiceTelemetrySafe({
          ...allowedEvent(),
          [field]: "unsafe payload",
        }),
      ).toThrow(/Unsafe voice telemetry event/);
    },
  );

  it("removes unknown fields without leaking them", () => {
    const result = sanitizeVoiceTelemetryEvent({
      ...allowedEvent(),
      unknown_debug_payload: "should not survive",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected safe telemetry");
    expect(Object.keys(result.event)).not.toContain("unknown_debug_payload");
    expect(JSON.stringify(result.event)).not.toContain("should not survive");
  });

  it("prevents transcript, audio, prompts, responses, and tool output from appearing", () => {
    for (const field of [
      "transcript",
      "raw_transcript",
      "audio",
      "raw_audio",
      "audio_bytes",
      "prompt",
      "response",
      "tool_output",
    ]) {
      const result = sanitizeVoiceTelemetryEvent({
        ...allowedEvent(),
        [field]: "unsafe",
      });
      expect(result.ok).toBe(false);
    }
  });

  it("fails closed on malformed event shapes and invalid metadata", () => {
    expect(sanitizeVoiceTelemetryEvent(null)).toEqual({
      ok: false,
      event: null,
      reasons: ["malformed_event"],
    });
    expect(
      sanitizeVoiceTelemetryEvent(allowedEvent({ duration_ms: -1 })),
    ).toEqual({
      ok: false,
      event: null,
      reasons: ["invalid_allowed_field"],
    });
    expect(
      sanitizeVoiceTelemetryEvent({
        ...allowedEvent(),
        provider_kind: "cloud",
      }),
    ).toEqual({
      ok: false,
      event: null,
      reasons: ["invalid_allowed_field"],
    });
  });

  it("does not introduce runtime, mic, playback, Tauri, cloud, persistence, or provider execution wiring", () => {
    const source = [
      "src/lib/voice-runtime/telemetry.ts",
      "src/lib/voice-runtime/privacy.ts",
      "src/lib/voice-runtime/index.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|AudioContext|MediaRecorder|navigator\./i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|autoplay.*true|play\(/i,
    );
    expect(source).not.toMatch(/tauri|invoke\(|global-hotkey|globalShortcut/i);
    expect(source).not.toMatch(/ffmpeg|whisper|piper|spawn\(|exec\(/i);
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /appendEvent|appendFile|writeFile|event-store|telemetryStore|persistTelemetry|database|sqlite/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|router\.|scheduler|setInterval|while\s*\(\s*true\s*\)/i,
    );
  });
});
