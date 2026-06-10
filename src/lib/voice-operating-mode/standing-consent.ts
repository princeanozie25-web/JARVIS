import { parse } from "yaml";

import type { VoiceAuthorityAction, VoiceAuthorityTier } from "./authority";

export interface StandingConsentEntry {
  readonly id: string;
  readonly label: string;
  readonly tier: Extract<VoiceAuthorityTier, "T1">;
  readonly action: Extract<
    VoiceAuthorityAction,
    "lights" | "timers" | "local_notes"
  >;
  readonly scope: string;
  readonly granted: boolean;
  readonly revoked: boolean;
  readonly granted_by: "user_config";
  readonly audit_event: string;
}

export interface StandingConsentConfig {
  readonly version: "phase22.voice.standing-consent.v1";
  readonly owner_controlled: true;
  readonly auditable: true;
  readonly revocable: true;
  readonly voice_may_grant_consent: false;
  readonly no_self_expansion: true;
  readonly metadata_only: true;
  readonly consents: readonly StandingConsentEntry[];
}

export type StandingConsentParseResult =
  | {
      readonly ok: true;
      readonly config: StandingConsentConfig;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly config: null;
      readonly reasons: readonly string[];
      readonly metadata_only: true;
    };

export function parseStandingConsentConfig(
  yamlText: string,
): StandingConsentParseResult {
  const parsed = parse(yamlText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return failure(["malformed_yaml"]);
  }

  const record = parsed as Record<string, unknown>;
  const reasons: string[] = [];
  if (record.version !== "phase22.voice.standing-consent.v1") {
    reasons.push("invalid_version");
  }
  for (const key of [
    "owner_controlled",
    "auditable",
    "revocable",
    "metadata_only",
  ] as const) {
    if (record[key] !== true) reasons.push(`${key}_required`);
  }
  if (record.voice_may_grant_consent !== false) {
    reasons.push("voice_grant_forbidden");
  }
  if (record.no_self_expansion !== true) {
    reasons.push("no_self_expansion_required");
  }
  if (!Array.isArray(record.consents)) reasons.push("consents_required");

  const consents = Array.isArray(record.consents)
    ? record.consents.map(validateEntry)
    : [];
  const invalidEntry = consents.find((entry) => !entry.ok);
  if (invalidEntry) reasons.push(...invalidEntry.reasons);

  if (reasons.length > 0) return failure([...new Set(reasons)]);

  return {
    ok: true,
    config: {
      version: "phase22.voice.standing-consent.v1",
      owner_controlled: true,
      auditable: true,
      revocable: true,
      voice_may_grant_consent: false,
      no_self_expansion: true,
      metadata_only: true,
      consents: consents
        .filter((entry): entry is { ok: true; value: StandingConsentEntry } =>
          Boolean(entry.ok),
        )
        .map((entry) => entry.value),
    },
    reasons: [],
    metadata_only: true,
  };
}

export function hasStandingConsent(
  config: StandingConsentConfig,
  action: VoiceAuthorityAction,
  scope?: string,
): boolean {
  return config.consents.some(
    (entry) =>
      entry.granted &&
      !entry.revoked &&
      entry.action === action &&
      (scope === undefined || entry.scope === scope),
  );
}

export function revokeStandingConsent(
  config: StandingConsentConfig,
  id: string,
): StandingConsentConfig {
  return {
    ...config,
    consents: config.consents.map((entry) =>
      entry.id === id ? { ...entry, revoked: true, granted: false } : entry,
    ),
  };
}

export function voiceGrantStandingConsent(): {
  readonly ok: false;
  readonly reason: "voice_may_never_grant_consent";
  readonly metadata_only: true;
} {
  return {
    ok: false,
    reason: "voice_may_never_grant_consent",
    metadata_only: true,
  };
}

function validateEntry(
  value: unknown,
):
  | { readonly ok: true; readonly value: StandingConsentEntry }
  | { readonly ok: false; readonly reasons: readonly string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reasons: ["malformed_consent_entry"] };
  }
  const record = value as Record<string, unknown>;
  const reasons: string[] = [];
  if (typeof record.id !== "string" || record.id.length === 0) {
    reasons.push("consent_id_required");
  }
  if (typeof record.label !== "string" || record.label.length === 0) {
    reasons.push("consent_label_required");
  }
  if (record.tier !== "T1") reasons.push("only_t1_standing_consent_allowed");
  if (
    record.action !== "lights" &&
    record.action !== "timers" &&
    record.action !== "local_notes"
  ) {
    reasons.push("unsupported_standing_consent_action");
  }
  if (typeof record.scope !== "string" || record.scope.length === 0) {
    reasons.push("consent_scope_required");
  }
  if (typeof record.granted !== "boolean") reasons.push("granted_required");
  if (typeof record.revoked !== "boolean") reasons.push("revoked_required");
  if (record.granted_by !== "user_config") {
    reasons.push("consent_must_be_user_config");
  }
  if (
    typeof record.audit_event !== "string" ||
    !record.audit_event.startsWith("standing-consent:")
  ) {
    reasons.push("audit_event_required");
  }
  if (reasons.length > 0) return { ok: false, reasons };
  return {
    ok: true,
    value: {
      id: record.id as string,
      label: record.label as string,
      tier: "T1",
      action: record.action as StandingConsentEntry["action"],
      scope: record.scope as string,
      granted: record.granted as boolean,
      revoked: record.revoked as boolean,
      granted_by: "user_config",
      audit_event: record.audit_event as string,
    },
  };
}

function failure(reasons: readonly string[]): StandingConsentParseResult {
  return {
    ok: false,
    config: null,
    reasons,
    metadata_only: true,
  };
}
