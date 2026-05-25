import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
  VOICE_RUNTIME_FEATURE_FLAG_KEYS,
  assertVoiceRuntimePolicyConfig,
  createDefaultVoiceRuntimeFeatureFlags,
  createDefaultVoiceRuntimePolicyConfig,
  parseVoiceRuntimePolicyConfig,
  validateVoiceRuntimeFeatureFlags,
} from "../../src/lib/voice-runtime";

function validConfig(
  overrides: Partial<typeof DEFAULT_VOICE_RUNTIME_POLICY_CONFIG> = {},
) {
  return {
    ...DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
    max_voice_session_ms: 30_000,
    max_capture_ms: 5_000,
    ...overrides,
  };
}

describe("Phase 14A.2 voice runtime config", () => {
  it("defaults fail closed for forbidden voice runtime features", () => {
    expect(createDefaultVoiceRuntimePolicyConfig()).toEqual({
      push_to_talk_enabled: true,
      wake_word_enabled: false,
      always_listening_enabled: false,
      voice_approval_enabled: false,
      background_capture_enabled: false,
      transcript_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
      local_stt_enabled: false,
      local_tts_enabled: false,
      cloud_stt_enabled: false,
      cloud_tts_enabled: false,
      playback_autostart_enabled: false,
      microphone_device_id: null,
      speaker_device_id: null,
      max_voice_session_ms: 0,
      max_capture_ms: 0,
      max_playback_queue_depth: 0,
      allow_tts_for_sensitive_content: false,
    });
    expect(Object.keys(DEFAULT_VOICE_RUNTIME_POLICY_CONFIG)).not.toContain(
      "wake_word_config",
    );
    expect(Object.keys(DEFAULT_VOICE_RUNTIME_POLICY_CONFIG)).not.toContain(
      "always_listening_config",
    );
  });

  it.each([
    ["wake_word_enabled", "wake_word_forbidden"],
    ["always_listening_enabled", "always_listening_forbidden"],
    ["voice_approval_enabled", "voice_approval_forbidden"],
    ["background_capture_enabled", "background_capture_forbidden"],
    ["transcript_persistence_enabled", "transcript_persistence_forbidden"],
    ["raw_audio_persistence_enabled", "raw_audio_persistence_forbidden"],
    ["cloud_stt_enabled", "cloud_stt_forbidden"],
    ["cloud_tts_enabled", "cloud_tts_forbidden"],
    ["playback_autostart_enabled", "playback_autostart_forbidden"],
  ] as const)("rejects forbidden enablement for %s", (key, reason) => {
    const result = parseVoiceRuntimePolicyConfig({
      ...validConfig(),
      [key]: true,
    });

    expect(result).toEqual({
      ok: false,
      config: null,
      denial_reasons: expect.arrayContaining([reason]),
    });
  });

  it("fails closed on malformed config, unknown fields, missing push-to-talk, and invalid limits", () => {
    expect(parseVoiceRuntimePolicyConfig(null)).toEqual({
      ok: false,
      config: null,
      denial_reasons: ["malformed_config"],
    });
    expect(
      parseVoiceRuntimePolicyConfig({
        ...validConfig(),
        unknown: true,
      }),
    ).toMatchObject({
      ok: false,
      denial_reasons: ["malformed_config"],
    });
    expect(
      parseVoiceRuntimePolicyConfig({
        ...validConfig(),
        push_to_talk_enabled: false,
      }),
    ).toMatchObject({
      ok: false,
      denial_reasons: expect.arrayContaining(["missing_push_to_talk"]),
    });
    expect(
      parseVoiceRuntimePolicyConfig({
        ...validConfig(),
        max_capture_ms: 60_000,
        max_voice_session_ms: 30_000,
      }),
    ).toMatchObject({
      ok: false,
      denial_reasons: expect.arrayContaining(["invalid_limit"]),
    });
    expect(() =>
      assertVoiceRuntimePolicyConfig({
        ...validConfig(),
        wake_word_enabled: true,
      }),
    ).toThrow(/wake_word_forbidden/);
  });

  it("accepts explicit local-only config without enabling runtime execution", () => {
    const result = parseVoiceRuntimePolicyConfig(
      validConfig({
        local_stt_enabled: true,
        local_tts_enabled: true,
        max_playback_queue_depth: 2,
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      config: {
        local_stt_enabled: true,
        local_tts_enabled: true,
        cloud_stt_enabled: false,
        cloud_tts_enabled: false,
        playback_autostart_enabled: false,
      },
      denial_reasons: [],
    });
  });

  it("exports feature flags with only local STT/TTS enabled by default", () => {
    expect(VOICE_RUNTIME_FEATURE_FLAG_KEYS).toEqual([
      "local_stt",
      "local_tts",
      "cloud_stt",
      "cloud_tts",
      "playback",
      "barge_in",
      "realtime_streaming",
      "voice_runtime_integration",
    ]);
    expect(createDefaultVoiceRuntimeFeatureFlags()).toEqual({
      local_stt: true,
      local_tts: true,
      cloud_stt: false,
      cloud_tts: false,
      playback: false,
      barge_in: false,
      realtime_streaming: false,
      voice_runtime_integration: false,
    });
    expect(
      validateVoiceRuntimeFeatureFlags(DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS),
    ).toMatchObject({
      ok: true,
      denial_reasons: [],
    });
  });

  it("rejects cloud, playback, realtime, and runtime integration feature flags", () => {
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
          ...DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
          [key]: true,
        }),
      ).toMatchObject({
        ok: false,
        flags: null,
      });
    }
  });

  it("keeps config and feature flag source free of runtime, capture, playback, cloud, persistence, and UI wiring", () => {
    const source = [
      "src/lib/voice-runtime/config.ts",
      "src/lib/voice-runtime/feature-flags.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.|microphone.*start/i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|autoplay.*true|play\(/i,
    );
    expect(source).not.toMatch(/tauri|invoke\(|global-hotkey|globalShortcut/i);
    expect(source).not.toMatch(
      /ffmpeg|whisper|piper|faster-whisper|spawn\(|exec\(/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /appendEvent|appendFile|writeFile|event-store|telemetryStore|persistTelemetry/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|router\.|scheduler|setInterval|while\s*\(\s*true\s*\)/i,
    );
  });
});
