import { playbackSnapshot } from "./playback";
import type { DemoScript } from "./contracts";
import type { DemoNarrationTrack } from "./narration";

export const DEMO_RECORDING_TARGETS = [
  "reactor",
  "pipeline",
  "working",
  "audit",
] as const;

export type DemoRecordingTarget = (typeof DEMO_RECORDING_TARGETS)[number];

export interface DemoRecordingFrame {
  frame_id: string;
  at_ms: number;
  target: DemoRecordingTarget;
  route: "/" | "/rest" | "/audit/pipeline" | "/working" | "/audit";
  snapshot_id: string;
  metadata_only: true;
  read_only: true;
}

export interface DemoRecordingPlan {
  plan_id: string;
  script_id: string;
  audience: DemoScript["audience"];
  frames: DemoRecordingFrame[];
  audio_line_count: number;
  synchronized_timeline: true;
  screen_capture_enabled: true;
  audio_capture_enabled: true;
  camera_capture_enabled: false;
  network_upload_enabled: false;
  auto_post_enabled: false;
  execution_bypass_enabled: false;
  metadata_only: true;
}

export interface DemoRecordingManifest {
  recording_id: string;
  plan: DemoRecordingPlan;
  mp4_path: string;
  screenshot_paths: Record<DemoRecordingTarget, string>;
  transcript_path: string;
  metadata_only: true;
  local_disk_only: true;
  upload_performed: false;
  post_performed: false;
  execution_bypass_enabled: false;
}

const TARGET_ROUTES: Record<DemoRecordingTarget, DemoRecordingFrame["route"]> =
  {
    reactor: "/rest",
    pipeline: "/audit/pipeline",
    working: "/working",
    audit: "/audit",
  };

export function createDemoRecordingPlan(input: {
  script: DemoScript;
  narration?: Pick<DemoNarrationTrack, "lines">;
}): DemoRecordingPlan {
  const frames: DemoRecordingFrame[] = [];
  const slot = Math.max(1, Math.floor(input.script.total_duration_ms / 4));
  DEMO_RECORDING_TARGETS.forEach((target, index) => {
    const at_ms = Math.min(input.script.total_duration_ms, index * slot);
    const snapshot = playbackSnapshot(input.script, at_ms);
    frames.push({
      frame_id: `demo-recording-frame:${input.script.audience}:${target}`,
      at_ms,
      target,
      route: TARGET_ROUTES[target],
      snapshot_id: snapshot.snapshot_id,
      metadata_only: true,
      read_only: true,
    });
  });

  return {
    plan_id: `demo-recording-plan:${input.script.script_id}`,
    script_id: input.script.script_id,
    audience: input.script.audience,
    frames,
    audio_line_count: input.narration?.lines.length ?? 0,
    synchronized_timeline: true,
    screen_capture_enabled: true,
    audio_capture_enabled: true,
    camera_capture_enabled: false,
    network_upload_enabled: false,
    auto_post_enabled: false,
    execution_bypass_enabled: false,
    metadata_only: true,
  };
}

export function assertRecordingPlanSafe(plan: DemoRecordingPlan): void {
  if (plan.camera_capture_enabled) {
    throw new Error("Demo recording must not enable camera capture.");
  }
  if (plan.network_upload_enabled || plan.auto_post_enabled) {
    throw new Error("Demo recording must remain local-disk only.");
  }
  if (plan.execution_bypass_enabled) {
    throw new Error("Demo recording must not bypass approval authority.");
  }
}
