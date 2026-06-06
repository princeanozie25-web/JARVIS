import { describe, expect, it } from "vitest";

import {
  DemoCueSchema,
  DemoProposalSchema,
  DemoScriptSchema,
  DemoSegmentSchema,
  parseDemoScript,
  sumSegmentDurations,
} from "@/lib/demo-director";

const cue = {
  cue_id: "test:cue",
  at_ms: 100,
  kind: "pulse",
  metadata_only: true,
  read_only: true,
} as const;

const segment = {
  segment_id: "test:segment",
  kind: "narrative",
  label: "Segment",
  description: "Test segment.",
  duration_ms: 1000,
  cues: [cue],
  metadata_only: true,
  read_only: true,
} as const;

const script = {
  script_id: "demo:test",
  audience: "recruiter",
  title: "Test script",
  subtitle: "For tests only.",
  total_duration_ms: 1000,
  segments: [segment],
  showcased_zones: ["pipeline"],
  metadata_only: true,
  read_only: true,
  recording_enabled: true,
  voice_enabled: true,
  export_enabled: true,
  narration_enabled: true,
  ffmpeg_enabled: false,
} as const;

describe("DD.9 schemas — accept valid envelopes", () => {
  it("accepts a minimal cue", () => {
    expect(DemoCueSchema.safeParse(cue).success).toBe(true);
  });

  it("accepts a minimal segment", () => {
    expect(DemoSegmentSchema.safeParse(segment).success).toBe(true);
  });

  it("accepts a minimal script", () => {
    expect(DemoScriptSchema.safeParse(script).success).toBe(true);
  });

  it("accepts a proposal wrapping a valid script", () => {
    const proposal = {
      proposal_id: "demo-proposal:recruiter:0",
      audience: "recruiter",
      status: "proposed",
      script,
      proposed_at_ms: 0,
      metadata_only: true,
      read_only: true,
    } as const;
    expect(DemoProposalSchema.safeParse(proposal).success).toBe(true);
  });

  it("derives total_duration_ms with sumSegmentDurations", () => {
    expect(
      sumSegmentDurations([{ duration_ms: 100 }, { duration_ms: 200 }]),
    ).toBe(300);
  });
});

describe("DD.9 schemas — reject violations of read-only contract", () => {
  it("rejects narration_enabled: false", () => {
    const bad = { ...script, narration_enabled: false } as unknown;
    expect(DemoScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects recording_enabled: false", () => {
    const bad = { ...script, recording_enabled: false } as unknown;
    expect(DemoScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects voice_enabled: false", () => {
    const bad = { ...script, voice_enabled: false } as unknown;
    expect(DemoScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects export_enabled: false", () => {
    const bad = { ...script, export_enabled: false } as unknown;
    expect(DemoScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects ffmpeg_enabled: true", () => {
    const bad = { ...script, ffmpeg_enabled: true } as unknown;
    expect(DemoScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects metadata_only: false", () => {
    const bad = { ...script, metadata_only: false } as unknown;
    expect(DemoScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown audience", () => {
    const bad = { ...script, audience: "marketing" } as unknown;
    expect(DemoScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown cue kind", () => {
    const bad = { ...cue, kind: "execute_action" } as unknown;
    expect(DemoCueSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects segments with empty cues", () => {
    const bad = { ...segment, cues: [] } as unknown;
    expect(DemoSegmentSchema.safeParse(bad).success).toBe(false);
  });

  it("parseDemoScript throws on invalid input", () => {
    expect(() =>
      parseDemoScript({ ...script, audience: "marketing" }),
    ).toThrow();
  });
});
