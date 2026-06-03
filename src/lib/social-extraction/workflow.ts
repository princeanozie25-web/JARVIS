import { createHash } from "node:crypto";
import { z } from "zod";

export const SOCIAL_EXTRACTION_VERSION =
  "phase21e.social-extraction.v1" as const;

export const SOCIAL_EXTRACTION_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "twitter_x",
  "yt_dlp_supported",
  "unknown",
] as const;

export const SOCIAL_EXTRACTION_STATUSES = [
  "completed",
  "rejected",
  "unavailable",
  "runner_failed",
  "analysis_failed",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(220);
const BoundedTextSchema = z.string().trim().min(1).max(1200);
const UrlSchema = z.string().trim().url().max(4096);
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const SocialExtractionPlatformSchema = z.enum(
  SOCIAL_EXTRACTION_PLATFORMS,
);
export const SocialExtractionStatusSchema = z.enum(SOCIAL_EXTRACTION_STATUSES);

export const SocialExtractionSourcePolicySchema = z.strictObject({
  policy_id: BoundedIdSchema.default("social-extraction:default-policy"),
  allow_unknown_platforms: z.boolean().default(false),
  allowed_platforms: z
    .array(SocialExtractionPlatformSchema)
    .default(["instagram", "tiktok", "youtube", "twitter_x"]),
  disallowed_platforms: z.array(SocialExtractionPlatformSchema).default([]),
  max_duration_seconds: z.number().int().positive().max(7200).default(900),
  max_file_size_bytes: z
    .number()
    .int()
    .positive()
    .max(5_000_000_000)
    .default(500_000_000),
  max_frame_count: z.number().int().positive().max(600).default(120),
  transcription_required: z.boolean().default(true),
  cloud_analysis_requires_explicit_cost_gate: z.literal(true).default(true),
  metadata_only_telemetry: z.literal(true).default(true),
  bulk_download_supported: z.literal(false).default(false),
  background_watch_supported: z.literal(false).default(false),
});

export const SocialExtractionSourceClassificationSchema = z.strictObject({
  source_url_hash: HashReferenceSchema,
  platform: SocialExtractionPlatformSchema,
  hostname: z.string().trim().min(1).max(260),
  allowed: z.boolean(),
  reasons: z.array(BoundedTextSchema),
  raw_url_included: z.literal(false),
});

export const SocialExtractionCostEstimateSchema = z.strictObject({
  model_tier: z.enum(["T3", "T4"]),
  estimated_prompt_tokens: z.number().int().nonnegative(),
  estimated_frame_tokens: z.number().int().nonnegative(),
  estimated_transcript_tokens: z.number().int().nonnegative(),
  estimated_cost_usd: z.number().nonnegative().nullable(),
  cost_gate_required: z.literal(true),
  explicit_user_trigger_required: z.literal(true),
});

export const SocialExtractionPlanSchema = z.strictObject({
  plan_id: BoundedIdSchema,
  version: z.literal(SOCIAL_EXTRACTION_VERSION),
  source: SocialExtractionSourceClassificationSchema,
  temp_workspace_id: BoundedIdSchema,
  max_duration_seconds: z.number().int().positive(),
  max_file_size_bytes: z.number().int().positive(),
  adaptive_fps: z.number().positive(),
  max_frame_count: z.number().int().positive(),
  needs_transcription: z.boolean(),
  needs_frame_extraction: z.literal(true),
  cost_estimate: SocialExtractionCostEstimateSchema,
  explicit_user_triggered: z.literal(true),
  approval_or_user_trigger_gate: z.literal("explicit_user_trigger_required"),
  ytdlp_runner_required: z.literal(true),
  ffmpeg_runner_required: z.literal(true),
  transcription_runner_required: z.boolean(),
  analysis_runner_required: z.literal(true),
  background_watch_requested: z.literal(false),
  bulk_download_requested: z.literal(false),
  raw_url_included: z.literal(false),
});

export const SocialExtractionDownloadedMediaSchema = z.strictObject({
  video_ref: BoundedIdSchema,
  audio_ref: BoundedIdSchema.nullable(),
  duration_seconds: z.number().positive(),
  file_size_bytes: z.number().int().positive(),
  metadata_hash: HashReferenceSchema,
  raw_video_body_included: z.literal(false),
  raw_audio_body_included: z.literal(false),
});

export const SocialExtractionFrameRefSchema = z.strictObject({
  frame_id: BoundedIdSchema,
  timestamp_seconds: z.number().nonnegative(),
  temp_path_ref: BoundedIdSchema,
  content_hash: HashReferenceSchema,
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  raw_frame_data_included: z.literal(false),
});

export const SocialExtractionFrameExtractionResultSchema = z.strictObject({
  frames: z.array(SocialExtractionFrameRefSchema),
  frame_count: z.number().int().nonnegative(),
  adaptive_fps: z.number().positive(),
  frame_cap_enforced: z.boolean(),
  raw_frame_data_included: z.literal(false),
});

export const SocialTranscriptSegmentSchema = z.strictObject({
  segment_id: BoundedIdSchema,
  start_seconds: z.number().nonnegative(),
  end_seconds: z.number().nonnegative(),
  text: z.string().trim().min(1).max(2000),
});

export const SocialTranscriptionResultSchema = z.strictObject({
  transcript_id: BoundedIdSchema,
  segments: z.array(SocialTranscriptSegmentSchema),
  segment_count: z.number().int().nonnegative(),
  language: z.string().trim().min(2).max(32).nullable().default(null),
  raw_audio_body_included: z.literal(false),
  raw_transcript_written_to_telemetry: z.literal(false),
});

export const SocialMultimodalAnalysisPacketSchema = z.strictObject({
  packet_id: BoundedIdSchema,
  plan_id: BoundedIdSchema,
  platform: SocialExtractionPlatformSchema,
  source_url_hash: HashReferenceSchema,
  duration_seconds: z.number().positive(),
  frames: z.array(SocialExtractionFrameRefSchema),
  transcript_segments: z.array(SocialTranscriptSegmentSchema),
  analysis_prompt_metadata: z.strictObject({
    model_tier: z.enum(["T3", "T4"]),
    cost_gate_required: z.literal(true),
    explicit_user_triggered: z.literal(true),
    raw_prompt_included_in_telemetry: z.literal(false),
  }),
  raw_url_included: z.literal(false),
  raw_frame_data_included: z.literal(false),
  raw_audio_body_included: z.literal(false),
  raw_video_body_included: z.literal(false),
  raw_transcript_written_to_telemetry: z.literal(false),
});

export const SocialTimestampedEventSchema = z.strictObject({
  event_id: BoundedIdSchema,
  timestamp_seconds: z.number().nonnegative(),
  summary: BoundedTextSchema,
  frame_refs: z.array(BoundedIdSchema),
});

export const SocialAnalysisResultSchema = z.strictObject({
  analysis_id: BoundedIdSchema,
  summary: BoundedTextSchema,
  timestamped_events: z.array(SocialTimestampedEventSchema),
  key_frame_refs: z.array(BoundedIdSchema),
  confidence: z.enum(["high", "medium", "low", "unknown"]),
  caveats: z.array(BoundedTextSchema),
  safety: z.strictObject({
    advisory_only: z.literal(true),
    no_action_execution: z.literal(true),
    no_persistent_raw_media_storage: z.literal(true),
    raw_frame_data_included: z.literal(false),
    raw_audio_body_included: z.literal(false),
    raw_video_body_included: z.literal(false),
    raw_transcript_written_to_telemetry: z.literal(false),
  }),
});

export const SocialExtractionTelemetrySchema = z.strictObject({
  telemetry_version: z.literal(SOCIAL_EXTRACTION_VERSION),
  platform: SocialExtractionPlatformSchema,
  url_hash: HashReferenceSchema,
  duration_seconds: z.number().nonnegative(),
  frame_count: z.number().int().nonnegative(),
  transcript_segment_count: z.number().int().nonnegative(),
  model_tier: z.enum(["T3", "T4"]),
  cost_estimate_usd: z.number().nonnegative().nullable(),
  status: SocialExtractionStatusSchema,
  cleanup_attempted: z.boolean(),
  cleanup_completed: z.boolean(),
  metadata_only: z.literal(true),
  raw_url_included: z.literal(false),
  raw_transcript_included: z.literal(false),
  raw_frame_data_included: z.literal(false),
  raw_audio_path_included_after_cleanup: z.literal(false),
  raw_video_body_included: z.literal(false),
});

export const SocialExtractionWorkflowResultSchema = z.strictObject({
  result_id: BoundedIdSchema,
  version: z.literal(SOCIAL_EXTRACTION_VERSION),
  status: SocialExtractionStatusSchema,
  reasons: z.array(BoundedTextSchema),
  plan: SocialExtractionPlanSchema,
  packet: SocialMultimodalAnalysisPacketSchema.nullable(),
  analysis: SocialAnalysisResultSchema.nullable(),
  telemetry: SocialExtractionTelemetrySchema,
  cleanup_attempted: z.boolean(),
  cleanup_completed: z.boolean(),
  temp_workspace_wiped: z.boolean(),
  user_initiated_only: z.literal(true),
  background_watch_started: z.literal(false),
  bulk_download_started: z.literal(false),
  raw_payload_telemetry_enabled: z.literal(false),
});

export const SocialExtractionCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(SOCIAL_EXTRACTION_VERSION),
  title: z.literal(
    "Phase 21E social media extraction realized as user-triggered injected-runner workflow",
  ),
  classification: z.literal("execution_enabled"),
  components: z.array(BoundedTextSchema),
  governance: z.strictObject({
    user_initiated_only: z.literal(true),
    no_background_url_watching: z.literal(true),
    no_bulk_download: z.literal(true),
    no_persistent_raw_media_storage: z.literal(true),
    injected_runner_boundaries: z.literal(true),
    source_policy_enforced: z.literal(true),
    temp_workspace_cleanup_required: z.literal(true),
    cloud_analysis_cost_gated: z.literal(true),
    metadata_only_telemetry: z.literal(true),
    no_raw_transcript_frame_audio_video_telemetry: z.literal(true),
    no_auto_execution: z.literal(true),
  }),
  phase_21e_may_close: z.literal(true),
});

export type SocialExtractionSourcePolicy = z.infer<
  typeof SocialExtractionSourcePolicySchema
>;
export type SocialExtractionSourceClassification = z.infer<
  typeof SocialExtractionSourceClassificationSchema
>;
export type SocialExtractionPlan = z.infer<typeof SocialExtractionPlanSchema>;
export type SocialExtractionDownloadedMedia = z.infer<
  typeof SocialExtractionDownloadedMediaSchema
>;
export type SocialExtractionFrameExtractionResult = z.infer<
  typeof SocialExtractionFrameExtractionResultSchema
>;
export type SocialTranscriptionResult = z.infer<
  typeof SocialTranscriptionResultSchema
>;
export type SocialMultimodalAnalysisPacket = z.infer<
  typeof SocialMultimodalAnalysisPacketSchema
>;
export type SocialAnalysisResult = z.infer<typeof SocialAnalysisResultSchema>;
export type SocialExtractionWorkflowResult = z.infer<
  typeof SocialExtractionWorkflowResultSchema
>;
export type SocialExtractionCloseoutReport = z.infer<
  typeof SocialExtractionCloseoutReportSchema
>;

export interface SocialTempWorkspace {
  readonly workspace_id: string;
  readonly temp_root_ref: string;
}

export interface SocialTempWorkspaceAdapter {
  create(plan: SocialExtractionPlan): SocialTempWorkspace | Promise<SocialTempWorkspace>;
  cleanup(workspace: SocialTempWorkspace): boolean | Promise<boolean>;
}

export interface SocialYtdlpRunner {
  download(
    plan: SocialExtractionPlan,
    workspace: SocialTempWorkspace,
  ):
    | SocialExtractionDownloadedMedia
    | Promise<SocialExtractionDownloadedMedia>;
}

export interface SocialFfmpegRunner {
  extractFrames(input: {
    readonly plan: SocialExtractionPlan;
    readonly workspace: SocialTempWorkspace;
    readonly media: SocialExtractionDownloadedMedia;
  }):
    | SocialExtractionFrameExtractionResult
    | Promise<SocialExtractionFrameExtractionResult>;
}

export interface SocialTranscriptionRunner {
  transcribe(input: {
    readonly plan: SocialExtractionPlan;
    readonly workspace: SocialTempWorkspace;
    readonly media: SocialExtractionDownloadedMedia;
  }): SocialTranscriptionResult | Promise<SocialTranscriptionResult>;
}

export interface SocialAnalysisRunner {
  analyze(
    packet: SocialMultimodalAnalysisPacket,
  ): SocialAnalysisResult | Promise<SocialAnalysisResult>;
}

export interface ExecuteSocialExtractionDependencies {
  readonly tempWorkspace?: SocialTempWorkspaceAdapter;
  readonly ytdlpRunner?: SocialYtdlpRunner;
  readonly ffmpegRunner?: SocialFfmpegRunner;
  readonly transcriptionRunner?: SocialTranscriptionRunner;
  readonly analysisRunner?: SocialAnalysisRunner;
}

export function classifySocialExtractionSource(
  urlInput: string,
  policyInput: Partial<SocialExtractionSourcePolicy> = {},
): SocialExtractionSourceClassification {
  const policy = SocialExtractionSourcePolicySchema.parse(policyInput);
  const url = new URL(UrlSchema.parse(urlInput));
  const platform = detectPlatform(url.hostname);
  const reasons = [
    `platform:${platform}`,
    policy.allowed_platforms.includes(platform)
      ? "platform_allowed"
      : "platform_not_in_allowlist",
    policy.disallowed_platforms.includes(platform)
      ? "platform_disallowed"
      : "platform_not_disallowed",
  ];
  const allowed =
    !policy.disallowed_platforms.includes(platform) &&
    (platform === "unknown"
      ? policy.allow_unknown_platforms
      : policy.allowed_platforms.includes(platform));

  return SocialExtractionSourceClassificationSchema.parse({
    source_url_hash: hashText(url.toString()),
    platform,
    hostname: url.hostname.toLowerCase(),
    allowed,
    reasons,
    raw_url_included: false,
  });
}

export function selectAdaptiveFrameRate(durationSeconds: number): number {
  if (durationSeconds <= 60) return 2;
  if (durationSeconds <= 300) return 1;
  if (durationSeconds <= 900) return 0.5;
  return 0.2;
}

export function estimateExtractedFrameCount(input: {
  readonly duration_seconds: number;
  readonly adaptive_fps: number;
  readonly max_frame_count: number;
}): number {
  return Math.min(
    input.max_frame_count,
    Math.max(1, Math.ceil(input.duration_seconds * input.adaptive_fps)),
  );
}

export function buildSocialExtractionPlan(input: {
  readonly source_url: string;
  readonly policy?: Partial<SocialExtractionSourcePolicy>;
  readonly explicit_user_triggered: true;
  readonly requested_model_tier?: "T3" | "T4";
  readonly estimated_duration_seconds?: number;
}): SocialExtractionPlan {
  const policy = SocialExtractionSourcePolicySchema.parse(input.policy ?? {});
  const source = classifySocialExtractionSource(input.source_url, policy);
  if (!source.allowed) {
    throw new Error(`Social extraction source rejected: ${source.reasons.join(",")}`);
  }
  const duration = Math.min(
    input.estimated_duration_seconds ?? policy.max_duration_seconds,
    policy.max_duration_seconds,
  );
  const adaptiveFps = selectAdaptiveFrameRate(duration);
  const estimatedFrameCount = estimateExtractedFrameCount({
    duration_seconds: duration,
    adaptive_fps: adaptiveFps,
    max_frame_count: policy.max_frame_count,
  });

  return SocialExtractionPlanSchema.parse({
    plan_id: `social-extraction:plan:${source.source_url_hash.slice(7, 23)}`,
    version: SOCIAL_EXTRACTION_VERSION,
    source,
    temp_workspace_id: `social-extraction:tmp:${source.source_url_hash.slice(7, 23)}`,
    max_duration_seconds: policy.max_duration_seconds,
    max_file_size_bytes: policy.max_file_size_bytes,
    adaptive_fps: adaptiveFps,
    max_frame_count: policy.max_frame_count,
    needs_transcription: policy.transcription_required,
    needs_frame_extraction: true,
    cost_estimate: {
      model_tier: input.requested_model_tier ?? "T3",
      estimated_prompt_tokens: 900,
      estimated_frame_tokens: estimatedFrameCount * 180,
      estimated_transcript_tokens: policy.transcription_required ? 1200 : 0,
      estimated_cost_usd: null,
      cost_gate_required: true,
      explicit_user_trigger_required: true,
    },
    explicit_user_triggered: input.explicit_user_triggered,
    approval_or_user_trigger_gate: "explicit_user_trigger_required",
    ytdlp_runner_required: true,
    ffmpeg_runner_required: true,
    transcription_runner_required: policy.transcription_required,
    analysis_runner_required: true,
    background_watch_requested: false,
    bulk_download_requested: false,
    raw_url_included: false,
  });
}

export function validateDownloadedMedia(
  mediaInput: SocialExtractionDownloadedMedia,
  planInput: SocialExtractionPlan,
): SocialExtractionDownloadedMedia {
  const media = SocialExtractionDownloadedMediaSchema.parse(mediaInput);
  const plan = SocialExtractionPlanSchema.parse(planInput);
  if (media.duration_seconds > plan.max_duration_seconds) {
    throw new Error("Social extraction media exceeds policy max duration.");
  }
  if (media.file_size_bytes > plan.max_file_size_bytes) {
    throw new Error("Social extraction media exceeds policy max file size.");
  }
  return media;
}

export function assembleSocialMultimodalPacket(input: {
  readonly plan: SocialExtractionPlan;
  readonly media: SocialExtractionDownloadedMedia;
  readonly frames: SocialExtractionFrameExtractionResult;
  readonly transcript?: SocialTranscriptionResult | null;
}): SocialMultimodalAnalysisPacket {
  const plan = SocialExtractionPlanSchema.parse(input.plan);
  const media = validateDownloadedMedia(input.media, plan);
  const frames = SocialExtractionFrameExtractionResultSchema.parse(input.frames);
  const transcript = input.transcript
    ? SocialTranscriptionResultSchema.parse(input.transcript)
    : null;

  return SocialMultimodalAnalysisPacketSchema.parse({
    packet_id: `social-extraction:packet:${plan.source.source_url_hash.slice(7, 23)}`,
    plan_id: plan.plan_id,
    platform: plan.source.platform,
    source_url_hash: plan.source.source_url_hash,
    duration_seconds: media.duration_seconds,
    frames: frames.frames,
    transcript_segments: transcript?.segments ?? [],
    analysis_prompt_metadata: {
      model_tier: plan.cost_estimate.model_tier,
      cost_gate_required: true,
      explicit_user_triggered: true,
      raw_prompt_included_in_telemetry: false,
    },
    raw_url_included: false,
    raw_frame_data_included: false,
    raw_audio_body_included: false,
    raw_video_body_included: false,
    raw_transcript_written_to_telemetry: false,
  });
}

export async function executeSocialExtractionWorkflow(input: {
  readonly plan: SocialExtractionPlan;
  readonly dependencies: ExecuteSocialExtractionDependencies;
}): Promise<SocialExtractionWorkflowResult> {
  const plan = SocialExtractionPlanSchema.parse(input.plan);
  let workspace: SocialTempWorkspace | null = null;
  let cleanupAttempted = false;
  let cleanupCompleted = false;
  let packet: SocialMultimodalAnalysisPacket | null = null;
  let analysis: SocialAnalysisResult | null = null;
  let status: z.infer<typeof SocialExtractionStatusSchema> = "completed";
  let reasons: string[] = ["analysis_completed"];

  try {
    if (!input.dependencies.tempWorkspace) {
      status = "unavailable";
      reasons = ["temp_workspace_unavailable"];
      return resultFor(plan, {
        status,
        reasons,
        packet,
        analysis,
        cleanupAttempted,
        cleanupCompleted,
      });
    }
    if (!input.dependencies.ytdlpRunner) {
      status = "unavailable";
      reasons = ["ytdlp_unavailable"];
      return resultFor(plan, {
        status,
        reasons,
        packet,
        analysis,
        cleanupAttempted,
        cleanupCompleted,
      });
    }
    if (!input.dependencies.ffmpegRunner) {
      status = "unavailable";
      reasons = ["ffmpeg_unavailable"];
      return resultFor(plan, {
        status,
        reasons,
        packet,
        analysis,
        cleanupAttempted,
        cleanupCompleted,
      });
    }
    if (plan.needs_transcription && !input.dependencies.transcriptionRunner) {
      status = "unavailable";
      reasons = ["transcription_unavailable"];
      return resultFor(plan, {
        status,
        reasons,
        packet,
        analysis,
        cleanupAttempted,
        cleanupCompleted,
      });
    }
    if (!input.dependencies.analysisRunner) {
      status = "unavailable";
      reasons = ["analysis_runner_unavailable"];
      return resultFor(plan, {
        status,
        reasons,
        packet,
        analysis,
        cleanupAttempted,
        cleanupCompleted,
      });
    }

    workspace = await input.dependencies.tempWorkspace.create(plan);
    const media = validateDownloadedMedia(
      await input.dependencies.ytdlpRunner.download(plan, workspace),
      plan,
    );
    const frames = SocialExtractionFrameExtractionResultSchema.parse(
      await input.dependencies.ffmpegRunner.extractFrames({
        plan,
        workspace,
        media,
      }),
    );
    const transcript =
      plan.needs_transcription && input.dependencies.transcriptionRunner
        ? SocialTranscriptionResultSchema.parse(
            await input.dependencies.transcriptionRunner.transcribe({
              plan,
              workspace,
              media,
            }),
          )
        : null;
    packet = assembleSocialMultimodalPacket({
      plan,
      media,
      frames,
      transcript,
    });
    analysis = SocialAnalysisResultSchema.parse(
      await input.dependencies.analysisRunner.analyze(packet),
    );
  } catch (error) {
    status =
      error instanceof Error && error.message.includes("analysis")
        ? "analysis_failed"
        : "runner_failed";
    reasons = [error instanceof Error ? error.message : status];
  } finally {
    if (workspace && input.dependencies.tempWorkspace) {
      cleanupAttempted = true;
      cleanupCompleted = await input.dependencies.tempWorkspace.cleanup(
        workspace,
      );
    }
  }

  return resultFor(plan, {
    status,
    reasons,
    packet,
    analysis,
    cleanupAttempted,
    cleanupCompleted,
  });
}

export function buildPhase21ESocialExtractionCloseoutReport(): SocialExtractionCloseoutReport {
  return SocialExtractionCloseoutReportSchema.parse({
    closeout_version: SOCIAL_EXTRACTION_VERSION,
    title:
      "Phase 21E social media extraction realized as user-triggered injected-runner workflow",
    classification: "execution_enabled",
    components: [
      "URL/source policy classifier",
      "deterministic extraction plan builder",
      "yt-dlp injected runner boundary",
      "ffmpeg injected runner boundary",
      "timestamped transcript model",
      "multimodal packet assembler",
      "analysis runner boundary",
      "cleanup-guaranteed workflow result",
      "metadata-only telemetry",
    ],
    governance: {
      user_initiated_only: true,
      no_background_url_watching: true,
      no_bulk_download: true,
      no_persistent_raw_media_storage: true,
      injected_runner_boundaries: true,
      source_policy_enforced: true,
      temp_workspace_cleanup_required: true,
      cloud_analysis_cost_gated: true,
      metadata_only_telemetry: true,
      no_raw_transcript_frame_audio_video_telemetry: true,
      no_auto_execution: true,
    },
    phase_21e_may_close: true,
  });
}

function resultFor(
  plan: SocialExtractionPlan,
  input: {
    readonly status: z.infer<typeof SocialExtractionStatusSchema>;
    readonly reasons: readonly string[];
    readonly packet: SocialMultimodalAnalysisPacket | null;
    readonly analysis: SocialAnalysisResult | null;
    readonly cleanupAttempted: boolean;
    readonly cleanupCompleted: boolean;
  },
): SocialExtractionWorkflowResult {
  const transcriptCount = input.packet?.transcript_segments.length ?? 0;
  const frameCount = input.packet?.frames.length ?? 0;
  const duration = input.packet?.duration_seconds ?? 0;
  return SocialExtractionWorkflowResultSchema.parse({
    result_id: `social-extraction:result:${plan.source.source_url_hash.slice(7, 23)}`,
    version: SOCIAL_EXTRACTION_VERSION,
    status: input.status,
    reasons: input.reasons,
    plan,
    packet: input.packet,
    analysis: input.analysis,
    telemetry: {
      telemetry_version: SOCIAL_EXTRACTION_VERSION,
      platform: plan.source.platform,
      url_hash: plan.source.source_url_hash,
      duration_seconds: duration,
      frame_count: frameCount,
      transcript_segment_count: transcriptCount,
      model_tier: plan.cost_estimate.model_tier,
      cost_estimate_usd: plan.cost_estimate.estimated_cost_usd,
      status: input.status,
      cleanup_attempted: input.cleanupAttempted,
      cleanup_completed: input.cleanupCompleted,
      metadata_only: true,
      raw_url_included: false,
      raw_transcript_included: false,
      raw_frame_data_included: false,
      raw_audio_path_included_after_cleanup: false,
      raw_video_body_included: false,
    },
    cleanup_attempted: input.cleanupAttempted,
    cleanup_completed: input.cleanupCompleted,
    temp_workspace_wiped: input.cleanupCompleted,
    user_initiated_only: true,
    background_watch_started: false,
    bulk_download_started: false,
    raw_payload_telemetry_enabled: false,
  });
}

function detectPlatform(hostname: string): z.infer<
  typeof SocialExtractionPlatformSchema
> {
  const host = hostname.toLowerCase();
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("tiktok.com")) return "tiktok";
  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    return "youtube";
  }
  if (host.includes("twitter.com") || host.includes("x.com")) {
    return "twitter_x";
  }
  if (host.length > 0) return "yt_dlp_supported";
  return "unknown";
}

function hashText(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
