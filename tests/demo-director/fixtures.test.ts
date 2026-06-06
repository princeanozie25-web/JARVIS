import { describe, expect, it } from "vitest";

import {
  DEMO_AUDIENCES,
  DEMO_SCRIPTS,
  DEMO_SCRIPT_GENERAL,
  DEMO_SCRIPT_RECRUITER,
  DEMO_SCRIPT_SECURITY,
  DEMO_SCRIPT_TECHNICAL,
  DemoScriptSchema,
  loadDemoScript,
  sumSegmentDurations,
} from "@/lib/demo-director";

const SCRIPTS = [
  DEMO_SCRIPT_RECRUITER,
  DEMO_SCRIPT_SECURITY,
  DEMO_SCRIPT_TECHNICAL,
  DEMO_SCRIPT_GENERAL,
];

describe("DD.9 audience fixtures — coverage and schema", () => {
  it("ships exactly one fixture per declared audience", () => {
    const audiences = SCRIPTS.map((s) => s.audience).sort();
    expect(audiences).toEqual([...DEMO_AUDIENCES].sort());
  });

  it("every fixture parses through the script schema", () => {
    for (const script of SCRIPTS) {
      expect(DemoScriptSchema.safeParse(script).success).toBe(true);
    }
  });

  it("every fixture's total_duration_ms equals the sum of its segments", () => {
    for (const script of SCRIPTS) {
      expect(script.total_duration_ms).toBe(
        sumSegmentDurations(script.segments),
      );
    }
  });

  it("every fixture opens with an assembly segment", () => {
    for (const script of SCRIPTS) {
      const first = script.segments[0];
      expect(first?.kind).toBe("assembly");
      expect(first?.segment_id).toBe("segment:assembly");
    }
  });

  it("every fixture climaxes at the Human Gate", () => {
    for (const script of SCRIPTS) {
      const climaxes = script.segments.filter(
        (s) => s.kind === "human_gate_climax",
      );
      const general = script.audience === "general";
      // General script ends on a narrative beat that still routes through
      // the gate — the halt + approve cues land in its narrative segment.
      if (general) {
        const cueKinds = script.segments.flatMap((s) =>
          s.cues.map((c) => c.kind),
        );
        expect(cueKinds).toContain("halt");
        expect(cueKinds).toContain("approve");
      } else {
        expect(climaxes.length).toBeGreaterThan(0);
      }
    }
  });

  it("security fixture explicitly surfaces governance and a forbidden edge", () => {
    const cueIds = DEMO_SCRIPT_SECURITY.segments.flatMap((s) =>
      s.cues.map((c) => c.cue_id),
    );
    expect(cueIds).toContain("security:governance");
    expect(cueIds).toContain("security:forbidden_edge");
  });

  it("recruiter fixture highlights the full pipeline demo path", () => {
    const targets = DEMO_SCRIPT_RECRUITER.segments.flatMap((s) =>
      s.cues.map((c) => c.target),
    );
    for (const target of [
      "rest",
      "suggestion_inbox",
      "pipeline",
      "aux_routing",
      "council",
      "knowledge",
      "agent_coordinator",
      "/working",
      "/audit",
    ]) {
      expect(targets).toContain(target);
    }
  });

  it("technical fixture surfaces routing, aux slots, council, telemetry, and architecture", () => {
    const targets = DEMO_SCRIPT_TECHNICAL.segments.flatMap((s) =>
      s.cues.map((c) => c.target),
    );
    expect(targets).toContain("route");
    expect(targets).toContain("aux_routing");
    expect(targets).toContain("council");
    expect(targets).toContain("telemetry");
    expect(targets).toContain("/audit/pipeline");
  });

  it("general fixture ends by entering the Working result surface", () => {
    const lastSegment =
      DEMO_SCRIPT_GENERAL.segments[DEMO_SCRIPT_GENERAL.segments.length - 1];
    const lastCue = lastSegment?.cues[lastSegment.cues.length - 1];
    expect(lastCue?.kind).toBe("enter_route");
    expect(lastCue?.target).toBe("/working");
  });

  it("fixtures are deterministic — calling them twice yields identical script ids", () => {
    expect(loadDemoScript("recruiter").script_id).toBe(
      DEMO_SCRIPT_RECRUITER.script_id,
    );
    expect(loadDemoScript("not-real").script_id).toBe(
      DEMO_SCRIPT_RECRUITER.script_id,
    );
  });

  it("DEMO_SCRIPTS registry exposes all four audiences", () => {
    expect(Object.keys(DEMO_SCRIPTS).sort()).toEqual([
      "general",
      "recruiter",
      "security",
      "technical",
    ]);
  });
});
