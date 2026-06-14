import Database from "better-sqlite3";

import { describe, expect, it, vi } from "vitest";

import { validateObservabilityPayloadSafety } from "@/lib/command-center/observability-redaction";
import { applyMigrations } from "@/lib/db/schema";
import { insertTelemetryEvent, listTelemetryEvents } from "@/lib/db/telemetry";
import {
  createNarrationFailoverTelemetrySink,
  DEMO_SCRIPT_RECRUITER,
  findForbiddenTelemetryField,
  prepareDemoNarration,
  type DemoNarrationAudioCue,
  type DemoNarrationProvider,
  type DemoNarrationProviderId,
} from "@/lib/demo-director";
import type { TelemetryEvent } from "@/lib/telemetry";
import { sanitizeVisionMetadataPayload } from "@/lib/vision-runtime";
import { sanitizeVoiceTelemetryEvent } from "@/lib/voice-streaming";

type SynthMode = "ok" | "throw" | "none";

function makeProvider(
  provider_id: DemoNarrationProviderId,
  priority: number,
  ok: boolean,
  synthMode: SynthMode = ok ? "ok" : "none",
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
  if (synthMode !== "none") {
    provider.synthesize = async (line): Promise<DemoNarrationAudioCue> => {
      if (synthMode === "throw") {
        throw new Error("synth failed");
      }
      return {
        audio_id: `audio:${line.line_id}`,
        line_id: line.line_id,
        provider_id,
        duration_ms: 1000,
        mime_type: "audio/wav",
        byte_length: 32,
        local_ref: `memory:${line.line_id}`,
        metadata_only: true,
        no_auto_play: true,
        no_voice_authority: true,
      };
    };
  }
  return provider;
}

const NEW_EVENT_TYPES = [
  "voice_provider_failover",
  "voice_provider_selected",
] as const;

describe("Phase 23G-3 failover emission (I-23G3-1)", () => {
  it("emits voice_provider_failover with from/to/reason and no forbidden fields", async () => {
    const events: TelemetryEvent[] = [];
    const sink = createNarrationFailoverTelemetrySink({
      recordEvent: (event) => events.push(event),
      sessionId: "s",
    });

    await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        makeProvider("chatterbox-tts-server", 0, false),
        makeProvider("kokoro", 1, true),
      ],
      telemetry: sink,
    });

    const failover = events.find(
      (event) => event.event_type === "voice_provider_failover",
    );
    expect(failover).toBeDefined();
    expect(failover?.tool_name).toBe("chatterbox-tts-server");
    expect(failover?.error_class).toBe("health_probe_failed");
    expect(failover?.notes).toContain("to=kokoro");
    expect(
      findForbiddenTelemetryField(
        failover as unknown as Record<string, unknown>,
      ),
    ).toBeNull();
  });

  it("sentinel loop flags a planted raw-content field and clears clean payloads", () => {
    expect(
      findForbiddenTelemetryField({
        event_type: "voice_provider_failover",
        transcript: "forbidden",
      }),
    ).toBe("transcript");
    expect(
      findForbiddenTelemetryField({
        event_type: "voice_provider_failover",
        from_provider_id: "kokoro",
        chain_position: 0,
      }),
    ).toBeNull();
  });
});

describe("Phase 23G-3 sqlite persistence round-trip (I-23G3-2)", () => {
  it("persists the failover + selected events to telemetry_events", async () => {
    const db = new Database(":memory:");
    applyMigrations(db);
    const sink = createNarrationFailoverTelemetrySink({
      recordEvent: (event) => insertTelemetryEvent(db, event),
      sessionId: "round-trip",
    });

    await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        makeProvider("chatterbox-tts-server", 0, false),
        makeProvider("kokoro", 1, true),
      ],
      telemetry: sink,
    });

    const rows = listTelemetryEvents(db);
    const failoverRow = rows.find(
      (row) => row.event_type === "voice_provider_failover",
    );
    expect(failoverRow).toBeDefined();
    expect(failoverRow?.tool_name).toBe("chatterbox-tts-server");
    expect(failoverRow?.error_class).toBe("health_probe_failed");
    expect(failoverRow?.notes).toContain("to=kokoro");
    expect(
      rows.some(
        (row) =>
          row.event_type === "voice_provider_selected" &&
          row.tool_name === "kokoro",
      ),
    ).toBe(true);
    db.close();
  });
});

describe("Phase 23G-3 non-fatal on write failure (I-23G3-3)", () => {
  it("still produces audio when the telemetry write throws", async () => {
    const onError = vi.fn();
    const sink = createNarrationFailoverTelemetrySink({
      recordEvent: () => {
        throw new Error("db down");
      },
      onError,
    });

    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        makeProvider("chatterbox-tts-server", 0, false),
        makeProvider("kokoro", 1, true),
      ],
      telemetry: sink,
    });

    expect(track.provider_id).toBe("kokoro");
    expect(track.audio_cues.length).toBe(track.lines.length);
    expect(track.audio_cues.length).toBeGreaterThan(0);
    expect(onError).toHaveBeenCalled();
  });
});

describe("Phase 23G-3 terminal selection audit (I-23G3-4)", () => {
  it("emits voice_provider_selected naming the terminal provider", async () => {
    const events: TelemetryEvent[] = [];
    const sink = createNarrationFailoverTelemetrySink({
      recordEvent: (event) => events.push(event),
    });

    const track = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
      providers: [
        makeProvider("chatterbox-tts-server", 0, false),
        makeProvider("kokoro", 1, false),
        makeProvider("existing-local-fallback", 2, true),
      ],
      telemetry: sink,
    });

    expect(track.provider_id).toBe("existing-local-fallback");
    const selected = events.find(
      (event) => event.event_type === "voice_provider_selected",
    );
    expect(selected?.tool_name).toBe("existing-local-fallback");
    expect(
      events
        .filter((event) => event.event_type === "voice_provider_failover")
        .map((event) => event.tool_name),
    ).toEqual(["chatterbox-tts-server", "kokoro"]);
  });
});

describe("Phase 23G-3 three-gate sanitizer chain (I-23G3-5)", () => {
  it("passes the vision metadata gate with metadata-only payloads", () => {
    for (const eventType of NEW_EVENT_TYPES) {
      const result = sanitizeVisionMetadataPayload({
        event_type: eventType,
        metadata_only: true,
        raw_payload_included: false,
      });
      expect(result).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
    }
  });

  it("passes the voice hygiene gate and strips sentinel keys", () => {
    for (const eventType of NEW_EVENT_TYPES) {
      const clean = sanitizeVoiceTelemetryEvent({ eventType });
      expect(clean.removedKeys).toEqual([]);

      const dirty = sanitizeVoiceTelemetryEvent({
        eventType,
        transcript: "forbidden",
        rawAudio: "forbidden",
      });
      expect(dirty.removedKeys).toContain("transcript");
      expect(dirty.removedKeys).toContain("rawAudio");
    }
  });

  it("passes the observability safety gate and fails on raw field classes", () => {
    for (const eventType of NEW_EVENT_TYPES) {
      const clean = validateObservabilityPayloadSafety({
        event_type: eventType,
        status: "ok",
      });
      expect(clean.passed).toBe(true);
      expect(clean.reason).toBe("metadata_only_payload");

      const dirty = validateObservabilityPayloadSafety({
        event_type: eventType,
        raw_voice_transcript: "forbidden",
      });
      expect(dirty.passed).toBe(false);
      expect(dirty.reason).toBe("forbidden_raw_field");
    }
  });
});
