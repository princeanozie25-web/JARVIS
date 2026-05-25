import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VOICE_CAPTURE_STATES,
  VOICE_PLAYBACK_STATES,
  isVoiceTelemetryMetadataOnlyEvent,
  type VoiceCancellationToken,
  type VoiceSession,
  type VoiceSttProvider,
  type VoiceSttTranscribeRequest,
  type VoiceTelemetryEvent,
  type VoiceTtsProvider,
  type VoiceTtsSynthesizeRequest,
} from "../../src/lib/voice-runtime";

function cancellationToken(): VoiceCancellationToken {
  return {
    cancellation_id: "cancel-1",
    session_id: "voice-session-1",
    reason: "user_cancelled",
    requested_at_ms: 10,
    metadata_only: true,
  };
}

function sttRequest(): VoiceSttTranscribeRequest {
  return {
    request_id: "stt-request-1",
    provider_id: "stt-provider-1",
    audio: {
      buffer_id: "buffer-1",
      duration_ms: 1200,
      sample_rate_hz: 16000,
      channel_count: 1,
      byte_length: 32000,
      mime_type: "audio/wav",
      metadata_only: true,
    },
    timeout_ms: 5_000,
    provenance: {
      session_id: "voice-session-1",
      turn_id: "turn-1",
      requested_at_ms: 20,
      source: "voice_runtime_contract",
      metadata_only: true,
    },
    metadata_only: true,
  };
}

function ttsRequest(): VoiceTtsSynthesizeRequest {
  return {
    request_id: "tts-request-1",
    provider_id: "tts-provider-1",
    text_metadata: {
      text_id: "text-1",
      character_count: 42,
      language: "en",
      metadata_only: true,
    },
    timeout_ms: 5_000,
    provenance: {
      session_id: "voice-session-1",
      turn_id: "turn-1",
      requested_at_ms: 30,
      source: "voice_runtime_contract",
      metadata_only: true,
    },
    metadata_only: true,
  };
}

describe("Phase 14A.1 voice runtime contracts", () => {
  it("defines the capture and playback lifecycle states", () => {
    expect(VOICE_CAPTURE_STATES).toEqual([
      "idle",
      "arming",
      "capturing",
      "endpoint_detected",
      "transcribing",
      "cancelled",
      "failed",
    ]);
    expect(VOICE_PLAYBACK_STATES).toEqual([
      "idle",
      "queueing",
      "synthesizing",
      "playing",
      "interrupted",
      "completed",
      "failed",
    ]);
  });

  it("supports metadata-only voice session and cancellation structures", () => {
    const session: VoiceSession = {
      session_id: "voice-session-1",
      created_at_ms: 1,
      updated_at_ms: 2,
      capture_state: "idle",
      playback_state: "idle",
      turns: [
        {
          turn_id: "turn-1",
          session_id: "voice-session-1",
          started_at_ms: 1,
          ended_at_ms: 2,
          capture_state: "cancelled",
          playback_state: "interrupted",
          cancellation: cancellationToken(),
          degraded: false,
          metadata_only: true,
        },
      ],
      cancellation: cancellationToken(),
      config: {
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
      },
      degraded: false,
      metadata_only: true,
    };

    expect(session).toMatchObject({
      session_id: "voice-session-1",
      capture_state: "idle",
      playback_state: "idle",
      metadata_only: true,
      config: {
        push_to_talk_only: true,
        wake_word_enabled: false,
        always_listening_enabled: false,
        voice_approval_authority: false,
      },
    });
  });

  it("keeps STT provider contract structural and metadata-only at the audio boundary", async () => {
    let cancelCalled = false;
    const provider: VoiceSttProvider = {
      id: "stt-provider-1",
      kind: "stt",
      metadata_only: true,
      transcribe: async (request) => ({
        request_id: request.request_id,
        provider_id: request.provider_id,
        transcript: "contract transcript result",
        language: "en",
        latency_ms: 17,
        degraded: false,
        metadata_only: true,
      }),
      cancel: async () => {
        cancelCalled = true;
      },
      health: async () => ({
        provider_id: "stt-provider-1",
        provider_kind: "stt",
        ok: true,
        checked_at_ms: 100,
        degraded: false,
        metadata_only: true,
      }),
    };

    await expect(provider.transcribe(sttRequest())).resolves.toMatchObject({
      request_id: "stt-request-1",
      provider_id: "stt-provider-1",
      transcript: "contract transcript result",
      language: "en",
      latency_ms: 17,
      degraded: false,
      metadata_only: true,
    });
    await provider.cancel(cancellationToken());
    await expect(provider.health()).resolves.toMatchObject({
      provider_kind: "stt",
      metadata_only: true,
    });
    expect(cancelCalled).toBe(true);
    expect(JSON.stringify(sttRequest().audio)).not.toContain("bytes:");
  });

  it("keeps TTS provider contract structural and metadata-only at the audio chunk boundary", async () => {
    let cancelCalled = false;
    const provider: VoiceTtsProvider = {
      id: "tts-provider-1",
      kind: "tts",
      metadata_only: true,
      synthesize: async (request) => ({
        request_id: request.request_id,
        provider_id: request.provider_id,
        audio: {
          chunk_id: "chunk-1",
          duration_ms: 900,
          sequence_index: 0,
          mime_type: "audio/wav",
          metadata_only: true,
        },
        duration_ms: 900,
        chunk_id: "chunk-1",
        degraded: false,
        metadata_only: true,
      }),
      cancel: async () => {
        cancelCalled = true;
      },
      health: async () => ({
        provider_id: "tts-provider-1",
        provider_kind: "tts",
        ok: true,
        checked_at_ms: 100,
        degraded: false,
        metadata_only: true,
      }),
    };

    await expect(provider.synthesize(ttsRequest())).resolves.toMatchObject({
      request_id: "tts-request-1",
      provider_id: "tts-provider-1",
      audio: {
        chunk_id: "chunk-1",
        duration_ms: 900,
        metadata_only: true,
      },
      duration_ms: 900,
      degraded: false,
      metadata_only: true,
    });
    await provider.cancel(cancellationToken());
    await expect(provider.health()).resolves.toMatchObject({
      provider_kind: "tts",
      metadata_only: true,
    });
    expect(cancelCalled).toBe(true);
    expect(Object.keys(ttsRequest().text_metadata)).not.toContain("text");
  });

  it("accepts metadata-only telemetry and rejects transcript or raw-audio fields", () => {
    const event: VoiceTelemetryEvent = {
      session_id: "voice-session-1",
      duration_ms: 1000,
      latency_ms: 50,
      provider_id: "stt-provider-1",
      provider_kind: "stt",
      degraded: false,
      cancellation_reason: "user_cancelled",
      capture_state: "cancelled",
      playback_state: "interrupted",
      metadata_only: true,
    };

    expect(isVoiceTelemetryMetadataOnlyEvent(event)).toBe(true);
    expect(
      isVoiceTelemetryMetadataOnlyEvent({
        ...event,
        transcript: "forbidden transcript",
      }),
    ).toBe(false);
    expect(
      isVoiceTelemetryMetadataOnlyEvent({
        ...event,
        raw_audio: "forbidden audio",
      }),
    ).toBe(false);
  });

  it("does not introduce runtime, mic, playback, Tauri, network, persistence, or provider execution wiring", () => {
    const source = [
      "src/lib/voice-runtime/types.ts",
      "src/lib/voice-runtime/contracts.ts",
      "src/lib/voice-runtime/telemetry.ts",
      "src/lib/voice-runtime/index.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|AudioContext|MediaRecorder|microphone|navigator\./i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|autoplay|play\(/i,
    );
    expect(source).not.toMatch(/tauri|invoke\(|global-hotkey|globalShortcut/i);
    expect(source).not.toMatch(/ffmpeg|whisper|piper|spawn\(|exec\(/i);
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
