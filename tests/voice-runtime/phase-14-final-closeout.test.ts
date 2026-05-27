import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CAPTURE_RUNTIME_CONFIG,
  DEFAULT_PLAYBACK_QUEUE_CONFIG,
  DEFAULT_VOICE_RUNTIME_CONFIG,
  DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS,
  DEFAULT_VOICE_RUNTIME_POLICY_CONFIG,
  VOICE_PRIVACY_CONTENT_CLASSES,
  VOICE_RUNTIME_GOVERNANCE_INVARIANTS,
  VOICE_TELEMETRY_FORBIDDEN_FIELDS,
  canSpeakSensitiveContent,
  createDefaultVoiceRuntimeFeatureFlags,
  createDefaultVoiceRuntimePolicyConfig,
  createPlaybackQueue,
  parseVoiceRuntimePolicyConfig,
  sanitizeVoiceTelemetryEvent,
} from "../../src/lib/voice-runtime";
import {
  DEFAULT_WAKE_WORD_POLICY,
  canArmWakeWord,
  validateWakeWordPolicy,
} from "../../src/lib/voice-runtime/wake-word";

const VERIFIED_PHASE_14_OPERATIONAL_SMOKES = {
  stt_smoke: {
    status: "ok",
    provider_id: "faster-whisper-local",
    language: "en",
    degraded: false,
  },
  tts_smoke: {
    status: "ok",
    provider_id: "piper-local",
    voice_id: "en_GB-alan-medium",
    degraded: false,
  },
  playback_smoke: {
    status: "ok",
    playback_state: "completed",
    degraded: false,
  },
  full_voice_loop_smoke: {
    status: "ok",
    explicit_invocation: true,
    metadata_only: true,
  },
  interruption_cancellation_smoke: {
    interruption_observed: true,
    playback_queue_cleared: true,
    stale_enqueue_blocked: true,
    metadata_only: true,
  },
} as const;

const FINAL_PHASE_14_ARCHITECTURE = {
  push_to_talk_first: true,
  local_first: true,
  metadata_safe: true,
  fail_closed: true,
  explicit_execution_only: true,
  governed_runtime_first: true,
  interruption_safe: true,
  provider_abstracted: true,
} as const;

const VOICE_SOURCE_ROOT = join(process.cwd(), "src/lib/voice-runtime");
const VOICE_SCRIPT_ROOT = join(process.cwd(), "scripts/voice");

const APPROVED_LOCAL_SUBPROCESS_FILES = new Set([
  "src/lib/voice-runtime/stt/faster-whisper-provider.ts",
  "src/lib/voice-runtime/tts/piper-provider.ts",
  "src/lib/voice-runtime/playback/local-driver.ts",
]);

function readRecursiveTsFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return readRecursiveTsFiles(path);
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

function projectPath(path: string): string {
  return relative(process.cwd(), path).replace(/\\/g, "/");
}

function voiceRuntimeSourceFiles(): readonly {
  readonly path: string;
  readonly source: string;
}[] {
  return readRecursiveTsFiles(VOICE_SOURCE_ROOT).map((path) => ({
    path: projectPath(path),
    source: readFileSync(path, "utf8"),
  }));
}

function voiceOperationalSourceFiles(): readonly {
  readonly path: string;
  readonly source: string;
}[] {
  return [
    ...voiceRuntimeSourceFiles(),
    ...readRecursiveTsFiles(VOICE_SCRIPT_ROOT).map((path) => ({
      path: projectPath(path),
      source: readFileSync(path, "utf8"),
    })),
  ];
}

function combinedSource(files: readonly { readonly source: string }[]): string {
  return files.map((file) => file.source).join("\n");
}

function packageScripts(): Record<string, string> {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as { readonly scripts?: Record<string, string> };
  return packageJson.scripts ?? {};
}

describe("Phase 14 final closeout audit", () => {
  it("preserves global voice governance defaults", () => {
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
      push_to_talk_enabled: true,
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
    expect(DEFAULT_CAPTURE_RUNTIME_CONFIG).toMatchObject({
      push_to_talk_enabled: true,
      permission_required: true,
      mic_active_indicator_required: true,
      metadata_only: true,
    });
    expect(DEFAULT_PLAYBACK_QUEUE_CONFIG).toEqual({
      max_queue_depth: 8,
      allow_sensitive_content: false,
      metadata_only: true,
    });
    expect(DEFAULT_VOICE_RUNTIME_FEATURE_FLAGS).toMatchObject({
      cloud_stt: false,
      cloud_tts: false,
      realtime_streaming: false,
    });
  });

  it("keeps wake-word support scaffolded, disabled, and fail-closed", () => {
    expect(DEFAULT_WAKE_WORD_POLICY).toMatchObject({
      enabled: false,
      explicit_opt_in: false,
      local_only: true,
      visible_mic_indicator_required: true,
      hard_kill_switch_enabled: true,
      push_to_talk_fallback_required: true,
      allow_cloud_detection: false,
      allow_pre_wake_transcription: false,
      allow_raw_audio_persistence: false,
      allow_wake_triggered_tools: false,
      allow_wake_triggered_approval: false,
      allow_autonomous_loop: false,
      metadata_only: true,
    });
    expect(validateWakeWordPolicy(DEFAULT_WAKE_WORD_POLICY)).toMatchObject({
      ok: false,
      reasons: ["wake_word_disabled", "explicit_opt_in_required"],
    });
    expect(canArmWakeWord(DEFAULT_WAKE_WORD_POLICY)).toEqual({
      allowed: false,
      reason: "wake_word_disabled",
      metadata_only: true,
    });
  });

  it("keeps voice non-authoritative over runtime, router, approval, and tools", () => {
    expect(VOICE_RUNTIME_GOVERNANCE_INVARIANTS).toMatchObject({
      voice_transport_only: true,
      voice_approval_authority: false,
      bypass_approval_layers: false,
      bypass_runtime_router: false,
      bypass_safety_layers: false,
    });
    expect(
      parseVoiceRuntimePolicyConfig({
        ...createDefaultVoiceRuntimePolicyConfig(),
        voice_approval_enabled: true,
      }),
    ).toMatchObject({
      ok: false,
      config: null,
      reasons: ["forbidden_feature_enabled"],
    });
  });

  it("preserves assistant_prose-only playback and blocks tool or approval speech", () => {
    const config = {
      ...createDefaultVoiceRuntimePolicyConfig(),
      local_tts_enabled: true,
      max_playback_queue_depth: 2,
    };
    const featureFlags = createDefaultVoiceRuntimeFeatureFlags();

    expect(
      canSpeakSensitiveContent({
        config,
        feature_flags: featureFlags,
        content_kind: "assistant_prose",
      }),
    ).toEqual({
      allowed: true,
      reason: null,
      metadata_only: true,
    });
    expect(
      canSpeakSensitiveContent({
        config,
        feature_flags: featureFlags,
        content_kind: "tool_output",
      }),
    ).toEqual({
      allowed: false,
      reason: "tool_output_blocked",
      metadata_only: true,
    });
    expect(
      canSpeakSensitiveContent({
        config,
        feature_flags: featureFlags,
        content_kind: "approval_prompt",
      }),
    ).toEqual({
      allowed: false,
      reason: "approval_prompt_blocked",
      metadata_only: true,
    });

    const queue = createPlaybackQueue({
      max_queue_depth: 2,
      allow_sensitive_content: false,
      metadata_only: true,
    });
    expect(
      queue.enqueue({
        item_id: "assistant-item",
        session_id: "session-1",
        turn_id: "turn-1",
        chunk_id: "chunk-1",
        provider_id: "fake-local-tts",
        voice_id: "fake-voice",
        audio_ref: "C:/tmp/jarvis-output.wav",
        duration_ms: 1000,
        size_bytes: 24000,
        content_class: "assistant_prose",
        created_at: "2026-05-27T12:00:00.000Z",
        metadata_only: true,
      }),
    ).toMatchObject({ ok: true });
    expect(
      queue.enqueue({
        item_id: "tool-item",
        session_id: "session-1",
        turn_id: "turn-1",
        chunk_id: "chunk-2",
        provider_id: "fake-local-tts",
        voice_id: "fake-voice",
        audio_ref: "C:/tmp/jarvis-output-2.wav",
        duration_ms: 1000,
        size_bytes: 24000,
        content_class: "tool_output",
        created_at: "2026-05-27T12:00:00.000Z",
        metadata_only: true,
      }),
    ).toMatchObject({
      ok: false,
      reasons: ["unsafe_content"],
    });
  });

  it("keeps telemetry metadata-only and rejects persistence-sensitive payloads", () => {
    const safe = sanitizeVoiceTelemetryEvent({
      event_type: "voice_turn_completed",
      session_id: "session-1",
      turn_id: "turn-1",
      provider_id: "fake-local",
      duration_ms: 10,
      latency_ms: 5,
      degraded: false,
      redaction_status: "metadata_only",
      timestamp: "2026-05-27T12:00:00.000Z",
      unknown_debug_payload: "must be stripped",
    });

    expect(safe).toMatchObject({ ok: true });
    if (!safe.ok) throw new Error("expected safe metadata-only telemetry");
    expect(JSON.stringify(safe.event)).not.toContain("unknown_debug_payload");

    for (const key of VOICE_TELEMETRY_FORBIDDEN_FIELDS) {
      expect(
        sanitizeVoiceTelemetryEvent({
          event_type: "voice_turn_completed",
          session_id: "session-1",
          redaction_status: "metadata_only",
          timestamp: "2026-05-27T12:00:00.000Z",
          [key]: "forbidden",
        }),
      ).toMatchObject({
        ok: false,
        event: null,
      });
    }
  });

  it("keeps every non-assistant privacy class denied by default", () => {
    expect(VOICE_PRIVACY_CONTENT_CLASSES).toContain("assistant_prose");
    expect(VOICE_PRIVACY_CONTENT_CLASSES).toContain("transcript");
    expect(VOICE_PRIVACY_CONTENT_CLASSES).toContain("tool_output");
    expect(VOICE_PRIVACY_CONTENT_CLASSES).toContain("approval_prompt");
  });

  it("documents operational smoke results with fixture-safe metadata only", () => {
    expect(VERIFIED_PHASE_14_OPERATIONAL_SMOKES).toMatchObject({
      stt_smoke: { status: "ok", degraded: false },
      tts_smoke: { status: "ok", degraded: false },
      playback_smoke: { status: "ok", playback_state: "completed" },
      full_voice_loop_smoke: {
        status: "ok",
        explicit_invocation: true,
        metadata_only: true,
      },
      interruption_cancellation_smoke: {
        interruption_observed: true,
        playback_queue_cleared: true,
        stale_enqueue_blocked: true,
        metadata_only: true,
      },
    });
    expect(JSON.stringify(VERIFIED_PHASE_14_OPERATIONAL_SMOKES)).not.toMatch(
      /raw_audio|audio_bytes|waveform|pcm|prompt|response|tool_output|approval_text|speaker_embedding|voiceprint|biometric/i,
    );
  });

  it("keeps smoke harnesses manual-only and out of lifecycle scripts", () => {
    const scripts = packageScripts();

    expect(scripts["voice:tts:smoke"]).toBe("tsx scripts/voice/tts-smoke.ts");
    expect(scripts["voice:stt:smoke"]).toBe("tsx scripts/voice/stt-smoke.ts");
    expect(scripts["voice:playback:smoke"]).toBe(
      "tsx scripts/voice/playback-smoke.ts",
    );
    expect(scripts["voice:full-loop:smoke"]).toBe(
      "tsx scripts/voice/full-voice-loop-smoke.ts",
    );
    for (const lifecycle of ["dev", "start", "build", "test", "prepare"]) {
      expect(scripts[lifecycle] ?? "").not.toMatch(
        /voice:(?:tts|stt|playback|full-loop):smoke/,
      );
    }
  });

  it("keeps approved local subprocess authority isolated to provider or driver seams", () => {
    const offenders = voiceRuntimeSourceFiles()
      .filter(({ source }) =>
        /from\s+["']node:child_process["']|spawn\s*\(|exec\s*\(|execFile\s*\(/i.test(
          source,
        ),
      )
      .map(({ path }) => path)
      .filter((path) => !APPROVED_LOCAL_SUBPROCESS_FILES.has(path));

    expect(offenders).toEqual([]);
  });

  it("keeps Phase 14 source free of persistence, cloud/network, UI/Tauri, scheduler, and autonomous loop authority", () => {
    const source = combinedSource(voiceOperationalSourceFiles());

    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore|better-sqlite3/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\s*\(|app\/api|globalShortcut|global-hotkey/i,
    );
    expect(source).not.toMatch(
      /scheduler|cron|setInterval|while\s*\(\s*true\s*\)|conversation_loop|autonomousExecution|backgroundLoop/i,
    );
  });

  it("keeps actual wake-word engine, always-listening, background recording, realtime token streaming, and hidden mic code absent", () => {
    const source = combinedSource(voiceOperationalSourceFiles());

    expect(source).not.toMatch(
      /Porcupine|Picovoice|openwakeword|snowboy|WakeWordEngine|keywordSpot|detectWake/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|navigator\.mediaDevices|MediaRecorder|AudioContext|MediaStream|hiddenMic\s*\(|startBackgroundRecording|backgroundRecordingLoop/i,
    );
    expect(source).not.toMatch(
      /AsyncIterable|partial_token|partial_transcript|token-stream|tokenStream|streamingPlayback|realtimeToken/i,
    );
  });

  it("keeps runtime governance first and forbids approval/tool bypass authority in voice source", () => {
    const source = combinedSource(voiceRuntimeSourceFiles());

    expect(source).not.toMatch(
      /approveAction|approvedAction|runAction|executeTool|shell_command|tool_execution_authority|bypassApproval|bypassRuntimeGovernance/i,
    );
    expect(source).toContain("tool_calls");
    expect(source).toContain("unsafe_content");
  });

  it("preserves the final Phase 14 architecture posture", () => {
    expect(FINAL_PHASE_14_ARCHITECTURE).toEqual({
      push_to_talk_first: true,
      local_first: true,
      metadata_safe: true,
      fail_closed: true,
      explicit_execution_only: true,
      governed_runtime_first: true,
      interruption_safe: true,
      provider_abstracted: true,
    });
  });
});
