export const SYSTEM_VOICE_PROVIDER_IDS = [
  "chatterbox-tts-server",
  "kokoro",
  "existing-local-runtime",
] as const;

export type SystemVoiceProviderId = (typeof SYSTEM_VOICE_PROVIDER_IDS)[number];

export interface SystemVoiceProviderHealth {
  readonly provider_id: SystemVoiceProviderId;
  readonly priority: number;
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly checked_at_ms: number;
  readonly local_only: true;
  readonly metadata_only: true;
}

export interface SystemVoiceStackRuntimeState {
  readonly primary: "chatterbox-tts-server";
  readonly fallback_order: readonly [
    "chatterbox-tts-server",
    "kokoro",
    "existing-local-runtime",
  ];
  readonly selected_provider: SystemVoiceProviderId;
  readonly provider_health: readonly SystemVoiceProviderHealth[];
  readonly health_checks_required: true;
  readonly chatterbox_system_wide: true;
  readonly faster_whisper_version: "1.2.1";
  readonly openwakeword_version: "0.6.0";
  readonly metadata_only: true;
}

export function selectSystemVoiceProvider(
  health: readonly SystemVoiceProviderHealth[],
): SystemVoiceProviderId {
  const ordered = [...health].sort(
    (left, right) => left.priority - right.priority,
  );
  return (
    ordered.find((entry) => entry.ok)?.provider_id ?? "existing-local-runtime"
  );
}

export function buildSystemVoiceStackRuntimeState(
  health: readonly SystemVoiceProviderHealth[] = defaultSystemVoiceHealth(),
): SystemVoiceStackRuntimeState {
  return {
    primary: "chatterbox-tts-server",
    fallback_order: [
      "chatterbox-tts-server",
      "kokoro",
      "existing-local-runtime",
    ],
    selected_provider: selectSystemVoiceProvider(health),
    provider_health: health,
    health_checks_required: true,
    chatterbox_system_wide: true,
    faster_whisper_version: "1.2.1",
    openwakeword_version: "0.6.0",
    metadata_only: true,
  };
}

export function defaultSystemVoiceHealth(
  now: number = 1_783_000_000_000,
): readonly SystemVoiceProviderHealth[] {
  return [
    health("chatterbox-tts-server", 0, false, now),
    health("kokoro", 1, false, now),
    health("existing-local-runtime", 2, true, now),
  ];
}

function health(
  providerId: SystemVoiceProviderId,
  priority: number,
  ok: boolean,
  checkedAtMs: number,
): SystemVoiceProviderHealth {
  return {
    provider_id: providerId,
    priority,
    ok,
    degraded: !ok,
    checked_at_ms: checkedAtMs,
    local_only: true,
    metadata_only: true,
  };
}
