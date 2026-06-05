import { describe, expect, it } from "vitest";

import {
  ASSEMBLY_BEATS,
  ASSEMBLY_CLIMAX_STAGE,
  ASSEMBLY_DURATION_MS,
  ASSEMBLY_STAGE_ORDER,
  DEMO_SCRIPT_GENERAL,
  DEMO_SCRIPT_RECRUITER,
  DEMO_SCRIPT_SECURITY,
  assemblyStageAt,
  playbackSnapshot,
  playbackTimeline,
} from "@/lib/demo-director";

describe("DD.10 assembly sequence — ordered awakening", () => {
  it("ASSEMBLY_STAGE_ORDER lists every stage in canonical order", () => {
    expect(ASSEMBLY_STAGE_ORDER).toEqual([
      "black",
      "orb",
      "space",
      "time",
      "mind",
      "soul",
      "reality",
      "power",
      "human_gate",
      "first_pulse",
      "complete",
    ]);
  });

  it("the Human Gate ignition is the assembly climax", () => {
    expect(ASSEMBLY_CLIMAX_STAGE).toBe("human_gate");
  });

  it("ASSEMBLY_BEATS is monotonic in at_ms", () => {
    for (let i = 1; i < ASSEMBLY_BEATS.length; i++) {
      expect(ASSEMBLY_BEATS[i]!.at_ms).toBeGreaterThan(
        ASSEMBLY_BEATS[i - 1]!.at_ms,
      );
    }
  });

  it("assemblyStageAt collapses to black for non-positive input", () => {
    expect(assemblyStageAt(-1)).toBe("black");
    expect(assemblyStageAt(0)).toBe("black");
  });

  it("assemblyStageAt collapses to complete at or past the duration", () => {
    expect(assemblyStageAt(ASSEMBLY_DURATION_MS)).toBe("complete");
    expect(assemblyStageAt(ASSEMBLY_DURATION_MS + 10_000)).toBe("complete");
  });

  it("assemblyStageAt walks every beat in order", () => {
    for (const beat of ASSEMBLY_BEATS) {
      expect(assemblyStageAt(beat.at_ms)).toBe(beat.stage);
    }
  });

  it("Human Gate ignition occurs after every stone has materialised", () => {
    const gateBeat = ASSEMBLY_BEATS.find((b) => b.stage === "human_gate")!;
    const stoneStages = [
      "orb",
      "space",
      "time",
      "mind",
      "soul",
      "reality",
      "power",
    ] as const;
    for (const stage of stoneStages) {
      const beat = ASSEMBLY_BEATS.find((b) => b.stage === stage)!;
      expect(beat.at_ms).toBeLessThan(gateBeat.at_ms);
    }
  });
});

describe("DD.10 playback snapshots — deterministic state machine", () => {
  it("elapsed_ms = 0 produces an idle snapshot with assembly_stage 'black'", () => {
    const snap = playbackSnapshot(DEMO_SCRIPT_RECRUITER, 0);
    expect(snap.state).toBe("idle");
    expect(snap.assembly_stage).toBe("black");
    expect(snap.current_segment_id).toBe("segment:assembly");
  });

  it("inside the assembly segment, state is 'assembling'", () => {
    const snap = playbackSnapshot(DEMO_SCRIPT_RECRUITER, 2200);
    expect(snap.state).toBe("assembling");
    expect(snap.assembly_stage).toBe("time");
  });

  it("after the assembly segment, state is 'playing'", () => {
    const snap = playbackSnapshot(DEMO_SCRIPT_RECRUITER, 7000);
    expect(snap.state).toBe("playing");
    expect(snap.assembly_stage).toBe("complete");
  });

  it("halt cues raise the snapshot to 'halted'", () => {
    // The recruiter climax halt sits at the start of its segment, which
    // begins at 6000 + 7200 = 13200ms into the timeline.
    const snap = playbackSnapshot(DEMO_SCRIPT_RECRUITER, 13_200);
    expect(snap.state).toBe("halted");
  });

  it("approve cues raise the snapshot to 'approved'", () => {
    // The recruiter approve cue is at 2200ms inside the climax segment
    // (13200 + 2200 = 15400).
    const snap = playbackSnapshot(DEMO_SCRIPT_RECRUITER, 15_400);
    expect(snap.state).toBe("approved");
  });

  it("deny cues raise the snapshot to 'denied'", () => {
    // The security deny cue is at 2000ms inside its climax segment.
    // Assembly (6000) + fortress (6000) = 12000, + 2000 = 14000.
    const snap = playbackSnapshot(DEMO_SCRIPT_SECURITY, 14_000);
    expect(snap.state).toBe("denied");
  });

  it("elapsed past total duration collapses to 'complete'", () => {
    const snap = playbackSnapshot(
      DEMO_SCRIPT_RECRUITER,
      DEMO_SCRIPT_RECRUITER.total_duration_ms + 5000,
    );
    expect(snap.state).toBe("complete");
  });

  it("snapshots carry the read-only contract", () => {
    const snap = playbackSnapshot(DEMO_SCRIPT_RECRUITER, 1000);
    expect(snap.metadata_only).toBe(true);
    expect(snap.read_only).toBe(true);
    expect(snap.execute_affordance_present).toBe(false);
    expect(snap.approve_affordance_present).toBe(false);
    expect(snap.mutation_affordance_present).toBe(false);
    expect(snap.recording_enabled).toBe(false);
    expect(snap.voice_enabled).toBe(false);
    expect(snap.export_enabled).toBe(false);
  });

  it("playbackTimeline yields deterministic snapshots ending at duration", () => {
    const snapshots = Array.from(playbackTimeline(DEMO_SCRIPT_GENERAL, 600));
    expect(snapshots.length).toBeGreaterThan(0);
    const last = snapshots[snapshots.length - 1]!;
    expect(last.state).toBe("complete");
    // Determinism — same script + step = identical snapshot ids.
    const again = Array.from(playbackTimeline(DEMO_SCRIPT_GENERAL, 600));
    expect(again.map((s) => s.snapshot_id)).toEqual(
      snapshots.map((s) => s.snapshot_id),
    );
  });
});
