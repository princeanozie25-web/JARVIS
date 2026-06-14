import { stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import {
  isVisionConsentGranted,
  loadVisionStandingConsentConfig,
} from "@/lib/vision-runtime/config/standing-consent-config";

import {
  gateAndEmit,
  videoCountBand,
  videoDurationBand,
  type VideoCountBand,
  type VideoDurationBand,
} from "./events";
import { VIDEO_EXTRACTION_VERSION } from "./workflow";

const BoundedIdSchema = z.string().trim().min(1).max(220);
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

// Field-name notes (vision gate is a strict allowlist):
// - observation_count carries the SEGMENT-COUNT BAND (banding convention);
// - duration_band carries the audio DURATION BAND (23H: migrated off the
//   size_band stopgap now that the allowlist has a dedicated duration_band;
//   size_band stays reserved for actual byte sizes, e.g. the ingest event);
// - latency_ms is the exact STT latency, matching vision-runtime's own
//   established exact-latency usage. Exact durations/counts live on disk.
export const VideoTranscriptEventSchema = z.strictObject({
  event_type: z.literal("transcript_extraction_completed"),
  event_id: BoundedIdSchema,
  session_id: BoundedIdSchema,
  source_id_hash: HashReferenceSchema,
  status: z.literal("completed"),
  model_name: BoundedIdSchema,
  language: BoundedIdSchema.nullable(),
  latency_ms: z.number().int().nonnegative(),
  observation_count: z.enum(["empty", "1_to_30", "31_to_120", "over_120"]),
  duration_band: z.enum([
    "under_10s",
    "10s_to_60s",
    "60s_to_600s",
    "over_600s",
  ]),
  created_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});
export type VideoTranscriptEvent = z.infer<typeof VideoTranscriptEventSchema>;

export interface VideoAudioExtractionRunner {
  extractAudio(input: {
    readonly media_path: string;
    readonly destination_path: string;
  }): Promise<void> | void;
}

export interface VideoSttRequest {
  readonly request_id: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly audio: {
    readonly audio_ref: string;
    readonly mime_type: string;
    readonly duration_ms: number;
    readonly size_bytes: number;
    readonly metadata_only: true;
  };
  readonly metadata_only: true;
}

export interface VideoSttResult {
  readonly transcript: string;
  readonly language: string;
  readonly latency_ms: number;
}

export interface VideoTranscriptionProvider {
  transcribe(request: VideoSttRequest): Promise<VideoSttResult>;
}

export interface ExtractVideoTranscriptInput {
  readonly artifact_dir: string;
  readonly media_path: string;
  readonly session_id: string;
  readonly source_hash: string;
  readonly duration_seconds: number;
  readonly consent_config_path?: string;
  readonly now_ms: number;
}

export interface ExtractVideoTranscriptDeps {
  readonly audioRunner: VideoAudioExtractionRunner;
  readonly sttProvider: VideoTranscriptionProvider;
  readonly stt_model_name: string;
  readonly emitTelemetry?: (
    event: Record<string, unknown>,
  ) => void | Promise<void>;
}

export interface ExtractVideoTranscriptResult {
  readonly status: "completed" | "refused_consent" | "failed_runner";
  readonly reasons: readonly string[];
  readonly transcript_path: string | null;
  readonly segment_count_band: VideoCountBand | null;
  readonly duration_band: VideoDurationBand | null;
  readonly events: readonly Record<string, unknown>[];
}

// Sentence-ish segmentation computed in-module; the STT contract exposes no
// segment list, and the text itself never leaves the artifact folder.
export function transcriptSegmentCount(transcript: string): number {
  return transcript
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0).length;
}

export async function extractVideoTranscript(
  input: ExtractVideoTranscriptInput,
  deps: ExtractVideoTranscriptDeps,
): Promise<ExtractVideoTranscriptResult> {
  const events: Record<string, unknown>[] = [];

  // Consent gate FIRST — deny means neither runner nor provider is invoked.
  const consent = loadVisionStandingConsentConfig(input.consent_config_path);
  if (!isVisionConsentGranted(consent, "transcript_extraction")) {
    return {
      status: "refused_consent",
      reasons: ["consent_denied:transcript_extraction"],
      transcript_path: null,
      segment_count_band: null,
      duration_band: null,
      events,
    };
  }

  const audioPath = join(input.artifact_dir, "audio.wav");
  let audioSizeBytes: number;
  try {
    await deps.audioRunner.extractAudio({
      media_path: input.media_path,
      destination_path: audioPath,
    });
    audioSizeBytes = (await stat(audioPath)).size;
  } catch {
    return {
      status: "failed_runner",
      reasons: ["audio_extraction_failed"],
      transcript_path: null,
      segment_count_band: null,
      duration_band: null,
      events,
    };
  }

  const sourceHashSegment = input.source_hash.slice(7, 23);
  let transcription: VideoSttResult;
  try {
    transcription = await deps.sttProvider.transcribe({
      request_id: `video-transcript:${sourceHashSegment}`,
      session_id: input.session_id,
      turn_id: `turn:${sourceHashSegment}`,
      audio: {
        audio_ref: audioPath,
        mime_type: "audio/wav",
        duration_ms: Math.max(1, Math.round(input.duration_seconds * 1000)),
        size_bytes: audioSizeBytes,
        metadata_only: true,
      },
      metadata_only: true,
    });
  } catch {
    return {
      status: "failed_runner",
      reasons: ["transcription_failed"],
      transcript_path: null,
      segment_count_band: null,
      duration_band: null,
      events,
    };
  }

  // Transcript text exists ONLY in the artifact folder from here on.
  const transcriptPath = join(input.artifact_dir, "transcript.md");
  await writeFile(transcriptPath, `${transcription.transcript}\n`, "utf8");

  const segmentBand = videoCountBand(
    transcriptSegmentCount(transcription.transcript),
  );
  const durationBand = videoDurationBand(input.duration_seconds);

  const event = VideoTranscriptEventSchema.parse({
    event_type: "transcript_extraction_completed",
    event_id: `video-transcript:${VIDEO_EXTRACTION_VERSION}:${sourceHashSegment}`,
    session_id: input.session_id,
    source_id_hash: input.source_hash,
    status: "completed",
    model_name: deps.stt_model_name,
    language: transcription.language || null,
    latency_ms: Math.max(0, Math.round(transcription.latency_ms)),
    observation_count: segmentBand,
    duration_band: durationBand,
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
    reasons: ["transcript_extraction_completed"],
    transcript_path: transcriptPath,
    segment_count_band: segmentBand,
    duration_band: durationBand,
    events,
  };
}
