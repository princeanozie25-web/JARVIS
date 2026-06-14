import { describe, expect, it } from "vitest";

import { AUDIT_DISABLED_AFFORDANCES } from "@/components/audit/panel-registry";
import {
  createNarrationFailoverTelemetrySink,
  createPiperNarrationFallbackProvider,
  DEMO_SCRIPT_RECRUITER,
  findForbiddenTelemetryField,
  prepareDemoNarration,
  type DemoNarrationAudioCue,
  type DemoNarrationProvider,
  type DemoNarrationProviderId,
} from "@/lib/demo-director";
import { createRuntimeNarrationProviders } from "@/lib/demo-director/chatterbox";
import {
  PIPELINE_STAGE_IDS,
  PIPELINE_VISUALIZATION_VERSION,
} from "@/lib/pipeline-visualization/contracts";
import type { TelemetryEvent, TelemetryEventType } from "@/lib/telemetry";
import {
  MultimodalAnalysisPacketSchema,
  VideoTranscriptEventSchema,
} from "@/lib/video-extraction";
import { loadVisionStandingConsentConfig } from "@/lib/vision-runtime/config/standing-consent-config";
import {
  isVisionSourceEnabled,
  loadVisionSourceAllowlistConfig,
  VISION_SOURCE_PLATFORMS,
} from "@/lib/vision-runtime/config/source-allowlist-config";
import { evaluateVisionRuntimePolicy } from "@/lib/vision-runtime/policy";
import { isVisionProviderCapabilityAllowed } from "@/lib/vision-runtime/provider";
import {
  sanitizeVisionMetadataPayload,
  VISION_METADATA_ALLOWED_FIELDS,
} from "@/lib/vision-runtime/redaction";

// Phase 23 CLOSEOUT — Vision + Sensing Realization. Small, focused it blocks
// (no whole-repo-scan-in-one-it). Each asserts a closeout invariant against
// imported contracts. Full file:line evidence: docs/audits/PHASE23_CLOSEOUT_VERIFICATION.md.

function narrationStub(
  provider_id: DemoNarrationProviderId,
  priority: number,
  ok: boolean,
  synthesizes: boolean,
): DemoNarrationProvider {
  const provider: DemoNarrationProvider = {
    provider_id,
    priority,
    health: async () => ({
      provider_id,
      ok,
      degraded: !ok,
      checked_at_ms: 1,
      metadata_only: true,
    }),
  };
  if (synthesizes) {
    provider.synthesize = async (line): Promise<DemoNarrationAudioCue> => ({
      audio_id: `audio:${line.line_id}`,
      line_id: line.line_id,
      provider_id,
      duration_ms: 1000,
      mime_type: "audio/wav",
      byte_length: 64,
      local_ref: `memory:${line.line_id}`,
      metadata_only: true,
      no_auto_play: true,
      no_voice_authority: true,
    });
  }
  return provider;
}

describe("Phase 23 closeout — pipeline spine byte-frozen", () => {
  it("keeps the six-stage spine byte-identical and in order", () => {
    expect(PIPELINE_STAGE_IDS).toEqual([
      "capture",
      "classify",
      "route",
      "human_gate",
      "execute",
      "audit",
    ]);
  });

  it("does not bump the Phase 21 pipeline version (spine unchanged)", () => {
    expect(PIPELINE_VISUALIZATION_VERSION).toBe("phase21k.pipeline.v1");
  });
});

describe("Phase 23 closeout — I3 vision provider execution gated by default", () => {
  it("denies real_camera by default (no consent)", () => {
    const decision = evaluateVisionRuntimePolicy({
      capability: "real_camera",
      input_kind: "real_camera_frame",
      provider_kind: "real_camera",
      environment: "development",
      user_triggered: true,
      capture_mode: "single",
    });
    expect(decision).toMatchObject({
      allowed: false,
      reason: "real_camera_disabled",
    });
  });

  it("denies cloud_vision at registration unconditionally", () => {
    expect(
      isVisionProviderCapabilityAllowed(
        { kind: "cloud_vision", supported_capability: "cloud_vision" },
        { camera_capture_consent_granted: true },
      ),
    ).toBe(false);
  });

  it("admits real_camera at registration only with explicit consent", () => {
    const realCamera = {
      kind: "real_camera" as const,
      supported_capability: "real_camera" as const,
    };
    expect(isVisionProviderCapabilityAllowed(realCamera)).toBe(false);
    expect(
      isVisionProviderCapabilityAllowed(realCamera, {
        camera_capture_consent_granted: true,
      }),
    ).toBe(true);
  });

  it("ships the source allowlist fail-closed (every platform disabled)", () => {
    const result = loadVisionSourceAllowlistConfig();
    for (const platform of VISION_SOURCE_PLATFORMS) {
      expect(isVisionSourceEnabled(result, platform)).toBe(false);
    }
  });

  it("ships standing consent fail-closed (camera_capture not granted)", () => {
    const consent = loadVisionStandingConsentConfig();
    const camera = consent.consents.find((c) => c.id === "camera_capture");
    // Either absent or present-but-not-granted; never granted by default.
    expect(camera?.granted ?? false).toBe(false);
  });
});

describe("Phase 23 closeout — I4 no background/autonomous capture", () => {
  it("denies background/periodic/continuous even with consent", () => {
    for (const mode of ["background", "periodic", "continuous"] as const) {
      const decision = evaluateVisionRuntimePolicy({
        capability: "real_camera",
        input_kind: "real_camera_frame",
        provider_kind: "real_camera",
        environment: "development",
        user_triggered: true,
        capture_mode: mode,
        camera_capture_consent_granted: true,
      });
      expect(decision.allowed).toBe(false);
    }
  });
});

describe("Phase 23 closeout — I2 telemetry metadata-only", () => {
  it("keeps size_band and adds duration_band to the vision allowlist (additive)", () => {
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("size_band");
    expect(VISION_METADATA_ALLOWED_FIELDS).toContain("duration_band");
  });

  it("passes a metadata-only event and rejects forbidden raw fields", () => {
    expect(
      sanitizeVisionMetadataPayload({
        event_type: "voice_provider_failover",
        metadata_only: true,
        raw_payload_included: false,
      }),
    ).toMatchObject({ ok: true, redaction_status: "metadata_only" });

    expect(
      sanitizeVisionMetadataPayload({
        event_type: "voice_provider_failover",
        metadata_only: true,
        raw_payload_included: false,
        transcript: "forbidden",
      }),
    ).toMatchObject({ ok: false, redaction_status: "withheld" });
  });

  it("declares the new failover event types in the telemetry union", () => {
    // Typed against the union — membership proven at compile time.
    const newTypes: readonly TelemetryEventType[] = [
      "voice_provider_failover",
      "voice_provider_selected",
    ];
    expect(newTypes).toHaveLength(2);
  });
});

describe("Phase 23 closeout — duration_band migration (E-014)", () => {
  const base = {
    event_type: "transcript_extraction_completed" as const,
    event_id: "video-transcript:v:abc",
    session_id: "video:abc",
    source_id_hash: `sha256:${"a".repeat(64)}`,
    status: "completed" as const,
    model_name: "tiny",
    language: "en",
    latency_ms: 10,
    observation_count: "1_to_30" as const,
    created_at_ms: 1,
    metadata_only: true as const,
    raw_payload_included: false as const,
    cloud_called: false as const,
    action_executed: false as const,
  };

  it("accepts the transcript event with duration_band", () => {
    expect(
      VideoTranscriptEventSchema.safeParse({
        ...base,
        duration_band: "under_10s",
      }).success,
    ).toBe(true);
  });

  it("rejects the legacy size_band field on the transcript event (strict)", () => {
    expect(
      VideoTranscriptEventSchema.safeParse({ ...base, size_band: "under_10s" })
        .success,
    ).toBe(false);
  });
});

describe("Phase 23 closeout — packet schema rejects payload fields", () => {
  it("rejects an unknown/raw payload field on the multimodal packet (strict)", () => {
    expect(
      MultimodalAnalysisPacketSchema.safeParse({
        raw_transcript: "forbidden",
      }).success,
    ).toBe(false);
  });
});

describe("Phase 23 closeout — failover chain: synthesizing terminal + audit (E-010)", () => {
  it("preserves the runtime chain order chatterbox -> kokoro -> existing-local-fallback", () => {
    expect(createRuntimeNarrationProviders().map((p) => p.provider_id)).toEqual(
      ["chatterbox-tts-server", "kokoro", "existing-local-fallback"],
    );
  });

  it("falls to a synthesizing terminal and emits failover + selected audit events", async () => {
    const events: TelemetryEvent[] = [];
    const sink = createNarrationFailoverTelemetrySink({
      recordEvent: (event) => events.push(event),
    });
    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        narrationStub("chatterbox-tts-server", 0, false, false),
        narrationStub("kokoro", 1, false, false),
        narrationStub("existing-local-fallback", 2, true, true),
      ],
      telemetry: sink,
    });

    expect(track.provider_id).toBe("existing-local-fallback");
    expect(track.audio_cues.length).toBe(track.lines.length);
    expect(track.audio_cues.length).toBeGreaterThan(0);
    expect(
      events
        .filter((e) => e.event_type === "voice_provider_failover")
        .map((e) => e.tool_name),
    ).toEqual(["chatterbox-tts-server", "kokoro"]);
    expect(
      events.find((e) => e.event_type === "voice_provider_selected")?.tool_name,
    ).toBe("existing-local-fallback");
  });

  it("keeps failover audit events free of forbidden raw content", () => {
    const events: TelemetryEvent[] = [];
    const sink = createNarrationFailoverTelemetrySink({
      recordEvent: (event) => events.push(event),
    });
    sink.recordFailover({
      from_provider_id: "chatterbox-tts-server",
      to_provider_id: "kokoro",
      reason: "health_probe_failed",
      chain_position: 0,
      occurred_at_ms: 1,
    });
    for (const event of events) {
      expect(
        findForbiddenTelemetryField(
          event as unknown as Record<string, unknown>,
        ),
      ).toBeNull();
    }
  });

  it("real Piper terminal is fail-closed: unavailable when binaries are missing", async () => {
    const env = {
      JARVIS_PIPER_EXECUTABLE: "/x/piper.exe",
      JARVIS_PIPER_MODEL: "/x/model.onnx",
      JARVIS_PIPER_MODEL_CONFIG: "/x/model.onnx.json",
      JARVIS_TTS_OUTPUT_DIR: "/x/out",
      JARVIS_TTS_VOICE_ID: "en_US-lessac-medium",
    };
    const missing = createPiperNarrationFallbackProvider({
      configPath: "/no/such/config.yaml",
      env,
      existsImpl: () => false,
    });
    await expect(missing.health()).resolves.toMatchObject({
      ok: false,
      degraded: true,
    });

    const present = createPiperNarrationFallbackProvider({
      configPath: "/no/such/config.yaml",
      env,
      existsImpl: () => true,
    });
    await expect(present.health()).resolves.toMatchObject({ ok: true });
  });
});

describe("Phase 23 closeout — I5 read-only surfaces (no execute/approve/mutate)", () => {
  it("audit panels disable every mutation affordance", () => {
    for (const affordance of ["run", "approve", "execute", "mutate"] as const) {
      expect(AUDIT_DISABLED_AFFORDANCES).toContain(affordance);
    }
  });
});
