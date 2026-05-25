import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
  canSpeakSensitiveContent,
  canStartCapture,
  canStartPlayback,
  canUseCloudSTT,
  canUseCloudTTS,
  type VoiceRuntimeFeatureFlags,
  type VoiceRuntimePolicyConfig,
} from "../../src/lib/voice-runtime";

function config(
  overrides: Partial<VoiceRuntimePolicyConfig> = {},
): VoiceRuntimePolicyConfig {
  return {
    ...DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
    push_to_talk_enabled: true,
    local_stt_enabled: true,
    local_tts_enabled: true,
    max_voice_session_ms: 30_000,
    max_capture_ms: 5_000,
    max_playback_queue_depth: 2,
    ...overrides,
  };
}

function flags(
  overrides: Partial<VoiceRuntimeFeatureFlags> = {},
): VoiceRuntimeFeatureFlags {
  return {
    ...DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
    ...overrides,
  };
}

describe("Phase 14A.2 voice runtime policy", () => {
  it("denies capture by default and allows only explicit local push-to-talk capture", () => {
    expect(
      canStartCapture({
        config: DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
        feature_flags: DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
        requested_duration_ms: 1000,
      }),
    ).toEqual({
      allowed: false,
      reason: "local_stt_disabled",
      metadata_only: true,
    });
    expect(
      canStartCapture({
        config: config(),
        feature_flags: flags(),
        requested_duration_ms: 1000,
      }),
    ).toEqual({
      allowed: true,
      reason: null,
      metadata_only: true,
    });
    expect(
      canStartCapture({
        config: config({ push_to_talk_enabled: false }),
        feature_flags: flags(),
        requested_duration_ms: 1000,
      }),
    ).toEqual({
      allowed: false,
      reason: "push_to_talk_required",
      metadata_only: true,
    });
  });

  it("denies capture beyond configured limits", () => {
    expect(
      canStartCapture({
        config: config({ max_capture_ms: 500 }),
        feature_flags: flags(),
        requested_duration_ms: 1000,
      }),
    ).toEqual({
      allowed: false,
      reason: "capture_limit_exhausted",
      metadata_only: true,
    });
  });

  it("denies playback by default and denies autoplay even when playback flag is enabled", () => {
    expect(
      canStartPlayback({
        config: config(),
        feature_flags: flags(),
        queue_depth: 0,
      }),
    ).toEqual({
      allowed: false,
      reason: "playback_disabled",
      metadata_only: true,
    });
    expect(
      canStartPlayback({
        config: config(),
        feature_flags: flags({ playback: true }),
        queue_depth: 0,
        autostart_requested: true,
      }),
    ).toEqual({
      allowed: false,
      reason: "playback_autostart_disabled",
      metadata_only: true,
    });
  });

  it("denies cloud STT and TTS under fail-closed defaults", () => {
    expect(
      canUseCloudSTT({
        config: config(),
        feature_flags: flags(),
      }),
    ).toEqual({
      allowed: false,
      reason: "cloud_stt_disabled",
      metadata_only: true,
    });
    expect(
      canUseCloudTTS({
        config: config(),
        feature_flags: flags(),
      }),
    ).toEqual({
      allowed: false,
      reason: "cloud_tts_disabled",
      metadata_only: true,
    });
  });

  it("allows assistant prose and denies sensitive content categories", () => {
    expect(
      canSpeakSensitiveContent({
        config: config(),
        feature_flags: flags(),
        content_kind: "assistant_prose",
      }),
    ).toEqual({
      allowed: true,
      reason: null,
      metadata_only: true,
    });

    for (const [contentKind, reason] of [
      ["tool_output", "tool_output_blocked"],
      ["code_block", "code_block_blocked"],
      ["approval_prompt", "approval_prompt_blocked"],
      ["personal_context", "personal_context_blocked"],
      ["raw_file_content", "raw_file_content_blocked"],
    ] as const) {
      expect(
        canSpeakSensitiveContent({
          config: config(),
          feature_flags: flags(),
          content_kind: contentKind,
        }),
      ).toEqual({
        allowed: false,
        reason,
        metadata_only: true,
      });
    }
  });

  it("does not allow sensitive content even if a malformed future override tries to opt in", () => {
    expect(
      canSpeakSensitiveContent({
        config: config({ allow_tts_for_sensitive_content: true }),
        feature_flags: flags(),
        content_kind: "approval_prompt",
      }),
    ).toEqual({
      allowed: false,
      reason: "sensitive_content_blocked",
      metadata_only: true,
    });
  });

  it("keeps policy source free of execution, mic, playback, cloud, persistence, UI, and scheduler wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-runtime/policy.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.|microphone/i,
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
