import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_WAKE_WORD_POLICY,
  WAKE_WORD_POLICY_LIMITS,
  canArmWakeWord,
  canOpenActivationWindow,
  createDefaultWakeWordPolicy,
  validateWakeWordPolicy,
  type WakeWordPolicy,
} from "../../../src/lib/voice-runtime/wake-word";

const sourceRoot = join(process.cwd(), "src/lib/voice-runtime/wake-word");

function validPolicy(overrides: Partial<WakeWordPolicy> = {}): WakeWordPolicy {
  return {
    ...createDefaultWakeWordPolicy(),
    enabled: true,
    explicit_opt_in: true,
    ...overrides,
  };
}

function readWakeWordSources(): string {
  return [
    "types.ts",
    "policy.ts",
    "state-machine.ts",
    "provider.ts",
    "index.ts",
  ]
    .map((fileName) => readFileSync(join(sourceRoot, fileName), "utf8"))
    .join("\n");
}

describe("wake-word policy scaffold", () => {
  it("defaults to disabled and fail-closed", () => {
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

    const validation = validateWakeWordPolicy(DEFAULT_WAKE_WORD_POLICY);
    expect(validation.ok).toBe(false);
    expect(validation.reasons).toContain("wake_word_disabled");
    expect(validation.reasons).toContain("explicit_opt_in_required");
    expect(canArmWakeWord(DEFAULT_WAKE_WORD_POLICY)).toEqual({
      allowed: false,
      reason: "wake_word_disabled",
      metadata_only: true,
    });
  });

  it("allows arming only when all governance requirements are satisfied", () => {
    const policy = validPolicy();

    expect(validateWakeWordPolicy(policy)).toEqual({
      ok: true,
      policy,
      reasons: [],
      metadata_only: true,
    });
    expect(canArmWakeWord(policy)).toEqual({
      allowed: true,
      reason: null,
      metadata_only: true,
    });
  });

  it.each([
    ["explicit_opt_in", false, "explicit_opt_in_required"],
    ["local_only", false, "local_only_required"],
    ["visible_mic_indicator_required", false, "visible_mic_indicator_required"],
    ["hard_kill_switch_enabled", false, "hard_kill_switch_required"],
    ["push_to_talk_fallback_required", false, "push_to_talk_fallback_required"],
    ["allow_cloud_detection", true, "cloud_detection_forbidden"],
    ["allow_pre_wake_transcription", true, "pre_wake_transcription_forbidden"],
    ["allow_raw_audio_persistence", true, "raw_audio_persistence_forbidden"],
    ["allow_wake_triggered_tools", true, "wake_triggered_tools_forbidden"],
    [
      "allow_wake_triggered_approval",
      true,
      "wake_triggered_approval_forbidden",
    ],
    ["allow_autonomous_loop", true, "autonomous_loop_forbidden"],
  ] as const)(
    "rejects forbidden or missing governance invariant %s",
    (key, value, reason) => {
      const validation = validateWakeWordPolicy(validPolicy({ [key]: value }));

      expect(validation.ok).toBe(false);
      expect(validation.reasons).toContain(reason);
    },
  );

  it("bounds activation windows", () => {
    const policy = validPolicy({ max_activation_window_ms: 1000 });

    expect(canOpenActivationWindow(policy, 1000)).toEqual({
      allowed: true,
      reason: null,
      metadata_only: true,
    });
    expect(canOpenActivationWindow(policy, 1001)).toEqual({
      allowed: false,
      reason: "activation_window_out_of_bounds",
      metadata_only: true,
    });
    expect(
      validateWakeWordPolicy(
        validPolicy({
          max_activation_window_ms:
            WAKE_WORD_POLICY_LIMITS.max_activation_window_ms + 1,
        }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: ["activation_window_out_of_bounds"],
    });
  });

  it("fails closed on malformed or unknown policy fields", () => {
    expect(validateWakeWordPolicy(null)).toEqual({
      ok: false,
      policy: null,
      reasons: ["malformed_policy"],
      metadata_only: true,
    });
    expect(
      validateWakeWordPolicy({
        ...validPolicy(),
        hidden_background_capture: true,
      }),
    ).toEqual({
      ok: false,
      policy: null,
      reasons: ["malformed_policy"],
      metadata_only: true,
    });
  });

  it("contains no active wake-word, mic, runtime, persistence, cloud, or UI wiring", () => {
    const source = readWakeWordSources();

    expect(source).not.toMatch(
      /Porcupine|Picovoice|openwakeword|snowboy|WakeWordEngine|keywordSpot/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|MediaRecorder|AudioContext|navigator\.mediaDevices|MediaStream|microphone\.start|startRecording|recordAudio/i,
    );
    expect(source).not.toMatch(
      /setInterval|while\s*\(true\)|conversation_loop|autonomousExecution/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore|better-sqlite3/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(/React|useEffect|useState|tauri|invoke\s*\(/i);
    expect(source).not.toMatch(
      /createModelRuntime|executeVoiceRequest|executeTool|approveAction|runAction|shell_command|child_process|spawn\s*\(|exec\s*\(/i,
    );
  });
});
