import {
  completeVisionSession,
  createVisionSessionTelemetryEvent,
  expireVisionSession,
  failVisionSession,
  requestVisionSession,
  startVisionSession,
  type VisionSessionRecord,
} from "@/lib/vision";

import {
  sampleVideoFrames,
  type SampleVideoFramesResult,
  type VideoFrameExtractionRunner,
} from "./frames";
import {
  assembleMultimodalPacket,
  type MultimodalAnalysisPacket,
} from "./packet";
import {
  extractVideoTranscript,
  type ExtractVideoTranscriptResult,
  type VideoAudioExtractionRunner,
  type VideoTranscriptionProvider,
} from "./transcript";
import {
  executeVideoIngest,
  hashVideoSource,
  type VideoFfprobeRunner,
  type VideoIngestResult,
  type VideoIngestSourceRequest,
  type VideoVersionProbe,
  type VideoYtdlpRunner,
} from "./workflow";

export type VideoPipelineStatus =
  | "completed"
  | "refused_session_occupancy"
  | "expired"
  | "ingest_not_completed"
  | "frames_not_completed"
  | "transcript_not_completed";

export interface VideoPipelineRequest {
  readonly source: VideoIngestSourceRequest;
  readonly explicit_user_triggered: true;
  readonly consent_config_path?: string;
  readonly allowlist_config_path?: string;
  readonly artifact_root?: string;
  readonly session_id?: string;
  readonly session_surface?: "chat" | "voice" | "developer_test";
  readonly existing_sessions?: VisionSessionRecord[];
  readonly deadline_ms?: number;
  readonly model_tier?: "T3" | "T4";
}

export interface VideoPipelineDependencies {
  readonly versionProbe: VideoVersionProbe;
  readonly ytdlpRunner?: VideoYtdlpRunner;
  readonly ffprobeRunner: VideoFfprobeRunner;
  readonly frameRunner: VideoFrameExtractionRunner;
  readonly audioRunner: VideoAudioExtractionRunner;
  readonly sttProvider: VideoTranscriptionProvider;
  readonly stt_model_name: string;
  readonly emitTelemetry?: (
    event: Record<string, unknown>,
  ) => void | Promise<void>;
  readonly clockNow?: () => number;
}

export interface VideoPipelineResult {
  readonly status: VideoPipelineStatus;
  readonly reasons: readonly string[];
  readonly session: VisionSessionRecord;
  readonly source_hash: string;
  readonly artifact_dir: string | null;
  readonly artifacts_retained: boolean;
  readonly ingest: VideoIngestResult | null;
  readonly frames: SampleVideoFramesResult | null;
  readonly transcript: ExtractVideoTranscriptResult | null;
  readonly packet: MultimodalAnalysisPacket | null;
  readonly packet_path: string | null;
  readonly events: readonly Record<string, unknown>[];
}

// The whole ingest -> frames -> transcript -> packet run executes inside one
// vision session (single occupancy enforced by the Phase 7 scaffold). Session
// lifecycle events are built by createVisionSessionTelemetryEvent and are
// guaranteed metadata-only by the scaffold's own schema; they intentionally
// bypass the stage-event allowlist gate (session_id_hash is not an
// allowlisted stage-event field). The three 23D stage events DO pass the
// strict allowlist gate inside their modules.
export async function executeVideoPipeline(
  request: VideoPipelineRequest,
  deps: VideoPipelineDependencies,
): Promise<VideoPipelineResult> {
  if (request.explicit_user_triggered !== true) {
    throw new Error("Video pipeline requires an explicit user trigger.");
  }
  const clock = deps.clockNow ?? (() => Date.now());
  const rawSource =
    request.source.kind === "url" ? request.source.url : request.source.path;
  const sourceHash = hashVideoSource(rawSource);
  const sessionId =
    request.session_id ?? `video:pipeline:${sourceHash.slice(7, 23)}`;
  const events: Record<string, unknown>[] = [];

  async function emitLifecycle(
    session: VisionSessionRecord,
    eventType:
      | "vision_session_requested"
      | "vision_session_started"
      | "vision_session_failed"
      | "vision_session_completed"
      | "vision_session_expired"
      | "vision_session_denied",
  ): Promise<void> {
    const event = createVisionSessionTelemetryEvent({
      session,
      event_type: eventType,
      session_id_hash: hashVideoSource(session.session_id),
    });
    events.push(event as unknown as Record<string, unknown>);
    await deps.emitTelemetry?.(event as unknown as Record<string, unknown>);
  }

  function deadlineReached(): boolean {
    return request.deadline_ms !== undefined && clock() >= request.deadline_ms;
  }

  let session = requestVisionSession({
    session_id: sessionId,
    requested_input_type: "uploaded_image",
    surface: request.session_surface ?? "developer_test",
    requested_at: clock(),
    existing_sessions: request.existing_sessions,
  });
  await emitLifecycle(session, "vision_session_requested");

  if (session.state === "denied") {
    await emitLifecycle(session, "vision_session_denied");
    return result(
      "refused_session_occupancy",
      ["single_active_session_denied"],
      {
        session,
        artifacts_retained: false,
      },
    );
  }

  session = startVisionSession({ session, now_ms: clock() });
  await emitLifecycle(session, "vision_session_started");

  // Stage 1: ingest (23C).
  const ingest = await executeVideoIngest(
    {
      source: request.source,
      explicit_user_triggered: true,
      consent_config_path: request.consent_config_path,
      allowlist_config_path: request.allowlist_config_path,
      artifact_root: request.artifact_root,
      now_ms: clock(),
    },
    {
      versionProbe: deps.versionProbe,
      ytdlpRunner: deps.ytdlpRunner,
      ffprobeRunner: deps.ffprobeRunner,
      emitTelemetry: async (event) => {
        events.push(event as unknown as Record<string, unknown>);
        await deps.emitTelemetry?.(event as unknown as Record<string, unknown>);
      },
    },
  );
  if (ingest.status !== "completed" || !ingest.manifest) {
    session = failVisionSession({ session, now_ms: clock() });
    await emitLifecycle(session, "vision_session_failed");
    return result("ingest_not_completed", [...ingest.reasons], {
      session,
      ingest,
      artifacts_retained: ingest.artifact_dir_present,
    });
  }
  const artifactDir = ingest.artifact_dir as string;
  const manifestPath = `${artifactDir}/manifest.json`;

  if (deadlineReached()) {
    return await expire({ session, ingest, artifactDir });
  }

  // Stage 2: frames.
  const frames = await sampleVideoFrames(
    {
      artifact_dir: artifactDir,
      media_path: `${artifactDir}/${ingest.manifest.media_filename}`,
      session_id: sessionId,
      source_hash: sourceHash,
      consent_config_path: request.consent_config_path,
      allowlist_config_path: request.allowlist_config_path,
      now_ms: clock(),
    },
    { frameRunner: deps.frameRunner, emitTelemetry: collect },
  );
  if (frames.status !== "completed") {
    session = failVisionSession({ session, now_ms: clock() });
    await emitLifecycle(session, "vision_session_failed");
    return result("frames_not_completed", [...frames.reasons], {
      session,
      ingest,
      frames,
      artifacts_retained: true,
    });
  }

  if (deadlineReached()) {
    return await expire({ session, ingest, frames, artifactDir });
  }

  // Stage 3: transcript.
  const transcript = await extractVideoTranscript(
    {
      artifact_dir: artifactDir,
      media_path: `${artifactDir}/${ingest.manifest.media_filename}`,
      session_id: sessionId,
      source_hash: sourceHash,
      duration_seconds: ingest.manifest.duration_seconds,
      consent_config_path: request.consent_config_path,
      now_ms: clock(),
    },
    {
      audioRunner: deps.audioRunner,
      sttProvider: deps.sttProvider,
      stt_model_name: deps.stt_model_name,
      emitTelemetry: collect,
    },
  );
  if (transcript.status !== "completed") {
    session = failVisionSession({ session, now_ms: clock() });
    await emitLifecycle(session, "vision_session_failed");
    return result("transcript_not_completed", [...transcript.reasons], {
      session,
      ingest,
      frames,
      transcript,
      artifacts_retained: true,
    });
  }

  if (deadlineReached()) {
    return await expire({ session, ingest, frames, transcript, artifactDir });
  }

  // Stage 4: packet.
  const packetResult = await assembleMultimodalPacket(
    {
      artifact_dir: artifactDir,
      session_id: sessionId,
      source_hash: sourceHash,
      manifest_path: manifestPath,
      frame_refs: frames.frame_refs,
      transcript_path: transcript.transcript_path,
      model_tier: request.model_tier,
      now_ms: clock(),
    },
    { emitTelemetry: collect },
  );

  session = completeVisionSession({ session, now_ms: clock() });
  await emitLifecycle(session, "vision_session_completed");

  return result("completed", ["pipeline_completed"], {
    session,
    ingest,
    frames,
    transcript,
    packet: packetResult.packet,
    packet_path: packetResult.packet_path,
    artifacts_retained: true,
  });

  async function collect(event: Record<string, unknown>): Promise<void> {
    events.push(event);
    await deps.emitTelemetry?.(event);
  }

  async function expire(state: {
    session: VisionSessionRecord;
    ingest?: VideoIngestResult;
    frames?: SampleVideoFramesResult;
    transcript?: ExtractVideoTranscriptResult;
    artifactDir: string;
  }): Promise<VideoPipelineResult> {
    // Session expired mid-run: halt the pipeline, RETAIN artifacts produced
    // so far, emit the expired lifecycle event, produce no packet.
    const expired = expireVisionSession({
      session: state.session,
      now_ms: clock(),
    });
    await emitLifecycle(expired, "vision_session_expired");
    return result("expired", ["session_expired_mid_run"], {
      session: expired,
      ingest: state.ingest ?? null,
      frames: state.frames ?? null,
      transcript: state.transcript ?? null,
      artifacts_retained: true,
    });
  }

  function result(
    status: VideoPipelineStatus,
    reasons: string[],
    partial: {
      session: VisionSessionRecord;
      ingest?: VideoIngestResult | null;
      frames?: SampleVideoFramesResult | null;
      transcript?: ExtractVideoTranscriptResult | null;
      packet?: MultimodalAnalysisPacket | null;
      packet_path?: string | null;
      artifacts_retained: boolean;
    },
  ): VideoPipelineResult {
    return {
      status,
      reasons,
      session: partial.session,
      source_hash: sourceHash,
      artifact_dir:
        partial.ingest && partial.ingest.artifact_dir
          ? partial.ingest.artifact_dir
          : null,
      artifacts_retained: partial.artifacts_retained,
      ingest: partial.ingest ?? null,
      frames: partial.frames ?? null,
      transcript: partial.transcript ?? null,
      packet: partial.packet ?? null,
      packet_path: partial.packet_path ?? null,
      events,
    };
  }
}
