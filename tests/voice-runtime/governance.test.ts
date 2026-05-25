import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_VOICE_RUNTIME_CONFIG,
  VOICE_RUNTIME_GOVERNANCE_INVARIANTS,
  VOICE_TELEMETRY_ALLOWED_FIELDS,
  VOICE_TELEMETRY_FORBIDDEN_FIELDS,
  createDefaultVoiceRuntimeConfig,
  getVoiceRuntimeGovernanceInvariants,
  isGovernedVoiceRuntimeConfig,
} from "../../src/lib/voice-runtime";

describe("Phase 14A.1 voice runtime governance scaffolding", () => {
  it("exports fail-closed voice governance invariants", () => {
    expect(VOICE_RUNTIME_GOVERNANCE_INVARIANTS).toEqual({
      push_to_talk_only: true,
      wake_word_enabled: false,
      always_listening_enabled: false,
      voice_approval_authority: false,
      background_recording_enabled: false,
      transcript_telemetry_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
      hidden_mic_activation_enabled: false,
      voice_transport_only: true,
      bypass_approval_layers: false,
      bypass_runtime_router: false,
      bypass_safety_layers: false,
    });
    expect(getVoiceRuntimeGovernanceInvariants()).toEqual(
      VOICE_RUNTIME_GOVERNANCE_INVARIANTS,
    );
  });

  it("exports a governed default runtime config with no wake word or always-listening mode", () => {
    expect(DEFAULT_VOICE_RUNTIME_CONFIG).toEqual({
      push_to_talk_only: true,
      wake_word_enabled: false,
      always_listening_enabled: false,
      background_recording_enabled: false,
      hidden_mic_activation_enabled: false,
      voice_approval_authority: false,
      transcript_telemetry_persistence_enabled: false,
      raw_audio_persistence_enabled: false,
      bypass_approval_layers: false,
      bypass_runtime_router: false,
      bypass_safety_layers: false,
    });
    expect(createDefaultVoiceRuntimeConfig()).toEqual(
      DEFAULT_VOICE_RUNTIME_CONFIG,
    );
    expect(Object.keys(DEFAULT_VOICE_RUNTIME_CONFIG)).not.toContain(
      "wake_word_config",
    );
    expect(Object.keys(DEFAULT_VOICE_RUNTIME_CONFIG)).not.toContain(
      "always_listening_config",
    );
    expect(
      isGovernedVoiceRuntimeConfig(createDefaultVoiceRuntimeConfig()),
    ).toBe(true);
  });

  it("rejects configs that enable forbidden voice authority or capture modes", () => {
    expect(
      isGovernedVoiceRuntimeConfig({
        ...DEFAULT_VOICE_RUNTIME_CONFIG,
        wake_word_enabled: true,
      }),
    ).toBe(false);
    expect(
      isGovernedVoiceRuntimeConfig({
        ...DEFAULT_VOICE_RUNTIME_CONFIG,
        always_listening_enabled: true,
      }),
    ).toBe(false);
    expect(
      isGovernedVoiceRuntimeConfig({
        ...DEFAULT_VOICE_RUNTIME_CONFIG,
        voice_approval_authority: true,
      }),
    ).toBe(false);
    expect(
      isGovernedVoiceRuntimeConfig({
        ...DEFAULT_VOICE_RUNTIME_CONFIG,
        raw_audio_persistence_enabled: true,
      }),
    ).toBe(false);
  });

  it("keeps telemetry allowlist metadata-only and excludes transcript/raw audio fields", () => {
    expect(VOICE_TELEMETRY_ALLOWED_FIELDS).toEqual([
      "session_id",
      "duration_ms",
      "latency_ms",
      "provider_id",
      "provider_kind",
      "degraded",
      "cancellation_reason",
      "capture_state",
      "playback_state",
      "metadata_only",
    ]);
    expect(VOICE_TELEMETRY_ALLOWED_FIELDS).not.toContain("transcript");
    expect(VOICE_TELEMETRY_ALLOWED_FIELDS).not.toContain("raw_audio");
    expect(VOICE_TELEMETRY_ALLOWED_FIELDS).not.toContain("waveform_bytes");
    expect(VOICE_TELEMETRY_FORBIDDEN_FIELDS).toEqual(
      expect.arrayContaining([
        "raw_audio",
        "waveform_bytes",
        "transcript",
        "speaker_embeddings",
        "biometric_identifiers",
      ]),
    );
  });

  it("keeps governance source free of execution, persistence, UI, Tauri, cloud, and audio APIs", () => {
    const source = [
      "src/lib/voice-runtime/governance.ts",
      "src/lib/voice-runtime/telemetry.ts",
      "src/lib/voice-runtime/contracts.ts",
      "src/lib/voice-runtime/types.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|microphone|wakeWord|wake_word_config|always_listening_config/i,
    );
    expect(source).not.toMatch(
      /router\.|approval\.approve|bypass.*true|voice.*approve.*true/i,
    );
    expect(source).not.toMatch(
      /appendEvent|writeFile|appendFile|event-store|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(/tauri|invoke\(|global-hotkey|globalShortcut/i);
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(/ffmpeg|whisper|piper|spawn\(|exec\(/i);
    expect(source).not.toMatch(/setInterval|scheduler|autoplay|play\(/i);
  });
});
