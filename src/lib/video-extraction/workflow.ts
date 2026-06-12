import { createHash } from "node:crypto";
import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { z } from "zod";

import { resolveSafePath, SafePathError } from "@/lib/tools/fs-safe-path";
import { sanitizeVisionMetadataPayload } from "@/lib/vision-runtime";
import {
  isVisionSourceEnabled,
  loadVisionSourceAllowlistConfig,
  VISION_SOURCE_PLATFORMS,
  type VisionSourceAllowlistLoadResult,
  type VisionSourcePlatform,
} from "@/lib/vision-runtime/config/source-allowlist-config";
import {
  isVisionConsentGranted,
  loadVisionStandingConsentConfig,
  type VisionConsentId,
} from "@/lib/vision-runtime/config/standing-consent-config";

import {
  meetsMinimumVersion,
  minimumVersionForTool,
  VIDEO_RUNTIME_TOOLS,
  type VideoRuntimeTool,
} from "./runtime-requirements";

export const VIDEO_EXTRACTION_VERSION = "video-extraction:v1.phase23c" as const;

const BoundedIdSchema = z.string().trim().min(1).max(220);
const BoundedTextSchema = z.string().trim().min(1).max(1200);
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const VIDEO_INGEST_SOURCE_KINDS = ["url", "local_file"] as const;
export const VideoIngestSourceKindSchema = z.enum(VIDEO_INGEST_SOURCE_KINDS);

export const VIDEO_INGEST_STATUSES = [
  "completed",
  "refused_consent",
  "refused_allowlist",
  "refused_source",
  "refused_health",
  "failed_cap_filesize",
  "failed_cap_duration",
  "failed_runner",
] as const;
export const VideoIngestStatusSchema = z.enum(VIDEO_INGEST_STATUSES);

export const VIDEO_INGEST_SIZE_BANDS = [
  "empty",
  "under_1mb",
  "1mb_to_64mb",
  "64mb_to_512mb",
  "over_512mb",
] as const;
export const VideoIngestSizeBandSchema = z.enum(VIDEO_INGEST_SIZE_BANDS);

// Telemetry events use ONLY field names present in the vision metadata
// allowlist (vision-runtime/redaction.ts) — the gate rejects unknown fields.
// Exact sizes/durations live in the on-disk manifest; events carry bands and
// hashes. Tool version hashes ride in event_id (health failures).
export const VideoIngestTelemetryEventSchema = z.strictObject({
  event_type: z.enum([
    "video_ingest_requested",
    "video_ingest_completed",
    "video_ingest_failed",
  ]),
  event_id: BoundedIdSchema,
  kind: VideoIngestSourceKindSchema,
  source_ref_kind: z.enum(VISION_SOURCE_PLATFORMS).nullable(),
  source_id_hash: HashReferenceSchema,
  status: VideoIngestStatusSchema,
  reason: BoundedIdSchema.nullable(),
  size_band: VideoIngestSizeBandSchema.nullable(),
  created_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export const VideoIngestManifestSchema = z.strictObject({
  manifest_version: z.literal(VIDEO_EXTRACTION_VERSION),
  source_kind: VideoIngestSourceKindSchema,
  platform: z.enum(VISION_SOURCE_PLATFORMS),
  source_hash: HashReferenceSchema,
  // Disk-only field: paths may live in the manifest, never in telemetry.
  source_local_path: z.string().trim().min(1).max(2048).nullable(),
  media_filename: BoundedIdSchema,
  duration_seconds: z.number().nonnegative(),
  file_size_bytes: z.number().int().nonnegative(),
  tool_versions: z.strictObject({
    ytdlp: z.string().trim().max(220).nullable(),
    ffmpeg: z.string().trim().max(220).nullable(),
    ffprobe: z.string().trim().max(220).nullable(),
  }),
  consent_entry_consumed: z.enum([
    "video_ingest_url",
    "video_ingest_local_file",
  ]),
  caps: z.strictObject({
    max_filesize_mb: z.number().int().nonnegative(),
    max_duration_s: z.number().int().nonnegative(),
  }),
  created_at_iso: z.string().trim().min(10).max(40),
});

export const VideoIngestResultSchema = z.strictObject({
  result_id: BoundedIdSchema,
  version: z.literal(VIDEO_EXTRACTION_VERSION),
  status: VideoIngestStatusSchema,
  reasons: z.array(BoundedTextSchema),
  source_kind: VideoIngestSourceKindSchema,
  platform: z.enum(VISION_SOURCE_PLATFORMS).nullable(),
  source_hash: HashReferenceSchema,
  manifest: VideoIngestManifestSchema.nullable(),
  artifact_dir: z.string().trim().min(1).max(2048).nullable(),
  artifact_dir_present: z.boolean(),
  events: z.array(VideoIngestTelemetryEventSchema),
  user_initiated_only: z.literal(true),
  background_ingest_started: z.literal(false),
  bulk_ingest_started: z.literal(false),
  raw_url_in_events: z.literal(false),
  raw_path_in_events: z.literal(false),
});

export type VideoIngestTelemetryEvent = z.infer<
  typeof VideoIngestTelemetryEventSchema
>;
export type VideoIngestManifest = z.infer<typeof VideoIngestManifestSchema>;
export type VideoIngestResult = z.infer<typeof VideoIngestResultSchema>;
export type VideoIngestStatus = z.infer<typeof VideoIngestStatusSchema>;

export interface VideoVersionProbe {
  ytdlp(): Promise<string | null> | string | null;
  ffmpeg(): Promise<string | null> | string | null;
  ffprobe(): Promise<string | null> | string | null;
}

export interface VideoYtdlpRunner {
  download(input: {
    readonly raw_url: string;
    readonly destination_dir: string;
    readonly max_filesize_mb: number;
  }):
    | Promise<{ readonly media_filename: string }>
    | { readonly media_filename: string };
}

export interface VideoFfprobeRunner {
  probeDurationSeconds(mediaPath: string): Promise<number> | number;
}

export interface VideoIngestDependencies {
  readonly versionProbe: VideoVersionProbe;
  readonly ytdlpRunner?: VideoYtdlpRunner;
  readonly ffprobeRunner: VideoFfprobeRunner;
  readonly emitTelemetry?: (
    event: VideoIngestTelemetryEvent,
  ) => void | Promise<void>;
}

export type VideoIngestSourceRequest =
  | { readonly kind: "url"; readonly url: string }
  | {
      readonly kind: "local_file";
      readonly path: string;
      readonly local_source_root: string;
    };

export interface VideoIngestRequest {
  readonly source: VideoIngestSourceRequest;
  readonly explicit_user_triggered: true;
  readonly consent_config_path?: string;
  readonly allowlist_config_path?: string;
  readonly artifact_root?: string;
  readonly now_ms?: number;
}

export const DEFAULT_VIDEO_ARTIFACT_ROOT = resolve(
  process.cwd(),
  "data/vision-artifacts",
);

export function hashVideoSource(rawSource: string): string {
  return `sha256:${createHash("sha256").update(rawSource).digest("hex")}`;
}

export function classifyVideoUrlPlatform(
  hostname: string,
): VisionSourcePlatform | null {
  const host = hostname.toLowerCase().replace(/^www\.|^m\./, "");
  if (host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host === "instagram.com") return "instagram_reels";
  if (host === "tiktok.com") return "tiktok";
  if (host === "x.com" || host === "twitter.com") return "x_twitter";
  return null;
}

export function videoIngestSizeBand(
  fileSizeBytes: number,
): (typeof VIDEO_INGEST_SIZE_BANDS)[number] {
  if (fileSizeBytes <= 0) return "empty";
  if (fileSizeBytes < 1_000_000) return "under_1mb";
  if (fileSizeBytes < 64_000_000) return "1mb_to_64mb";
  if (fileSizeBytes <= 512_000_000) return "64mb_to_512mb";
  return "over_512mb";
}

interface IngestContext {
  readonly sourceKind: (typeof VIDEO_INGEST_SOURCE_KINDS)[number];
  readonly sourceHash: string;
  readonly nowMs: number;
  platform: VisionSourcePlatform | null;
  readonly events: VideoIngestTelemetryEvent[];
  readonly emit?: (event: VideoIngestTelemetryEvent) => void | Promise<void>;
}

async function emitEvent(
  context: IngestContext,
  input: {
    readonly event_type: VideoIngestTelemetryEvent["event_type"];
    readonly status: VideoIngestStatus;
    readonly reason?: string | null;
    readonly size_band?: VideoIngestTelemetryEvent["size_band"];
    readonly event_id?: string;
  },
): Promise<void> {
  const event = VideoIngestTelemetryEventSchema.parse({
    event_type: input.event_type,
    event_id:
      input.event_id ??
      `video-ingest:${input.event_type}:${context.sourceHash.slice(7, 23)}`,
    kind: context.sourceKind,
    source_ref_kind: context.platform,
    source_id_hash: context.sourceHash,
    status: input.status,
    reason: input.reason ?? null,
    size_band: input.size_band ?? null,
    created_at_ms: context.nowMs,
    metadata_only: true,
    raw_payload_included: false,
    cloud_called: false,
    action_executed: false,
  });
  // Defense in depth: every event passes the vision metadata gate before it
  // leaves the module. Construction above keeps this always-true.
  const gate = sanitizeVisionMetadataPayload({ ...event });
  if (!gate.ok) {
    throw new Error(
      `video-extraction produced a non-metadata-safe event: ${gate.reason}`,
    );
  }
  context.events.push(event);
  await context.emit?.(event);
}

function failureResult(
  context: IngestContext,
  status: VideoIngestStatus,
  reasons: string[],
  artifactDirPresent = false,
): VideoIngestResult {
  return VideoIngestResultSchema.parse({
    result_id: `video-ingest:result:${context.sourceHash.slice(7, 23)}`,
    version: VIDEO_EXTRACTION_VERSION,
    status,
    reasons,
    source_kind: context.sourceKind,
    platform: context.platform,
    source_hash: context.sourceHash,
    manifest: null,
    artifact_dir: null,
    artifact_dir_present: artifactDirPresent,
    events: context.events,
    user_initiated_only: true,
    background_ingest_started: false,
    bulk_ingest_started: false,
    raw_url_in_events: false,
    raw_path_in_events: false,
  });
}

async function removeArtifactDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export async function executeVideoIngest(
  request: VideoIngestRequest,
  deps: VideoIngestDependencies,
): Promise<VideoIngestResult> {
  if (request.explicit_user_triggered !== true) {
    throw new Error("Video ingest requires an explicit user trigger.");
  }
  const nowMs = request.now_ms ?? Date.now();
  const rawSource =
    request.source.kind === "url" ? request.source.url : request.source.path;
  const context: IngestContext = {
    sourceKind: request.source.kind,
    sourceHash: hashVideoSource(rawSource),
    nowMs,
    platform: request.source.kind === "local_file" ? "local_file" : null,
    events: [],
    emit: deps.emitTelemetry,
  };

  await emitEvent(context, {
    event_type: "video_ingest_requested",
    status: "completed",
    reason: "ingest_requested",
  });

  // 1. Consent gate FIRST — deny means no runner is ever invoked.
  const consentEntry: VisionConsentId =
    request.source.kind === "url"
      ? "video_ingest_url"
      : "video_ingest_local_file";
  const consent = loadVisionStandingConsentConfig(request.consent_config_path);
  if (!isVisionConsentGranted(consent, consentEntry)) {
    await emitEvent(context, {
      event_type: "video_ingest_failed",
      status: "refused_consent",
      reason: `consent_denied:${consentEntry}`,
    });
    return failureResult(context, "refused_consent", [
      `consent_denied:${consentEntry}`,
    ]);
  }

  // 2. Source allowlist + caps (caps are zeroed when the file is absent, so
  // a missing allowlist fails closed at the cap checks regardless).
  const allowlist: VisionSourceAllowlistLoadResult =
    loadVisionSourceAllowlistConfig(request.allowlist_config_path);

  if (request.source.kind === "url") {
    let hostname: string;
    try {
      hostname = new URL(request.source.url).hostname;
    } catch {
      await emitEvent(context, {
        event_type: "video_ingest_failed",
        status: "refused_source",
        reason: "invalid_url",
      });
      return failureResult(context, "refused_source", ["invalid_url"]);
    }
    context.platform = classifyVideoUrlPlatform(hostname);
    if (!context.platform) {
      await emitEvent(context, {
        event_type: "video_ingest_failed",
        status: "refused_source",
        reason: "unknown_platform",
      });
      return failureResult(context, "refused_source", ["unknown_platform"]);
    }
  }

  const platform = context.platform ?? "local_file";
  if (!isVisionSourceEnabled(allowlist, platform)) {
    await emitEvent(context, {
      event_type: "video_ingest_failed",
      status: "refused_allowlist",
      reason: `platform_disabled:${platform}`,
    });
    return failureResult(context, "refused_allowlist", [
      `platform_disabled:${platform}`,
    ]);
  }

  // 3. Local paths go through the existing safe-path utility (reuse mandate).
  let localSourcePath: string | null = null;
  if (request.source.kind === "local_file") {
    try {
      const safe = await resolveSafePath(
        request.source.path,
        request.source.local_source_root,
      );
      localSourcePath = safe.resolvedPath;
    } catch (error) {
      const reason =
        error instanceof SafePathError
          ? `unsafe_path:${error.reason}`
          : "unsafe_path:unknown";
      await emitEvent(context, {
        event_type: "video_ingest_failed",
        status: "refused_source",
        reason,
      });
      return failureResult(context, "refused_source", [reason]);
    }
  }

  // 4. Health checks at plan time — refuse before any download attempt.
  // Telemetry carries tool name (reason) + version-string hash (event_id).
  const versions = {
    "yt-dlp": await deps.versionProbe.ytdlp(),
    ffmpeg: await deps.versionProbe.ffmpeg(),
    ffprobe: await deps.versionProbe.ffprobe(),
  } satisfies Record<VideoRuntimeTool, string | null>;
  const requiredTools: readonly VideoRuntimeTool[] =
    request.source.kind === "url"
      ? VIDEO_RUNTIME_TOOLS
      : (["ffmpeg", "ffprobe"] as const);
  for (const tool of requiredTools) {
    const raw = versions[tool];
    if (!meetsMinimumVersion(raw, minimumVersionForTool(tool))) {
      const versionHash = hashVideoSource(raw ?? "absent").slice(7, 23);
      await emitEvent(context, {
        event_type: "video_ingest_failed",
        status: "refused_health",
        reason: `health_below_minimum:${tool}`,
        event_id: `video-ingest:health:${tool}:${versionHash}`,
      });
      return failureResult(context, "refused_health", [
        `health_below_minimum:${tool}`,
      ]);
    }
  }

  // 5. Artifact dir + acquisition.
  const artifactRoot = request.artifact_root ?? DEFAULT_VIDEO_ARTIFACT_ROOT;
  const dateSegment = new Date(nowMs).toISOString().slice(0, 10);
  const artifactDir = join(
    artifactRoot,
    `${dateSegment}-${context.sourceHash.slice(7, 23)}`,
  );
  await mkdir(artifactDir, { recursive: true });

  let mediaFilename: string;
  try {
    if (request.source.kind === "url") {
      if (!deps.ytdlpRunner) {
        await removeArtifactDir(artifactDir);
        await emitEvent(context, {
          event_type: "video_ingest_failed",
          status: "failed_runner",
          reason: "ytdlp_runner_unavailable",
        });
        return failureResult(context, "failed_runner", [
          "ytdlp_runner_unavailable",
        ]);
      }
      const downloaded = await deps.ytdlpRunner.download({
        raw_url: request.source.url,
        destination_dir: artifactDir,
        max_filesize_mb: allowlist.caps.max_filesize_mb,
      });
      mediaFilename = downloaded.media_filename;
    } else {
      const sourcePath = localSourcePath as string;
      mediaFilename = `source${extname(sourcePath) || ".bin"}`;
      await copyFile(sourcePath, join(artifactDir, mediaFilename));
    }
  } catch {
    await removeArtifactDir(artifactDir);
    await emitEvent(context, {
      event_type: "video_ingest_failed",
      status: "failed_runner",
      reason: "acquisition_failed",
    });
    return failureResult(context, "failed_runner", ["acquisition_failed"]);
  }

  const mediaPath = join(artifactDir, mediaFilename);

  // 6. Post-download caps: filesize then ffprobe duration. Over-cap deletes
  // the artifact folder — no partial artifacts survive.
  const mediaStat = await stat(mediaPath);
  const maxFilesizeBytes = allowlist.caps.max_filesize_mb * 1_000_000;
  if (mediaStat.size > maxFilesizeBytes) {
    await removeArtifactDir(artifactDir);
    await emitEvent(context, {
      event_type: "video_ingest_failed",
      status: "failed_cap_filesize",
      reason: "cap_filesize_exceeded",
      size_band: videoIngestSizeBand(mediaStat.size),
    });
    return failureResult(context, "failed_cap_filesize", [
      "cap_filesize_exceeded",
    ]);
  }

  let durationSeconds: number;
  try {
    durationSeconds = await deps.ffprobeRunner.probeDurationSeconds(mediaPath);
  } catch {
    await removeArtifactDir(artifactDir);
    await emitEvent(context, {
      event_type: "video_ingest_failed",
      status: "failed_runner",
      reason: "ffprobe_failed",
    });
    return failureResult(context, "failed_runner", ["ffprobe_failed"]);
  }
  if (durationSeconds > allowlist.caps.max_duration_s) {
    await removeArtifactDir(artifactDir);
    await emitEvent(context, {
      event_type: "video_ingest_failed",
      status: "failed_cap_duration",
      reason: "cap_duration_exceeded",
    });
    return failureResult(context, "failed_cap_duration", [
      "cap_duration_exceeded",
    ]);
  }

  // 7. Manifest (disk-only home for exact numbers, paths, raw tool versions).
  const manifest = VideoIngestManifestSchema.parse({
    manifest_version: VIDEO_EXTRACTION_VERSION,
    source_kind: request.source.kind,
    platform,
    source_hash: context.sourceHash,
    source_local_path: localSourcePath,
    media_filename: mediaFilename,
    duration_seconds: durationSeconds,
    file_size_bytes: mediaStat.size,
    tool_versions: {
      ytdlp: versions["yt-dlp"],
      ffmpeg: versions.ffmpeg,
      ffprobe: versions.ffprobe,
    },
    consent_entry_consumed: consentEntry,
    caps: {
      max_filesize_mb: allowlist.caps.max_filesize_mb,
      max_duration_s: allowlist.caps.max_duration_s,
    },
    created_at_iso: new Date(nowMs).toISOString(),
  });
  await writeFile(
    join(artifactDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  await emitEvent(context, {
    event_type: "video_ingest_completed",
    status: "completed",
    reason: null,
    size_band: videoIngestSizeBand(mediaStat.size),
  });

  return VideoIngestResultSchema.parse({
    result_id: `video-ingest:result:${context.sourceHash.slice(7, 23)}`,
    version: VIDEO_EXTRACTION_VERSION,
    status: "completed",
    reasons: ["ingest_completed"],
    source_kind: request.source.kind,
    platform,
    source_hash: context.sourceHash,
    manifest,
    artifact_dir: artifactDir,
    artifact_dir_present: true,
    events: context.events,
    user_initiated_only: true,
    background_ingest_started: false,
    bulk_ingest_started: false,
    raw_url_in_events: false,
    raw_path_in_events: false,
  });
}
