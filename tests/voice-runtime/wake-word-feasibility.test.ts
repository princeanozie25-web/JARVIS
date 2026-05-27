import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  WAKE_WORD_GOVERNANCE_REQUIREMENTS,
  WAKE_WORD_INVARIANTS,
  WAKE_WORD_MODES,
  evaluateWakeWordFeasibility,
  explainWakeWordConstraints,
  validateWakeWordGovernance,
  type WakeWordActivationPolicy,
} from "../../src/lib/voice-runtime/wake-word-feasibility";

function wakeWordSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/voice-runtime/wake-word-feasibility.ts"),
    "utf8",
  );
}

function feasiblePolicy(
  overrides: Partial<Record<keyof WakeWordActivationPolicy, unknown>> = {},
): WakeWordActivationPolicy {
  return {
    mode: "future_optional_local_only",
    visible_mic_active_indicator: true,
    explicit_user_opt_in: true,
    local_only_wake_detection: true,
    pre_wake_transcript_persistence: false,
    raw_audio_persistence: false,
    cloud_wake_processing: false,
    hard_kill_switch: true,
    push_to_talk_fallback: true,
    explicit_wake_session_boundaries: true,
    bounded_activation_timeout_ms: 5000,
    hidden_background_capture_state: false,
    silent_background_transcription: false,
    hidden_mic_state: false,
    automatic_approval_execution: false,
    cloud_wake_routing: false,
    wake_triggered_autonomous_loops: false,
    wake_triggered_tool_execution: false,
    always_listening_without_visible_state: false,
    voice_transport_only: true,
    runtime_governance_remains_authoritative: true,
    approval_layers_remain_authoritative: true,
    safety_layers_remain_authoritative: true,
    metadata_only: true,
    ...overrides,
  } as WakeWordActivationPolicy;
}

describe("Phase 14H.2 wake-word feasibility and invariant reconciliation", () => {
  it("exports stable feasibility modes, invariants, and governance requirements", () => {
    expect(WAKE_WORD_MODES).toEqual(["disabled", "future_optional_local_only"]);
    expect(WAKE_WORD_INVARIANTS).toEqual([
      "visible_mic_active_indicator",
      "explicit_user_opt_in",
      "local_only_wake_detection",
      "no_pre_wake_transcript_persistence",
      "no_raw_audio_persistence",
      "no_cloud_wake_processing",
      "hard_kill_switch",
      "push_to_talk_fallback",
      "explicit_wake_session_boundaries",
      "bounded_activation_timeout",
      "no_hidden_background_capture_state",
      "no_silent_background_transcription",
      "no_hidden_mic_state",
      "no_automatic_approval_execution",
      "no_cloud_wake_routing",
      "no_wake_triggered_autonomous_loops",
      "no_wake_triggered_tool_execution",
      "no_always_listening_without_visible_state",
      "metadata_only_feasibility_output",
    ]);
    expect(WAKE_WORD_GOVERNANCE_REQUIREMENTS).toEqual([
      "voice_transport_only",
      "runtime_governance_remains_authoritative",
      "approval_layers_remain_authoritative",
      "safety_layers_remain_authoritative",
      "metadata_only_feasibility_output",
    ]);
  });

  it("passes feasibility only when every future wake-word invariant is satisfied", () => {
    expect(evaluateWakeWordFeasibility(feasiblePolicy())).toEqual({
      ok: true,
      feasible: true,
      mode: "future_optional_local_only",
      missing_invariants: [],
      violated_invariants: [],
      governance_requirements: [...WAKE_WORD_GOVERNANCE_REQUIREMENTS],
      explanation: explainWakeWordConstraints("future_optional_local_only"),
      metadata_only: true,
    });
  });

  it("fails closed when required invariants are missing", () => {
    expect(
      evaluateWakeWordFeasibility(
        feasiblePolicy({
          visible_mic_active_indicator: false,
          explicit_user_opt_in: false,
          hard_kill_switch: false,
          push_to_talk_fallback: false,
        }),
      ),
    ).toMatchObject({
      ok: false,
      feasible: false,
      missing_invariants: [
        "visible_mic_active_indicator",
        "explicit_user_opt_in",
        "hard_kill_switch",
        "push_to_talk_fallback",
      ],
      metadata_only: true,
    });
  });

  it("rejects hidden mic states, background capture, silent transcription, and unbounded activation", () => {
    expect(
      validateWakeWordGovernance(
        feasiblePolicy({
          hidden_mic_state: true,
          hidden_background_capture_state: true,
          silent_background_transcription: true,
          bounded_activation_timeout_ms: 60_000,
        }),
      ),
    ).toMatchObject({
      ok: false,
      missing_invariants: ["bounded_activation_timeout"],
      violated_invariants: [
        "no_hidden_background_capture_state",
        "no_silent_background_transcription",
        "no_hidden_mic_state",
      ],
    });
  });

  it("rejects cloud wake routing and cloud wake processing", () => {
    expect(
      evaluateWakeWordFeasibility(
        feasiblePolicy({
          cloud_wake_processing: true,
          cloud_wake_routing: true,
        }),
      ),
    ).toMatchObject({
      ok: false,
      violated_invariants: [
        "no_cloud_wake_processing",
        "no_cloud_wake_routing",
      ],
    });
  });

  it("rejects wake-triggered autonomy, tool execution, and approval execution", () => {
    expect(
      validateWakeWordGovernance(
        feasiblePolicy({
          automatic_approval_execution: true,
          wake_triggered_autonomous_loops: true,
          wake_triggered_tool_execution: true,
          runtime_governance_remains_authoritative: false,
        }),
      ),
    ).toMatchObject({
      ok: false,
      violated_invariants: [
        "no_automatic_approval_execution",
        "no_wake_triggered_autonomous_loops",
        "no_wake_triggered_tool_execution",
      ],
    });
  });

  it("requires push-to-talk fallback and local-only detection", () => {
    expect(
      evaluateWakeWordFeasibility(
        feasiblePolicy({
          push_to_talk_fallback: false,
          local_only_wake_detection: false,
        }),
      ),
    ).toMatchObject({
      ok: false,
      missing_invariants: [
        "local_only_wake_detection",
        "push_to_talk_fallback",
      ],
    });
  });

  it("keeps feasibility output metadata-only and rejects unknown fields", () => {
    const result = evaluateWakeWordFeasibility({
      ...feasiblePolicy(),
      transcript: "wake phrase content must never appear here",
    });

    expect(result).toMatchObject({
      ok: false,
      missing_invariants: ["metadata_only_feasibility_output"],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /transcript|prompt|response|raw_audio|audio_bytes|waveform|pcm|tool_output|wake phrase content/i,
    );
  });

  it("does not add wake-word implementation, background listening, realtime streaming, persistence, cloud/network, UI/Tauri, or runtime bypasses", () => {
    const source = wakeWordSource();

    expect(source).not.toMatch(
      /Porcupine|Picovoice|snowboy|wakeword\s*\(|detectWake|wakeDetector|WakeWordEngine|keywordSpot/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|MediaRecorder|AudioContext|navigator\.mediaDevices|MediaStream|microphone\.start|startRecording|recordAudio/i,
    );
    expect(source).not.toMatch(
      /AsyncIterable|WebSocket|EventSource|XMLHttpRequest|partial_token|partial_transcript|token-stream|realtime/i,
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
    expect(source).not.toMatch(
      /setInterval|setTimeout|while\s*\(true\)|conversation_loop|autonomousLoop|autonomousExecution/i,
    );
  });
});
