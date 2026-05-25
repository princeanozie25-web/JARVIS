import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_VOICE_RUNTIME_CONFIG,
  DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
  VOICE_PRIVACY_CONTENT_CLASSES,
  VOICE_RUNTIME_GOVERNANCE_INVARIANTS,
  VOICE_TELEMETRY_ALLOWED_FIELDS,
  VOICE_TELEMETRY_FORBIDDEN_FIELDS,
  canSpeakSensitiveContent,
  canStartCapture,
  canStartPlayback,
  canUseCloudSTT,
  canUseCloudTTS,
  classifyVoiceContentPrivacy,
  createDefaultVoiceRuntimeFeatureFlags,
  createDefaultVoiceRuntimePolicyConfig,
  parseVoiceRuntimePolicyConfig,
  sanitizeVoiceTelemetryEvent,
  validateVoiceRuntimeFeatureFlags,
} from "../../src/lib/voice-runtime";

const VOICE_RUNTIME_SOURCE_FILES = [
  "src/lib/voice-runtime/types.ts",
  "src/lib/voice-runtime/contracts.ts",
  "src/lib/voice-runtime/governance.ts",
  "src/lib/voice-runtime/config.ts",
  "src/lib/voice-runtime/feature-flags.ts",
  "src/lib/voice-runtime/policy.ts",
  "src/lib/voice-runtime/telemetry.ts",
  "src/lib/voice-runtime/privacy.ts",
  "src/lib/voice-runtime/index.ts",
] as const;

function voiceRuntimeSource(): string {
  return VOICE_RUNTIME_SOURCE_FILES.map((path) =>
    readFileSync(join(process.cwd(), path), "utf8"),
  ).join("\n");
}

function localConfig() {
  return {
    ...createDefaultVoiceRuntimePolicyConfig(),
    local_stt_enabled: true,
    local_tts_enabled: true,
    max_voice_session_ms: 10_000,
    max_capture_ms: 3_000,
  };
}

describe("Phase 14A voice runtime scaffold closeout guards", () => {
  it("keeps Phase 14A source scaffold-only and disconnected from execution surfaces", () => {
    const source = voiceRuntimeSource();

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices/i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
    );
    expect(source).not.toMatch(
      /class\s+\w*(?:Stt|Tts|Voice).*Provider|create\w*(?:Stt|Tts|Voice).*Provider/i,
    );
    expect(source).not.toMatch(
      /from\s+["']node:child_process["']|spawn\s*\(|exec\s*\(|execFile\s*\(/i,
    );
    expect(source).not.toMatch(
      /ffmpeg|piper\s+(?:--|["'])|faster-whisper|faster_whisper/i,
    );
    expect(source).not.toMatch(
      /tauri|invoke\s*\(|global-hotkey|globalShortcut/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /setInterval|setTimeout|scheduler|cron|while\s*\(\s*true\s*\)/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(/tsx|jsx|React|useEffect|useState|app\/api/i);
  });

  it("keeps disabled features fail-closed by default and validation", () => {
    expect(DEFAULT_VOICE_RUNTIME_CONFIG).toMatchObject({
      push_to_talk_only: true,
      wake_word_enabled: false,
      always_listening_enabled: false,
      background_recording_enabled: false,
      voice_approval_authority: false,
      transcript_telemetry_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
      bypass_approval_layers: false,
      bypass_runtime_router: false,
      bypass_safety_layers: false,
    });
    expect(DEFAULT_VOICE_RUNTIME_POLICY_CONFIG).toMatchObject({
      wake_word_enabled: false,
      always_listening_enabled: false,
      voice_approval_enabled: false,
      background_capture_enabled: false,
      transcript_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
      cloud_stt_enabled: false,
      cloud_tts_enabled: false,
      playback_autostart_enabled: false,
      allow_tts_for_sensitive_content: false,
    });

    for (const key of [
      "wake_word_enabled",
      "always_listening_enabled",
      "voice_approval_enabled",
      "background_capture_enabled",
      "transcript_persistence_enabled",
      "raw_audio_persistence_enabled",
      "cloud_stt_enabled",
      "cloud_tts_enabled",
      "playback_autostart_enabled",
      "allow_tts_for_sensitive_content",
    ] as const) {
      expect(
        parseVoiceRuntimePolicyConfig({
          ...createDefaultVoiceRuntimePolicyConfig(),
          [key]: true,
        }),
      ).toMatchObject({
        ok: false,
        config: null,
      });
    }
  });

  it("keeps cloud, playback, capture, and sensitive speech denied unless explicit safe gates pass", () => {
    const config = createDefaultVoiceRuntimePolicyConfig();
    const flags = createDefaultVoiceRuntimeFeatureFlags();

    expect(
      canStartCapture({
        config,
        feature_flags: flags,
        requested_duration_ms: 1,
      }),
    ).toMatchObject({ allowed: false });
    expect(
      canStartPlayback({ config, feature_flags: flags, queue_depth: 0 }),
    ).toMatchObject({ allowed: false });
    expect(canUseCloudSTT({ config, feature_flags: flags })).toEqual({
      allowed: false,
      reason: "cloud_stt_disabled",
      metadata_only: true,
    });
    expect(canUseCloudTTS({ config, feature_flags: flags })).toEqual({
      allowed: false,
      reason: "cloud_tts_disabled",
      metadata_only: true,
    });
    expect(
      canSpeakSensitiveContent({
        config: localConfig(),
        feature_flags: flags,
        content_kind: "tool_output",
      }),
    ).toEqual({
      allowed: false,
      reason: "tool_output_blocked",
      metadata_only: true,
    });
  });

  it("keeps runtime integration flags disabled and unable to self-enable", () => {
    expect(DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS).toEqual({
      local_stt: true,
      local_tts: true,
      cloud_stt: false,
      cloud_tts: false,
      playback: false,
      barge_in: false,
      realtime_streaming: false,
      voice_runtime_integration: false,
    });

    for (const key of [
      "cloud_stt",
      "cloud_tts",
      "playback",
      "barge_in",
      "realtime_streaming",
      "voice_runtime_integration",
    ] as const) {
      expect(
        validateVoiceRuntimeFeatureFlags({
          ...createDefaultVoiceRuntimeFeatureFlags(),
          [key]: true,
        }),
      ).toEqual({
        ok: false,
        flags: null,
        reasons: ["disabled_feature_enabled"],
      });
    }
  });

  it("keeps telemetry strict, metadata-only, and non-leaking", () => {
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

    const safe = sanitizeVoiceTelemetryEvent({
      event_type: "voice_capture_completed",
      session_id: "session-1",
      latency_ms: 1,
      redaction_status: "metadata_only",
      timestamp: "2026-05-25T12:00:00.000Z",
      debug_payload: "unknown fields are stripped",
    });
    expect(safe.ok).toBe(true);
    if (!safe.ok) throw new Error("expected safe telemetry");
    expect(Object.keys(safe.event)).toEqual([
      "event_type",
      "session_id",
      "latency_ms",
      "redaction_status",
      "timestamp",
    ]);
    expect(JSON.stringify(safe.event)).not.toContain("unknown fields");

    for (const key of VOICE_TELEMETRY_FORBIDDEN_FIELDS) {
      expect(
        sanitizeVoiceTelemetryEvent({
          event_type: "voice_capture_completed",
          session_id: "session-1",
          redaction_status: "metadata_only",
          timestamp: "2026-05-25T12:00:00.000Z",
          [key]: "unsafe",
        }),
      ).toMatchObject({ ok: false, event: null });
    }
  });

  it("keeps privacy deny-by-default with assistant prose as the only speakable class", () => {
    for (const contentClass of VOICE_PRIVACY_CONTENT_CLASSES) {
      const decision = classifyVoiceContentPrivacy(contentClass);
      if (contentClass === "assistant_prose") {
        expect(decision).toEqual({
          allowed: true,
          content_class: "assistant_prose",
          reason: null,
          redaction_status: "metadata_only",
        });
      } else {
        expect(decision).toMatchObject({
          allowed: false,
          redaction_status: "withheld",
        });
      }
    }
  });

  it("keeps voice transport-only and non-authoritative", () => {
    expect(VOICE_RUNTIME_GOVERNANCE_INVARIANTS).toMatchObject({
      voice_transport_only: true,
      voice_approval_authority: false,
      bypass_approval_layers: false,
      bypass_runtime_router: false,
      bypass_safety_layers: false,
    });

    const defaultConfig = createDefaultVoiceRuntimePolicyConfig();
    const mutated = {
      ...defaultConfig,
      wake_word_enabled: true,
      always_listening_enabled: true,
      cloud_stt_enabled: true,
    };
    expect(parseVoiceRuntimePolicyConfig(mutated)).toMatchObject({
      ok: false,
      config: null,
    });
    expect(createDefaultVoiceRuntimePolicyConfig()).toEqual(defaultConfig);
  });
});
