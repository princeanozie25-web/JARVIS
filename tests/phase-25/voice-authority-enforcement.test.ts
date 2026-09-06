import { describe, expect, it } from "vitest";

import {
  VOICE_AUTHORITY_TIERS,
  decideVoiceAuthority,
  type VoiceAuthorityAction,
} from "../../src/lib/voice-operating-mode/authority";
import {
  CANONICAL_VOICE_ACTION_TIERS,
  canonicalTierForAction,
  decideVoiceAuthorityForAction,
  isCanonicalVoiceTier,
} from "../../src/lib/voice-operating-mode/authority-enforcement";
import type { StandingConsentConfig } from "../../src/lib/voice-operating-mode/standing-consent";

// Phase 25C (E-043) — the T0-T3 enforcement battery for the LIVE voice path.
// Phase 22 (frozen) already characterizes decideVoiceAuthority's per-tier
// behaviour on a caller-supplied tier. This battery locks the live-path
// contract: the tier is DERIVED from the action, so no destructive action can
// be smuggled through at a permissive tier, and nothing above T1 is ever
// executed by voice under any input.

const ALL_ACTIONS = Object.keys(
  CANONICAL_VOICE_ACTION_TIERS,
) as VoiceAuthorityAction[];

const actionsAt = (tier: string): VoiceAuthorityAction[] =>
  ALL_ACTIONS.filter((a) => canonicalTierForAction(a) === tier);

function consentFor(
  action: "lights" | "timers" | "local_notes",
  scope: string,
): StandingConsentConfig {
  return {
    version: "phase22.voice.standing-consent.v1",
    owner_controlled: true,
    auditable: true,
    revocable: true,
    voice_may_grant_consent: false,
    no_self_expansion: true,
    metadata_only: true,
    consents: [
      {
        id: `consent.${action}`,
        label: `${action} standing consent`,
        tier: "T1",
        action,
        scope,
        granted: true,
        revoked: false,
        granted_by: "user_config",
        audit_event: `phase25c.test.${action}`,
      },
    ],
  };
}

describe("E-043 voice authority enforcement — the canonical action->tier map", () => {
  it("classifies every action into exactly one T0-T3 tier", () => {
    for (const action of ALL_ACTIONS) {
      expect(VOICE_AUTHORITY_TIERS).toContain(canonicalTierForAction(action));
    }
    // The exact map, spelled out so an accidental re-tier of a destructive
    // action (e.g. shell -> T0) fails loudly here.
    expect(CANONICAL_VOICE_ACTION_TIERS).toEqual({
      status: "T0",
      questions: "T0",
      notes: "T0",
      summaries: "T0",
      lights: "T1",
      timers: "T1",
      local_notes: "T1",
      external_send: "T2",
      file_delete: "T3",
      shell: "T3",
      restricted_device: "T3",
    });
    expect(ALL_ACTIONS).toHaveLength(11);
  });
});

describe("E-043 voice authority enforcement — per-tier live decisions", () => {
  it("T0 actions answer read-only, no gate, no execution", () => {
    for (const action of actionsAt("T0")) {
      expect(decideVoiceAuthorityForAction({ action })).toMatchObject({
        allowed: true,
        tier: "T0",
        path: "read_only_answer",
        human_gate_required: false,
        voice_executed: false,
        metadata_only: true,
      });
    }
  });

  it("T1 actions execute by voice ONLY with matching standing consent", () => {
    const action = "lights";
    const scope = "room.office.lights";
    expect(
      decideVoiceAuthorityForAction({
        action,
        scope,
        standingConsent: consentFor(action, scope),
      }),
    ).toMatchObject({
      allowed: true,
      tier: "T1",
      path: "standing_consent_action",
      human_gate_required: false,
      voice_executed: true,
    });
    // Consent granted for a different scope must not carry.
    expect(
      decideVoiceAuthorityForAction({
        action,
        scope: "room.bedroom.lights",
        standingConsent: consentFor(action, scope),
      }),
    ).toMatchObject({
      allowed: false,
      tier: "T1",
      reason: "standing_consent_required",
      voice_executed: false,
    });
    // No consent at all -> denied.
    expect(decideVoiceAuthorityForAction({ action, scope })).toMatchObject({
      allowed: false,
      reason: "standing_consent_required",
      voice_executed: false,
    });
  });

  it("T2 actions never execute by voice; allowed only through the UI gate", () => {
    const action = "external_send";
    expect(decideVoiceAuthorityForAction({ action })).toMatchObject({
      allowed: false,
      tier: "T2",
      reason: "ui_confirmation_required",
      human_gate_required: true,
      voice_executed: false,
    });
    expect(
      decideVoiceAuthorityForAction({ action, uiConfirmed: true }),
    ).toMatchObject({
      allowed: true,
      tier: "T2",
      path: "ui_confirmed_proposal",
      human_gate_required: true,
      voice_executed: false,
    });
  });

  it("T3 actions are manual-only under every input", () => {
    for (const action of actionsAt("T3")) {
      for (const uiConfirmed of [undefined, true, false]) {
        expect(
          decideVoiceAuthorityForAction({ action, uiConfirmed }),
        ).toMatchObject({
          allowed: false,
          tier: "T3",
          reason: "manual_only",
          human_gate_required: true,
          voice_executed: false,
        });
      }
    }
  });
});

describe("E-043 voice authority enforcement — the anti-smuggling guarantee", () => {
  it("derives the tier from the action, defeating a claimed-tier downgrade", () => {
    // The raw Phase 22 decision TRUSTS the claimed tier, so a destructive
    // action asked for at T0 slips through as a read-only answer.
    expect(decideVoiceAuthority({ tier: "T0", action: "shell" })).toMatchObject(
      {
        allowed: true,
        path: "read_only_answer",
      },
    );
    expect(isCanonicalVoiceTier({ tier: "T0", action: "shell" })).toBe(false);

    // The live entrypoint ignores any claim and classifies shell as T3.
    expect(decideVoiceAuthorityForAction({ action: "shell" })).toMatchObject({
      allowed: false,
      tier: "T3",
      reason: "manual_only",
      voice_executed: false,
    });
  });

  it("never voice-executes a T2 or T3 action under any consent/confirmation", () => {
    // A T1 consent object must not help a higher-tier action either.
    const strayConsent = consentFor("lights", "room.office.lights");
    for (const action of ALL_ACTIONS) {
      const tier = canonicalTierForAction(action);
      if (tier !== "T2" && tier !== "T3") continue;
      for (const uiConfirmed of [undefined, true, false]) {
        const decision = decideVoiceAuthorityForAction({
          action,
          uiConfirmed,
          scope: "room.office.lights",
          standingConsent: strayConsent,
        });
        expect(decision.voice_executed).toBe(false);
      }
    }
  });

  it("every decision is metadata-only", () => {
    for (const action of ALL_ACTIONS) {
      expect(decideVoiceAuthorityForAction({ action }).metadata_only).toBe(
        true,
      );
    }
  });
});
