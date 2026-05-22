import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISION_CONTEXT_FEATURE_FLAGS,
  VISION_CONTEXT_DISABLED_FEATURES,
  VisionContextSnapshotSchema,
  VisionObservationSchema,
  assembleVisionContext,
  createVisionContextReplayStep,
  createVisionContextTelemetryEvent,
  createVisionFrameDescriptor,
  createVisionObservation,
  createVisionProviderResult,
} from "./index";

const INPUT_HASH =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OUTPUT_HASH =
  "sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

interface ObservationFixtureOptions {
  observation_id: string;
  frame_id: string;
  provider_id?: "yolo_v8n" | "tesseract" | "screen_ocr" | "developer_fixture";
  result_class?:
    | "object_detection_summary"
    | "ocr_summary"
    | "screen_context_summary"
    | "developer_fixture_summary";
  detected_count?: number | null;
  summary_count?: number | null;
  stale?: boolean;
  received_at?: number;
}

function observationFixture(options: ObservationFixtureOptions) {
  const received_at = options.received_at ?? (options.stale ? 8_500 : 1_100);
  const frame = createVisionFrameDescriptor({
    frame_id: options.frame_id,
    vision_session_id: "vision-session:context",
    source_type:
      options.result_class === "screen_context_summary"
        ? "screen_region"
        : options.result_class === "ocr_summary"
          ? "ocr_region"
          : "uploaded_image",
    input_hash: INPUT_HASH,
    observed_at: 1_000,
    received_at,
    stale_after_ms: 5_000,
  });
  return createVisionObservation({
    observation_id: options.observation_id,
    frame_descriptor: frame,
    provider_result: createVisionProviderResult({
      frame_id: options.frame_id,
      vision_session_id: "vision-session:context",
      provider_id: options.provider_id ?? "yolo_v8n",
      capability:
        options.result_class === "screen_context_summary"
          ? "screen_context"
          : options.result_class === "ocr_summary"
            ? "ocr"
            : "object_detection",
      result_class: options.result_class ?? "object_detection_summary",
      confidence: 0.84,
      output_hash: OUTPUT_HASH,
      detected_count: options.detected_count ?? 1,
      summary_count: options.summary_count ?? null,
      redaction_status: "hash_only",
    }),
  });
}

describe("Phase 7E vision context assembly", () => {
  it("bounds context by observation, class, provenance, and character caps", () => {
    const snapshot = assembleVisionContext({
      assembled_at: 2_000,
      observations: [
        observationFixture({
          observation_id: "observation:one",
          frame_id: "frame:one",
        }),
        observationFixture({
          observation_id: "observation:two",
          frame_id: "frame:two",
          provider_id: "tesseract",
          result_class: "ocr_summary",
          detected_count: null,
          summary_count: 1,
        }),
        observationFixture({
          observation_id: "observation:three",
          frame_id: "frame:three",
        }),
      ],
      caps: {
        max_observations: 2,
        max_classes: 1,
        max_provenance_entries: 1,
        max_context_chars: 120,
      },
    });

    expect(snapshot).toMatchObject({
      observation_count_input: 3,
      observation_count_included: 2,
      stale_observation_count: 0,
      truncated: true,
      metadata_only: true,
      canonical_truth: false,
      perception_authority: false,
    });
    expect(snapshot.class_summaries).toHaveLength(1);
    expect(snapshot.provenance).toHaveLength(1);
    expect(snapshot.context_block.length).toBeLessThanOrEqual(120);
  });

  it("contains only classes, counts, confidence bands, freshness, and provenance metadata", () => {
    const snapshot = assembleVisionContext({
      assembled_at: 2_000,
      observations: [
        observationFixture({
          observation_id: "observation:one",
          frame_id: "frame:one",
        }),
      ],
    });

    expect(snapshot.class_summaries).toEqual([
      {
        observation_class: "object_presence",
        count: 1,
        confidence_bands: ["high"],
      },
    ]);
    expect(snapshot.provenance).toEqual([
      {
        vision_session_id: "vision-session:context",
        frame_id: "frame:one",
        provider_id: "yolo_v8n",
        input_hash: INPUT_HASH,
        output_hash: OUTPUT_HASH,
        observation_class: "object_presence",
        confidence_band: "high",
        stale: false,
      },
    ]);
    expect(snapshot.context_block).toContain("canonical_truth=false");
    expect(snapshot.context_block).toContain("object_presence=1[high]");
  });

  it("excludes stale observations while counting them explicitly", () => {
    const snapshot = assembleVisionContext({
      assembled_at: 2_000,
      observations: [
        observationFixture({
          observation_id: "observation:fresh",
          frame_id: "frame:fresh",
        }),
        observationFixture({
          observation_id: "observation:stale",
          frame_id: "frame:stale",
          stale: true,
        }),
      ],
    });

    expect(snapshot).toMatchObject({
      observation_count_input: 2,
      observation_count_included: 1,
      stale_observation_count: 1,
      stale_policy: "excluded",
    });
    expect(snapshot.provenance.map((item) => item.frame_id)).toEqual([
      "frame:fresh",
    ]);
    expect(snapshot.context_block).toContain("stale_observations_excluded: 1");
  });

  it("rejects raw labels, OCR, screen, identity, biometric, coordinate, and path fields", () => {
    const unsafeObservation = {
      ...observationFixture({
        observation_id: "observation:unsafe",
        frame_id: "frame:unsafe",
      }),
      detected_label: "cup",
      ocr_text: "private OCR text",
      screen_text: "private screen text",
      window_title: "private window title",
      person_identity: "Alice",
      face_identity: "Alice",
      biometric_attributes: { age: "adult" },
      coordinates: [[1, 2]],
      file_path: "C:/Users/person/frame.png",
    };
    const snapshot = assembleVisionContext({
      assembled_at: 2_000,
      observations: [
        observationFixture({
          observation_id: "observation:one",
          frame_id: "frame:one",
        }),
      ],
    });

    expect(VisionObservationSchema.safeParse(unsafeObservation).success).toBe(
      false,
    );
    expect(
      VisionContextSnapshotSchema.safeParse({
        ...snapshot,
        ocr_text: "private OCR text",
        detected_label: "cup",
        person_identity: "Alice",
        coordinates: [[1, 2]],
      }).success,
    ).toBe(false);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("private OCR text");
    expect(serialized).not.toContain("cup");
    expect(serialized).not.toContain("Alice");
    expect(serialized).not.toContain("frame.png");
  });

  it("tags context as derived, advisory, non-canonical, and metadata-only", () => {
    const snapshot = assembleVisionContext({
      assembled_at: 2_000,
      observations: [
        observationFixture({
          observation_id: "observation:one",
          frame_id: "frame:one",
        }),
      ],
    });

    expect(snapshot).toMatchObject({
      derived: true,
      advisory_only: true,
      canonical_truth: false,
      perception_authority: false,
      metadata_only: true,
      raw_payload_included: false,
      text_payload_included: false,
      labels_included: false,
      identity_included: false,
      biometrics_included: false,
      coordinates_included: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
      approval_granted: false,
      background_job_started: false,
    });
  });

  it("emits telemetry with counts only", () => {
    const snapshot = assembleVisionContext({
      assembled_at: 2_000,
      observations: [
        observationFixture({
          observation_id: "observation:one",
          frame_id: "frame:one",
        }),
      ],
    });
    const event = createVisionContextTelemetryEvent(snapshot);

    expect(event).toEqual({
      event_type: "vision_context_assembled",
      observation_count_input: 1,
      observation_count_included: 1,
      stale_observation_count: 0,
      class_summary_count: 1,
      provenance_count: 1,
      truncated: false,
      metadata_only: true,
      counts_only: true,
      raw_payload_included: false,
      text_payload_included: false,
      labels_included: false,
      identity_included: false,
      biometrics_included: false,
      coordinates_included: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
    });
    expect(JSON.stringify(event)).not.toContain(INPUT_HASH);
    expect(JSON.stringify(event)).not.toContain("vision-session:context");
  });

  it("creates redacted failure replay context steps", () => {
    const snapshot = assembleVisionContext({
      assembled_at: 2_000,
      observations: [
        observationFixture({
          observation_id: "observation:one",
          frame_id: "frame:one",
        }),
      ],
    });
    const step = createVisionContextReplayStep(snapshot);

    expect(step).toEqual({
      observation_count_included: 1,
      stale_observation_count: 0,
      class_summaries: [
        {
          observation_class: "object_presence",
          count: 1,
          confidence_bands: ["high"],
        },
      ],
      provenance_count: 1,
      truncated: false,
      redaction_status: "metadata_only",
      metadata_only: true,
      raw_payload_included: false,
      text_payload_included: false,
      labels_included: false,
      identity_included: false,
      biometrics_included: false,
      coordinates_included: false,
      advisory_only: true,
      canonical_truth: false,
      perception_authority: false,
      action_executed: false,
    });
    expect(JSON.stringify(step)).not.toContain(INPUT_HASH);
    expect(JSON.stringify(step)).not.toContain("frame:one");
  });

  it("keeps context wiring, payloads, providers, cloud, actions, and jobs disabled", () => {
    expect(Object.keys(DEFAULT_VISION_CONTEXT_FEATURE_FLAGS).sort()).toEqual(
      [...VISION_CONTEXT_DISABLED_FEATURES].sort(),
    );
    for (const feature of VISION_CONTEXT_DISABLED_FEATURES) {
      expect(DEFAULT_VISION_CONTEXT_FEATURE_FLAGS[feature]).toBe(false);
    }
  });
});
