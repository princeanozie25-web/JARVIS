import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validateObservabilityPayloadSafety } from "../../src/lib/command-center/observability-redaction";
import type { TelemetryEventType } from "../../src/lib/telemetry/types";
import {
  sanitizeVisionMetadataPayload,
  VISION_INPUT_KINDS,
} from "../../src/lib/vision-runtime";
import { sanitizeVoiceTelemetryEvent } from "../../src/lib/voice-streaming";

// Typed against the union: membership of every new literal is proven at
// compile time; the runtime assertions below cover behavior.
const PHASE23_EVENT_TYPES: readonly TelemetryEventType[] = [
  "video_ingest_requested",
  "video_ingest_completed",
  "video_ingest_failed",
  "frame_sampling_completed",
  "transcript_extraction_completed",
  "multimodal_packet_assembled",
  "multimodal_analysis_completed",
  "vision_lane_event",
] as const;

const FORBIDDEN_SENTINELS = [
  "transcript",
  "ocr_text",
  "base64",
  "raw_image",
] as const;

const ORIGINAL_VISION_INPUT_KINDS = [
  "screenshot",
  "mock_camera_frame",
  "real_camera_frame",
] as const;

describe("Phase 23A telemetry event types (I-23A-3)", () => {
  it("passes the vision metadata gate with metadata-only payloads", () => {
    for (const eventType of PHASE23_EVENT_TYPES) {
      const result = sanitizeVisionMetadataPayload({
        event_type: eventType,
        metadata_only: true,
        raw_payload_included: false,
      });

      expect(result).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
        metadata_only: true,
      });
    }
  });

  it("rejects every forbidden sentinel field for every new event type", () => {
    for (const eventType of PHASE23_EVENT_TYPES) {
      for (const sentinel of FORBIDDEN_SENTINELS) {
        const result = sanitizeVisionMetadataPayload({
          event_type: eventType,
          metadata_only: true,
          raw_payload_included: false,
          [sentinel]: "forbidden",
        });

        expect(result).toMatchObject({
          ok: false,
          reason: "forbidden_field",
          redaction_status: "withheld",
        });
      }
    }
  });

  it("passes the voice hygiene gate and strips sentinel keys", () => {
    for (const eventType of PHASE23_EVENT_TYPES) {
      const clean = sanitizeVoiceTelemetryEvent({ eventType });
      expect(clean.removedKeys).toEqual([]);
      expect((clean.event as { eventType?: string }).eventType).toBe(eventType);

      const dirty = sanitizeVoiceTelemetryEvent({
        eventType,
        transcript: "forbidden",
        ocr_text: "forbidden",
        base64: "forbidden",
        raw_image: "forbidden",
      });
      for (const sentinel of FORBIDDEN_SENTINELS) {
        expect(dirty.removedKeys).toContain(sentinel);
      }
    }
  });

  it("passes the observability safety gate and fails on raw field classes", () => {
    for (const eventType of PHASE23_EVENT_TYPES) {
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

describe("Phase 23A additive-only schema extensions (I-23A-4)", () => {
  it("keeps the original VISION_INPUT_KINDS literals byte-identical and in order", () => {
    expect(VISION_INPUT_KINDS.slice(0, 3)).toEqual([
      ...ORIGINAL_VISION_INPUT_KINDS,
    ]);
    expect(VISION_INPUT_KINDS).toEqual([
      ...ORIGINAL_VISION_INPUT_KINDS,
      "video_frame",
      "video_segment",
    ]);
  });

  it("appends the new telemetry literals after the original union tail", () => {
    const source = readFileSync("src/lib/telemetry/types.ts", "utf8");

    const originalCanaries = [
      '"validation_failure"',
      '"model_call"',
      '"provider_error"',
      '"voice_privacy_policy_unknown_payload"',
    ];
    for (const canary of originalCanaries) {
      expect(source).toContain(canary);
    }

    const originalTail = source.indexOf(
      '"voice_privacy_policy_unknown_payload"',
    );
    for (const eventType of PHASE23_EVENT_TYPES) {
      const index = source.indexOf(`"${eventType}"`);
      expect(index).toBeGreaterThan(originalTail);
    }
  });
});
