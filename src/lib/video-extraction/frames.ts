import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { ingestVisionFrameDescriptor } from "@/lib/vision";
import {
  loadVisionSourceAllowlistConfig,
  type VisionSourceAllowlistLoadResult,
} from "@/lib/vision-runtime/config/source-allowlist-config";
import {
  isVisionConsentGranted,
  loadVisionStandingConsentConfig,
} from "@/lib/vision-runtime/config/standing-consent-config";

import { gateAndEmit, videoCountBand } from "./events";
import { VIDEO_EXTRACTION_VERSION } from "./workflow";

const BoundedIdSchema = z.string().trim().min(1).max(220);
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VideoFrameSamplingEventSchema = z.strictObject({
  event_type: z.literal("frame_sampling_completed"),
  event_id: BoundedIdSchema,
  session_id: BoundedIdSchema,
  source_id_hash: HashReferenceSchema,
  status: z.literal("completed"),
  // Banded per the 23C convention; exact counts live in the artifact folder.
  frame_count: z.enum(["empty", "1_to_30", "31_to_120", "over_120"]),
  max_allowed_frame_count: z.number().int().positive(),
  sampling_mode: BoundedIdSchema,
  created_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});
export type VideoFrameSamplingEvent = z.infer<
  typeof VideoFrameSamplingEventSchema
>;

export interface VideoFrameExtractionRunner {
  extractFrames(input: {
    readonly media_path: string;
    readonly destination_dir: string;
    readonly frame_sample_fps: number;
    readonly max_frames: number;
  }):
    | Promise<{ readonly frame_filenames: readonly string[] }>
    | { readonly frame_filenames: readonly string[] };
}

export interface VideoFrameRef {
  readonly filename: string;
  readonly path: string;
  readonly hash: string;
}

export interface SampleVideoFramesInput {
  readonly artifact_dir: string;
  readonly media_path: string;
  readonly session_id: string;
  readonly source_hash: string;
  readonly consent_config_path?: string;
  readonly allowlist_config_path?: string;
  readonly now_ms: number;
}

export interface SampleVideoFramesDeps {
  readonly frameRunner: VideoFrameExtractionRunner;
  readonly emitTelemetry?: (
    event: Record<string, unknown>,
  ) => void | Promise<void>;
}

export interface SampleVideoFramesResult {
  readonly status: "completed" | "refused_consent" | "failed_runner";
  readonly reasons: readonly string[];
  readonly frame_refs: readonly VideoFrameRef[];
  readonly descriptors_accepted: number;
  readonly events: readonly Record<string, unknown>[];
}

export async function sampleVideoFrames(
  input: SampleVideoFramesInput,
  deps: SampleVideoFramesDeps,
): Promise<SampleVideoFramesResult> {
  const events: Record<string, unknown>[] = [];

  // Consent gate FIRST — deny means the runner is never invoked.
  const consent = loadVisionStandingConsentConfig(input.consent_config_path);
  if (!isVisionConsentGranted(consent, "frame_sampling")) {
    return {
      status: "refused_consent",
      reasons: ["consent_denied:frame_sampling"],
      frame_refs: [],
      descriptors_accepted: 0,
      events,
    };
  }

  const allowlist: VisionSourceAllowlistLoadResult =
    loadVisionSourceAllowlistConfig(input.allowlist_config_path);
  const maxFrames = allowlist.caps.max_frames_per_video;
  const fps = allowlist.caps.frame_sample_fps;
  if (maxFrames <= 0 || fps <= 0) {
    // Fail-closed caps (missing/invalid allowlist) refuse sampling outright.
    return {
      status: "refused_consent",
      reasons: ["caps_fail_closed"],
      frame_refs: [],
      descriptors_accepted: 0,
      events,
    };
  }

  const framesDir = join(input.artifact_dir, "frames");
  await mkdir(framesDir, { recursive: true });

  let frameFilenames: readonly string[];
  try {
    const extracted = await deps.frameRunner.extractFrames({
      media_path: input.media_path,
      destination_dir: framesDir,
      frame_sample_fps: fps,
      max_frames: maxFrames,
    });
    frameFilenames = extracted.frame_filenames;
  } catch {
    return {
      status: "failed_runner",
      reasons: ["frame_extraction_failed"],
      frame_refs: [],
      descriptors_accepted: 0,
      events,
    };
  }

  // Cap enforcement is module-side regardless of runner behavior: descriptors
  // stop at the cap and excess pixel files are removed.
  const kept = frameFilenames.slice(0, maxFrames);
  const excess = frameFilenames.slice(maxFrames);
  for (const filename of excess) {
    await rm(join(framesDir, filename), { force: true });
  }

  const frameRefs: VideoFrameRef[] = [];
  let accepted = 0;
  const sourceHashSegment = input.source_hash.slice(7, 23);
  for (let index = 0; index < kept.length; index += 1) {
    const filename = kept[index] as string;
    const framePath = join(framesDir, filename);
    const body = await readFile(framePath);
    const hash = `sha256:${createHash("sha256").update(body).digest("hex")}`;
    frameRefs.push({ filename, path: framePath, hash });

    // The vision frame source-type enum is frozen (Phase 7) and has no video
    // literal; sampled video frames register as uploaded media. The video
    // input kinds added in 23A live on the vision-runtime enum, not here.
    const ingestion = ingestVisionFrameDescriptor({
      frame_id: `frame:${sourceHashSegment}:${String(index).padStart(4, "0")}`,
      vision_session_id: input.session_id,
      source_type: "uploaded_image",
      input_hash: hash,
      observed_at: input.now_ms,
      received_at: input.now_ms,
      freshness_ms: 0,
      stale_after_ms: 60_000,
      stale: false,
      current_truth: false,
      redaction_status: "metadata_only",
      failure_replay_ref: null,
      metadata_only: true,
      raw_payload_stored: false,
      advisory_only: true,
      capture_started: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
      background_job_started: false,
    });
    if (ingestion.status === "accepted") {
      accepted += 1;
    }
  }

  const event = VideoFrameSamplingEventSchema.parse({
    event_type: "frame_sampling_completed",
    event_id: `video-frames:${VIDEO_EXTRACTION_VERSION}:${sourceHashSegment}`,
    session_id: input.session_id,
    source_id_hash: input.source_hash,
    status: "completed",
    frame_count: videoCountBand(frameRefs.length),
    max_allowed_frame_count: maxFrames,
    sampling_mode: `fps_${fps}`,
    created_at_ms: input.now_ms,
    metadata_only: true,
    raw_payload_included: false,
    cloud_called: false,
    action_executed: false,
  });
  await gateAndEmit(
    event as unknown as Record<string, unknown>,
    deps.emitTelemetry,
    events,
  );

  return {
    status: "completed",
    reasons: ["frame_sampling_completed"],
    frame_refs: frameRefs,
    descriptors_accepted: accepted,
    events,
  };
}
