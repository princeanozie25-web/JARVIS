import { describe, expect, it } from "vitest";

import { sanitizeVoiceTelemetryEvent } from "../../src/lib/voice-runtime/telemetry";
import type {
  VoiceLiveProviderDescriptor,
  VoiceLiveProviderHealth,
} from "../../src/lib/voice/live/contract";
import {
  routeVoiceLive,
  voiceLiveRouteTelemetry,
  type VoiceLiveRouteInput,
} from "../../src/lib/voice/live/router";

// Voice bake-off — router policy kill-drills (brief §14, §6, §5).

const LOCAL: VoiceLiveProviderDescriptor = {
  provider_id: "local-mlx",
  display_name: "Local mlx",
  privacy_class: "local_audio",
  cost_class: "free_local",
  capabilities: [
    "streaming_stt",
    "streaming_tts",
    "local",
    "offline_capable",
    "tool_calling",
  ],
  tool_execution_allowed: false,
  metadata_only: true,
};
const CLOUD: VoiceLiveProviderDescriptor = {
  provider_id: "openai-realtime",
  display_name: "OpenAI Realtime",
  privacy_class: "cloud_audio",
  cost_class: "metered_cloud",
  capabilities: [
    "speech_to_speech",
    "barge_in",
    "cloud",
    "tool_calling",
    "multilingual",
  ],
  tool_execution_allowed: false,
  metadata_only: true,
};
const OK: VoiceLiveProviderHealth = {
  ok: true,
  degraded: false,
  metadata_only: true,
};
const health = (
  error_class: VoiceLiveProviderHealth["error_class"],
): VoiceLiveProviderHealth => ({
  ok: false,
  degraded: false,
  error_class,
  metadata_only: true,
});

function input(
  overrides: Partial<VoiceLiveRouteInput> = {},
): VoiceLiveRouteInput {
  return {
    mode: "auto",
    privacy_local_only: false,
    network_ok: true,
    budget: { window_usd: 0, warn_usd: 15, hard_usd: 20 },
    local_provider_id: "local-mlx",
    premium_provider_id: "openai-realtime",
    candidates: [
      { descriptor: LOCAL, health: OK },
      { descriptor: CLOUD, health: OK },
    ],
    ...overrides,
  };
}

describe("voice live router — defaults and explicit modes", () => {
  it("defaults to local even when cloud is healthy (§14 DEFAULT: local)", () => {
    expect(routeVoiceLive(input())).toMatchObject({
      provider_id: "local-mlx",
      reason: "default_local",
    });
  });

  it("selects cloud only on an explicit premium request", () => {
    const d = routeVoiceLive(input({ mode: "premium" }));
    expect(d).toMatchObject({
      provider_id: "openai-realtime",
      reason: "premium_selected",
      budget_warning: false,
    });
    expect(d.considered).toEqual([
      { provider_id: "openai-realtime", selected: true },
    ]);
  });

  it("private and offline modes never consider cloud at all (§6)", () => {
    for (const [mode, reason] of [
      ["private", "requested_private"],
      ["offline", "requested_offline"],
      ["local", "requested_local"],
    ] as const) {
      const d = routeVoiceLive(input({ mode }));
      expect(d).toMatchObject({ provider_id: "local-mlx", reason });
      expect(
        d.considered.find((c) => c.provider_id === "openai-realtime"),
      ).toMatchObject({ selected: false, rejected_because: reason });
    }
  });

  it("a privacy local-only posture overrides a premium request", () => {
    expect(
      routeVoiceLive(input({ mode: "premium", privacy_local_only: true })),
    ).toMatchObject({
      provider_id: "local-mlx",
      reason: "privacy_local_only",
    });
  });
});

describe("voice live router — fallbacks", () => {
  it("falls back to local when the network is down", () => {
    expect(
      routeVoiceLive(input({ mode: "premium", network_ok: false })),
    ).toMatchObject({
      provider_id: "local-mlx",
      reason: "network_unavailable",
    });
  });

  it("falls back to local at the hard spend cap, and only warns at the warning threshold", () => {
    expect(
      routeVoiceLive(
        input({
          mode: "premium",
          budget: { window_usd: 20, warn_usd: 15, hard_usd: 20 },
        }),
      ),
    ).toMatchObject({
      provider_id: "local-mlx",
      reason: "budget_hard_cap",
      budget_warning: true,
    });
    expect(
      routeVoiceLive(
        input({
          mode: "premium",
          budget: { window_usd: 16, warn_usd: 15, hard_usd: 20 },
        }),
      ),
    ).toMatchObject({
      provider_id: "openai-realtime",
      reason: "premium_selected",
      budget_warning: true,
    });
  });

  it("falls back to local when the premium provider is missing a credential, disabled, or unhealthy", () => {
    const cases = [
      ["credential_missing", "premium_credential_missing"],
      ["disabled", "premium_disabled"],
      ["unavailable", "premium_unavailable"],
    ] as const;
    for (const [error_class, reason] of cases) {
      const d = routeVoiceLive(
        input({
          mode: "premium",
          candidates: [
            { descriptor: LOCAL, health: OK },
            { descriptor: CLOUD, health: health(error_class) },
          ],
        }),
      );
      expect(d).toMatchObject({ provider_id: "local-mlx", reason });
      expect(d.considered[0]).toMatchObject({
        provider_id: "openai-realtime",
        selected: false,
        rejected_because: reason,
      });
    }
  });

  it("rejects a provider that lacks a required capability", () => {
    expect(
      routeVoiceLive(
        input({ mode: "premium", required_capabilities: ["offline_capable"] }),
      ),
    ).toMatchObject({
      provider_id: "local-mlx",
      reason: "capability_unmet",
    });
  });

  it("reports no_provider_available when local is down too — never a silent cloud switch", () => {
    const d = routeVoiceLive(
      input({
        mode: "private",
        candidates: [
          { descriptor: LOCAL, health: health("unavailable") },
          { descriptor: CLOUD, health: OK },
        ],
      }),
    );
    expect(d).toMatchObject({
      provider_id: null,
      reason: "no_provider_available",
    });
  });
});

describe("voice live router — decision logging", () => {
  it("emits a frozen-contract-safe telemetry event for every decision", () => {
    const d = routeVoiceLive(input({ mode: "premium" }));
    const event = voiceLiveRouteTelemetry(d, "sess-1", "2026-09-06T00:00:00Z");
    expect(event).toMatchObject({
      event_type: "voice_live.route.premium_selected",
      session_id: "sess-1",
      provider_id: "openai-realtime",
      degraded: false,
      redaction_status: "metadata_only",
    });
    expect(sanitizeVoiceTelemetryEvent(event).ok).toBe(true);
    const none = voiceLiveRouteTelemetry(
      routeVoiceLive(input({ candidates: [] })),
      "sess-2",
      "2026-09-06T00:00:00Z",
    );
    expect(none).toMatchObject({
      event_type: "voice_live.route.no_provider_available",
      degraded: true,
    });
    expect(sanitizeVoiceTelemetryEvent(none).ok).toBe(true);
  });
});
