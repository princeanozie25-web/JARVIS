import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildVoicePipelineVisibilityModel } from "@/lib/voice-operating-mode/pipeline-visibility";

import { buildPipelineViewModel, PIPELINE_STAGE_IDS } from "./contracts";
import {
  buildLaneViewModel,
  LANE_GENERIC_STAGE,
  PIPELINE_LANES,
  PipelineLaneSchema,
  VISION_LANE_EVENT_MAPPING,
  VISION_LANE_STAGE_IDS,
} from "./lane-registry";

const FORBIDDEN_SENTINELS = [
  "transcript",
  "ocr_text",
  "base64",
  "raw_image",
] as const;

const VOICE_LANE = PIPELINE_LANES[0];
const VISION_LANE = PIPELINE_LANES[1];

describe("Phase 23B lane schema (I-23B-2, I-23B-4)", () => {
  it("registers exactly the voice and vision lanes", () => {
    expect(PIPELINE_LANES.map((lane) => lane.lane_id)).toEqual([
      "voice",
      "vision",
    ]);
  });

  it("rejects payload-bearing sentinel fields on the lane schema", () => {
    for (const sentinel of FORBIDDEN_SENTINELS) {
      const verdict = PipelineLaneSchema.safeParse({
        ...VISION_LANE,
        [sentinel]: "forbidden",
      });
      expect(verdict.success).toBe(false);
    }
  });

  it("rejects a mapping that targets an unknown stage", () => {
    const verdict = PipelineLaneSchema.safeParse({
      ...VISION_LANE,
      event_type_mapping: { video_ingest_requested: "not_a_stage" },
    });
    expect(verdict.success).toBe(false);
  });

  it("declares zero affordances on every lane and view model", () => {
    for (const lane of PIPELINE_LANES) {
      expect(lane.read_only).toBe(true);
      expect(lane.execute_affordance_present).toBe(false);
      expect(lane.approve_affordance_present).toBe(false);
      expect(lane.mutation_affordance_present).toBe(false);

      const viewModel = buildLaneViewModel(lane);
      expect(viewModel.controls).toEqual([]);
      expect(viewModel.read_only).toBe(true);
      expect(viewModel.execute_affordance_present).toBe(false);
      expect(viewModel.approve_affordance_present).toBe(false);
      expect(viewModel.mutation_affordance_present).toBe(false);

      const serialized = JSON.stringify(viewModel);
      expect(serialized).not.toContain("onClick");
      expect(serialized).not.toContain("executeButton");
      expect(serialized).not.toContain("approveButton");
    }
  });

  it("maps every vision event type to a real stage or the generic marker", () => {
    for (const stage of Object.values(VISION_LANE_EVENT_MAPPING)) {
      expect([...VISION_LANE_STAGE_IDS, LANE_GENERIC_STAGE]).toContain(stage);
    }
  });

  it("keeps the vision mapping total against the telemetry union source", () => {
    const source = readFileSync("src/lib/telemetry/types.ts", "utf8");
    for (const eventType of Object.keys(VISION_LANE_EVENT_MAPPING)) {
      expect(source).toContain(`"${eventType}"`);
    }
  });

  it("routes generic vision_lane_event by its carried stage and drops unknowns", () => {
    const routed = buildLaneViewModel(VISION_LANE, [
      { event_type: "vision_lane_event", reason: "frames" },
    ]);
    expect(routed.items).toHaveLength(1);
    expect(routed.items[0]?.stage_id).toBe("frames");
    expect(routed.synthetic_fixture).toBe(false);

    const dropped = buildLaneViewModel(VISION_LANE, [
      { event_type: "vision_lane_event", reason: "bogus_stage" },
    ]);
    expect(dropped.items).toHaveLength(0);
  });

  it("maps observed vision events onto lane stages", () => {
    const viewModel = buildLaneViewModel(VISION_LANE, [
      { event_type: "video_ingest_completed" },
      { event_type: "frame_sampling_completed" },
      { event_type: "multimodal_analysis_completed" },
    ]);
    expect(
      viewModel.stages
        .filter((stage) => stage.observed)
        .map((stage) => stage.stage_id),
    ).toEqual(["capture", "frames", "result"]);
  });

  it("renders a deterministic at-rest fixture", () => {
    const first = buildLaneViewModel(VISION_LANE);
    const second = buildLaneViewModel(VISION_LANE);
    expect(first).toEqual(second);
    expect(first.synthetic_fixture).toBe(true);
    expect(first.items.map((item) => item.stage_id)).toEqual([
      ...VISION_LANE_STAGE_IDS,
    ]);
  });
});

describe("Phase 23B voice lane golden parity (I-23B-3)", () => {
  it("preserves the pre-migration stage ids, labels, tiers, and states", () => {
    const preMigration = buildVoicePipelineVisibilityModel();
    const migrated = buildLaneViewModel(VOICE_LANE);

    expect(migrated.stages.map((stage) => stage.stage_id)).toEqual(
      preMigration.events.map((event) => event.kind),
    );
    expect(
      migrated.items.map((item) => ({
        kind: item.kind,
        tier: item.tier,
        state: item.state,
        label: item.label,
      })),
    ).toEqual(
      preMigration.events.map((event) => ({
        kind: event.kind,
        tier: event.tier,
        state: event.state,
        label: event.label,
      })),
    );
    expect(migrated.authoritative_surface).toBe(
      preMigration.authoritative_surface,
    );
    for (const item of migrated.items) {
      expect(item.raw_audio_included).toBe(false);
      expect(item.transcript_included).toBe(false);
      expect(item.executable_payload_included).toBe(false);
    }
  });
});

describe("Phase 23B spine byte-freeze (I-23B-1)", () => {
  // PIPELINE_STAGES/TRANSITIONS/BOUNDARIES are intentionally unexported from
  // contracts.ts and adding exports would itself be a spine edit, so this
  // snapshot asserts through the spine's only public projection
  // (PIPELINE_STAGE_IDS + buildPipelineViewModel) against explicit copies.
  it("keeps the six stage ids byte-identical", () => {
    expect([...PIPELINE_STAGE_IDS]).toEqual([
      "capture",
      "classify",
      "route",
      "human_gate",
      "execute",
      "audit",
    ]);
  });

  it("keeps the stage labels byte-identical", () => {
    const viewModel = buildPipelineViewModel();
    expect(
      viewModel.stages.map((stage) => ({
        stage_id: stage.stage_id,
        label: stage.label,
      })),
    ).toEqual([
      { stage_id: "capture", label: "Capture" },
      { stage_id: "classify", label: "Classify" },
      { stage_id: "route", label: "Route" },
      { stage_id: "human_gate", label: "Human Gate" },
      { stage_id: "execute", label: "Execute" },
      { stage_id: "audit", label: "Audit" },
    ]);
  });

  it("keeps all nine transitions including the four forbidden edges", () => {
    const viewModel = buildPipelineViewModel();
    expect(viewModel.edges).toHaveLength(9);
    expect(
      viewModel.edges
        .filter((edge) => edge.policy === "forbidden")
        .map((edge) => ({
          transition_id: edge.transition_id,
          from: edge.from_stage_id,
          to: edge.to_stage_id,
        })),
    ).toEqual([
      {
        transition_id: "pipeline-transition:capture-to-execute-forbidden",
        from: "capture",
        to: "execute",
      },
      {
        transition_id: "pipeline-transition:classify-to-execute-forbidden",
        from: "classify",
        to: "execute",
      },
      {
        transition_id: "pipeline-transition:route-to-execute-forbidden",
        from: "route",
        to: "execute",
      },
      {
        transition_id: "pipeline-transition:graphify-to-execute-forbidden",
        from: "audit",
        to: "execute",
      },
    ]);
  });

  it("keeps the spine view-model affordances closed", () => {
    const viewModel = buildPipelineViewModel();
    expect(viewModel.controls).toEqual([]);
    expect(viewModel.read_only).toBe(true);
    expect(viewModel.execute_affordance_present).toBe(false);
    expect(viewModel.approve_affordance_present).toBe(false);
    expect(viewModel.mutation_affordance_present).toBe(false);
  });
});
