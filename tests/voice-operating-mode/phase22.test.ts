import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_OPENWAKEWORD_ONNX_CONFIG,
  PHASE22_OPENWAKEWORD_VERSION,
  PHASE22_WAKE_PHRASE,
  buildSystemVoiceStackRuntimeState,
  buildVoicePipelineVisibilityModel,
  decideVoiceAuthority,
  defaultSystemVoiceHealth,
  evaluateWakeWordMetadataDetection,
  hasStandingConsent,
  isVoiceSleepCommand,
  isVoiceT3ExecutionForbidden,
  parseStandingConsentConfig,
  revokeStandingConsent,
  transitionVoiceConversationState,
  validateOpenWakeWordConfig,
  voiceGrantStandingConsent,
  voiceVadTimeoutMs,
  type StandingConsentConfig,
  type SystemVoiceProviderHealth,
} from "@/lib/voice-operating-mode";

function standingConsentConfig(): StandingConsentConfig {
  const result = parseStandingConsentConfig(
    readFileSync("config/voice/standing-consent.yaml", "utf8"),
  );
  if (!result.ok) {
    throw new Error(
      `standing consent parse failed: ${result.reasons.join(",")}`,
    );
  }
  return result.config;
}

function health(
  provider_id: SystemVoiceProviderHealth["provider_id"],
  priority: number,
  ok: boolean,
): SystemVoiceProviderHealth {
  return {
    provider_id,
    priority,
    ok,
    degraded: !ok,
    checked_at_ms: 1_783_000_000_000,
    local_only: true,
    metadata_only: true,
  };
}

describe("Phase 22 wake word", () => {
  it("configures openWakeWord as a local ONNX wake detector", () => {
    expect(PHASE22_WAKE_PHRASE).toBe("Hey Jarvis you up");
    expect(PHASE22_OPENWAKEWORD_VERSION).toBe("0.6.0");
    expect(validateOpenWakeWordConfig(DEFAULT_OPENWAKEWORD_ONNX_CONFIG)).toBe(
      true,
    );
    expect(DEFAULT_OPENWAKEWORD_ONNX_CONFIG).toMatchObject({
      engine: "openWakeWord",
      model_format: "ONNX",
      local_only: true,
      cloud_detection_enabled: false,
      pre_wake_audio_storage_enabled: false,
      raw_audio_persistence_enabled: false,
      visible_standby_indicator: true,
      visible_active_indicator: true,
      wake_authorizes_actions: false,
    });
  });

  it("detects the wake phrase through metadata without storing pre-wake audio", () => {
    const detection = evaluateWakeWordMetadataDetection({
      phrase: "hey jarvis you up",
      confidence: 0.89,
    });

    expect(detection).toMatchObject({
      wake_detected: true,
      phrase_observed: "Hey Jarvis you up",
      pre_wake_audio_stored: false,
      raw_audio_included: false,
      cloud_used: false,
      action_authorized: false,
      metadata_only: true,
    });
  });
});

describe("Phase 22 conversation mode", () => {
  it("moves Sleep -> Wake -> Active -> Idle -> Sleep", () => {
    expect(
      transitionVoiceConversationState("sleep", "wake_detected"),
    ).toMatchObject({ ok: true, next_state: "wake" });
    expect(
      transitionVoiceConversationState("wake", "activation_started"),
    ).toMatchObject({ ok: true, next_state: "active" });
    expect(
      transitionVoiceConversationState("active", "speech_completed"),
    ).toMatchObject({ ok: true, next_state: "idle" });
    expect(
      transitionVoiceConversationState("idle", "idle_timeout"),
    ).toMatchObject({ ok: true, next_state: "sleep" });
  });

  it("supports VAD timeout choices and sleep commands", () => {
    expect(voiceVadTimeoutMs(2)).toBe(120_000);
    expect(voiceVadTimeoutMs(3)).toBe(180_000);
    expect(voiceVadTimeoutMs(5)).toBe(300_000);
    expect(isVoiceSleepCommand("Jarvis sleep")).toBe(true);
    expect(isVoiceSleepCommand("Goodnight Jarvis.")).toBe(true);
    expect(isVoiceSleepCommand("approve this Jarvis")).toBe(false);
    expect(
      transitionVoiceConversationState("active", "sleep_command"),
    ).toMatchObject({ ok: true, next_state: "ending" });
    expect(
      transitionVoiceConversationState("ending", "sleep_completed"),
    ).toMatchObject({ ok: true, next_state: "sleep" });
  });
});

describe("Phase 22 voice authority", () => {
  it("keeps T0 read-only and T1 bound to standing consent", () => {
    const consent = standingConsentConfig();

    expect(
      decideVoiceAuthority({ tier: "T0", action: "summaries" }),
    ).toMatchObject({
      allowed: true,
      path: "read_only_answer",
      voice_executed: false,
    });
    expect(
      decideVoiceAuthority({
        tier: "T1",
        action: "lights",
        scope: "room.office.lights",
        standingConsent: consent,
      }),
    ).toMatchObject({
      allowed: true,
      path: "standing_consent_action",
      voice_executed: true,
    });
    expect(
      decideVoiceAuthority({
        tier: "T1",
        action: "lights",
        scope: "room.bedroom.lights",
        standingConsent: consent,
      }),
    ).toMatchObject({
      allowed: false,
      reason: "standing_consent_required",
      voice_executed: false,
    });
  });

  it("routes T2 through UI confirmation and forbids T3 voice execution", () => {
    expect(
      decideVoiceAuthority({ tier: "T2", action: "external_send" }),
    ).toMatchObject({
      allowed: false,
      reason: "ui_confirmation_required",
      human_gate_required: true,
      voice_executed: false,
    });
    expect(
      decideVoiceAuthority({
        tier: "T2",
        action: "external_send",
        uiConfirmed: true,
      }),
    ).toMatchObject({
      allowed: true,
      path: "ui_confirmed_proposal",
      human_gate_required: true,
      voice_executed: false,
    });
    expect(isVoiceT3ExecutionForbidden({ tier: "T3" })).toBe(true);
    expect(decideVoiceAuthority({ tier: "T3", action: "shell" })).toMatchObject(
      {
        allowed: false,
        reason: "manual_only",
        voice_executed: false,
      },
    );
  });
});

describe("Phase 22 standing consent", () => {
  it("parses an auditable, revocable, user-controlled consent file", () => {
    const consent = standingConsentConfig();

    expect(consent).toMatchObject({
      owner_controlled: true,
      auditable: true,
      revocable: true,
      voice_may_grant_consent: false,
      no_self_expansion: true,
      metadata_only: true,
    });
    expect(hasStandingConsent(consent, "timers", "local.timer.under_30m")).toBe(
      true,
    );
  });

  it("revokes consent and never lets voice grant new consent", () => {
    const consent = standingConsentConfig();
    const revoked = revokeStandingConsent(consent, "office_lights_focus");

    expect(hasStandingConsent(revoked, "lights", "room.office.lights")).toBe(
      false,
    );
    expect(voiceGrantStandingConsent()).toEqual({
      ok: false,
      reason: "voice_may_never_grant_consent",
      metadata_only: true,
    });
  });
});

describe("Phase 22 system-wide voice stack", () => {
  it("uses Chatterbox as the system primary with Kokoro and existing runtime fallbacks", () => {
    const stack = buildSystemVoiceStackRuntimeState([
      health("chatterbox-tts-server", 0, true),
      health("kokoro", 1, true),
      health("existing-local-runtime", 2, true),
    ]);

    expect(stack).toMatchObject({
      primary: "chatterbox-tts-server",
      selected_provider: "chatterbox-tts-server",
      health_checks_required: true,
      chatterbox_system_wide: true,
      faster_whisper_version: "1.2.1",
      openwakeword_version: "0.6.0",
    });
    expect(stack.fallback_order).toEqual([
      "chatterbox-tts-server",
      "kokoro",
      "existing-local-runtime",
    ]);
  });

  it("falls back to Kokoro, then the existing local runtime", () => {
    expect(
      buildSystemVoiceStackRuntimeState([
        health("chatterbox-tts-server", 0, false),
        health("kokoro", 1, true),
        health("existing-local-runtime", 2, true),
      ]).selected_provider,
    ).toBe("kokoro");
    expect(
      buildSystemVoiceStackRuntimeState(defaultSystemVoiceHealth()),
    ).toMatchObject({
      selected_provider: "existing-local-runtime",
      health_checks_required: true,
    });
  });
});

describe("Phase 22 pipeline visibility", () => {
  it("publishes voice activity to every command-center surface as read-only metadata", () => {
    const model = buildVoicePipelineVisibilityModel();

    expect(model.surfaces).toEqual([
      "/rest",
      "/working",
      "/audit",
      "/audit/pipeline",
    ]);
    expect(model.events.map((event) => event.kind)).toEqual([
      "wake_event",
      "conversation_active",
      "t0_route",
      "t1_request",
      "t2_proposal",
      "approval_pending",
    ]);
    for (const event of model.events) {
      expect(event).toMatchObject({
        metadata_only: true,
        raw_audio_included: false,
        transcript_included: false,
        executable_payload_included: false,
      });
    }
  });
});
