import { z } from "zod";

import type { TelemetryEventType } from "@/lib/telemetry/types";
import { buildVoicePipelineVisibilityModel } from "@/lib/voice-operating-mode/pipeline-visibility";

// Phase 23B (E-002): a lane is a data-defined, read-only visualization of a
// capability's journey beneath the six-stage spine. The spine itself
// (PIPELINE_STAGE_IDS/STAGES/TRANSITIONS/BOUNDARIES) is byte-frozen — lanes
// never add spine stages. Lanes render from passed-in metadata-only events or
// from a deterministic synthetic fixture; there is no live subscription.

export const PIPELINE_LANE_IDS = ["voice", "vision"] as const;
export type PipelineLaneId = (typeof PIPELINE_LANE_IDS)[number];

const BoundedIdSchema = z.string().trim().min(1).max(120);
const BoundedTextSchema = z.string().trim().min(1).max(220);

// "generic" mapping value: the event carries its own lane stage in its
// metadata `reason` field; values are validated against stage_ids at
// view-model build time and unknown stages are dropped (fail closed).
export const LANE_GENERIC_STAGE = "generic" as const;

export const PipelineLaneSchema = z
  .strictObject({
    lane_id: z.enum(PIPELINE_LANE_IDS),
    label: BoundedTextSchema,
    stage_ids: z.array(BoundedIdSchema).min(1),
    stage_labels: z.record(BoundedIdSchema, BoundedTextSchema),
    event_type_mapping: z.record(BoundedIdSchema, BoundedIdSchema),
    read_only: z.literal(true),
    execute_affordance_present: z.literal(false),
    approve_affordance_present: z.literal(false),
    mutation_affordance_present: z.literal(false),
  })
  .superRefine((lane, ctx) => {
    for (const [eventType, stage] of Object.entries(lane.event_type_mapping)) {
      if (stage !== LANE_GENERIC_STAGE && !lane.stage_ids.includes(stage)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `event_type_mapping["${eventType}"] targets unknown stage "${stage}"`,
          path: ["event_type_mapping", eventType],
        });
      }
    }
  });

export type PipelineLane = z.infer<typeof PipelineLaneSchema>;

export interface PipelineLaneItem {
  readonly item_id: string;
  readonly kind: string;
  readonly stage_id: string;
  readonly state: string;
  readonly tier: string | null;
  readonly label: string;
  readonly metadata_only: true;
  readonly raw_audio_included: false;
  readonly transcript_included: false;
  readonly executable_payload_included: false;
}

export interface PipelineLaneStageView {
  readonly stage_id: string;
  readonly label: string;
  readonly observed: boolean;
}

export interface PipelineLaneViewModel {
  readonly lane_id: PipelineLaneId;
  readonly label: string;
  readonly authoritative_surface: "/audit/pipeline";
  readonly stages: readonly PipelineLaneStageView[];
  readonly items: readonly PipelineLaneItem[];
  readonly synthetic_fixture: boolean;
  readonly controls: never[];
  readonly read_only: true;
  readonly metadata_only: true;
  readonly execute_affordance_present: false;
  readonly approve_affordance_present: false;
  readonly mutation_affordance_present: false;
}

export interface PipelineLaneObservedEvent {
  readonly event_type: TelemetryEventType;
  readonly reason?: string | null;
}

// Voice lane: stages, labels, and at-rest items are lifted verbatim from the
// Phase 22 visibility model so the migrated renderer preserves the exact
// pre-migration semantics (golden-parity tested). The builder stays the
// single source of truth and therefore remains referenced.
const VOICE_VISIBILITY_MODEL = buildVoicePipelineVisibilityModel();

// Today's voice section consumes no TelemetryEvents (synthetic fixture only),
// so its event mapping is intentionally empty.
const VOICE_LANE = PipelineLaneSchema.parse({
  lane_id: "voice",
  label: "Voice",
  stage_ids: VOICE_VISIBILITY_MODEL.events.map((event) => event.kind),
  stage_labels: Object.fromEntries(
    VOICE_VISIBILITY_MODEL.events.map((event) => [event.kind, event.label]),
  ),
  event_type_mapping: {},
  read_only: true,
  execute_affordance_present: false,
  approve_affordance_present: false,
  mutation_affordance_present: false,
});

export const VISION_LANE_STAGE_IDS = [
  "capture",
  "frames",
  "transcript",
  "analysis",
  "result",
] as const;

// `satisfies` gives compile-time totality: every key must be a member of the
// TelemetryEventType union. The runtime test re-checks against source.
export const VISION_LANE_EVENT_MAPPING = {
  video_ingest_requested: "capture",
  video_ingest_completed: "capture",
  video_ingest_failed: "capture",
  frame_sampling_completed: "frames",
  transcript_extraction_completed: "transcript",
  multimodal_packet_assembled: "analysis",
  multimodal_analysis_completed: "result",
  vision_lane_event: LANE_GENERIC_STAGE,
} as const satisfies Partial<Record<TelemetryEventType, string>>;

const VISION_LANE = PipelineLaneSchema.parse({
  lane_id: "vision",
  label: "Vision",
  stage_ids: [...VISION_LANE_STAGE_IDS],
  stage_labels: {
    capture: "Capture",
    frames: "Frames",
    transcript: "Transcript",
    analysis: "Analysis",
    result: "Result",
  },
  event_type_mapping: VISION_LANE_EVENT_MAPPING,
  read_only: true,
  execute_affordance_present: false,
  approve_affordance_present: false,
  mutation_affordance_present: false,
});

export const PIPELINE_LANES: readonly PipelineLane[] = Object.freeze([
  VOICE_LANE,
  VISION_LANE,
]);

function laneItem(input: {
  readonly item_id: string;
  readonly kind: string;
  readonly stage_id: string;
  readonly state: string;
  readonly tier: string | null;
  readonly label: string;
}): PipelineLaneItem {
  return {
    ...input,
    metadata_only: true,
    raw_audio_included: false,
    transcript_included: false,
    executable_payload_included: false,
  };
}

function atRestItems(lane: PipelineLane): readonly PipelineLaneItem[] {
  if (lane.lane_id === "voice") {
    return VOICE_VISIBILITY_MODEL.events.map((event) =>
      laneItem({
        item_id: event.event_id,
        kind: event.kind,
        stage_id: event.kind,
        state: event.state,
        tier: event.tier,
        label: event.label,
      }),
    );
  }
  return lane.stage_ids.map((stageId) =>
    laneItem({
      item_id: `lane-${lane.lane_id}-${stageId}-at-rest`,
      kind: "at_rest",
      stage_id: stageId,
      state: "at_rest",
      tier: null,
      label: lane.stage_labels[stageId] ?? stageId,
    }),
  );
}

function observedItems(
  lane: PipelineLane,
  events: readonly PipelineLaneObservedEvent[],
): readonly PipelineLaneItem[] {
  const items: PipelineLaneItem[] = [];
  events.forEach((event, index) => {
    const mapped = lane.event_type_mapping[event.event_type];
    if (!mapped) {
      return;
    }
    const stageId =
      mapped === LANE_GENERIC_STAGE
        ? event.reason && lane.stage_ids.includes(event.reason)
          ? event.reason
          : null
        : mapped;
    if (!stageId) {
      return; // generic event with an unknown stage: dropped, fail closed
    }
    items.push(
      laneItem({
        item_id: `lane-${lane.lane_id}-${event.event_type}-${index}`,
        kind: event.event_type,
        stage_id: stageId,
        state: "observed",
        tier: null,
        label: lane.stage_labels[stageId] ?? stageId,
      }),
    );
  });
  return items;
}

// Pure and deterministic: same lane + same events => deep-equal view model.
// Mirrors buildPipelineViewModel's affordance guarantees.
export function buildLaneViewModel(
  laneInput: PipelineLane,
  events?: readonly PipelineLaneObservedEvent[],
): PipelineLaneViewModel {
  const lane = PipelineLaneSchema.parse(laneInput);
  const observing = Boolean(events && events.length > 0);
  const items = observing
    ? observedItems(lane, events as readonly PipelineLaneObservedEvent[])
    : atRestItems(lane);

  return {
    lane_id: lane.lane_id,
    label: lane.label,
    authoritative_surface: "/audit/pipeline",
    stages: lane.stage_ids.map((stageId) => ({
      stage_id: stageId,
      label: lane.stage_labels[stageId] ?? stageId,
      observed: observing && items.some((item) => item.stage_id === stageId),
    })),
    items,
    synthetic_fixture: !observing,
    controls: [],
    read_only: true,
    metadata_only: true,
    execute_affordance_present: false,
    approve_affordance_present: false,
    mutation_affordance_present: false,
  };
}
