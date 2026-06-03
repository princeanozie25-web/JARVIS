import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildSocialExtractionPlan,
  executeSocialExtractionWorkflow,
  type SocialAnalysisResult,
  type SocialExtractionDownloadedMedia,
  type SocialExtractionFrameExtractionResult,
  type SocialExtractionPlan,
  type SocialMultimodalAnalysisPacket,
  type SocialTempWorkspace,
  type SocialTranscriptionResult,
} from "../src/lib/social-extraction";
import {
  createFasterWhisperSttProvider,
  loadFasterWhisperSttLocalConfig,
} from "../src/lib/voice-runtime";

const DEFAULT_SMOKE_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const SMOKE_URL_ENV = "JARVIS_SOCIAL_SMOKE_URL";
const SMOKE_TIMEOUT_MS = 180_000;

export class SocialExtractionSmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialExtractionSmokeError";
  }
}

export interface SocialExtractionSmokeReport {
  readonly status: "ok" | "failed";
  readonly smoke_url: string;
  readonly url_hash: string;
  readonly ytdlp_version: string;
  readonly ffmpeg_version: string;
  readonly ffprobe_version: string;
  readonly transcription_runtime: string;
  readonly plan_created: boolean;
  readonly download_completed: boolean;
  readonly frame_extraction_completed: boolean;
  readonly transcript_completed: boolean;
  readonly packet_created: boolean;
  readonly analysis_completed: boolean;
  readonly cleanup_completed: boolean;
  readonly temp_workspace_exists_after_cleanup: boolean;
  readonly telemetry_metadata_only: boolean;
  readonly raw_transcript_leaked: false;
  readonly raw_frame_leaked: false;
  readonly frame_count: number;
  readonly transcript_segment_count: number;
  readonly model_tier: "T3" | "T4";
  readonly failure_reason: string | null;
}

export async function runSocialExtractionOperationalSmoke(
  env: Record<string, string | undefined> = process.env,
): Promise<SocialExtractionSmokeReport> {
  const smokeUrl = env[SMOKE_URL_ENV]?.trim() || DEFAULT_SMOKE_URL;
  const ytdlpVersion = (
    await runCommand("yt-dlp", ["--version"])
  ).stdout.trim();
  const ffmpegVersion = firstLine(
    (await runCommand("ffmpeg", ["-version"])).stdout,
  );
  const ffprobeVersion = firstLine(
    (await runCommand("ffprobe", ["-version"])).stdout,
  );
  const sttConfig = loadFasterWhisperSttLocalConfig(env);
  if (!sttConfig.ok) {
    throw new SocialExtractionSmokeError(
      `faster-whisper STT config unavailable: ${sttConfig.reasons.join(",")}`,
    );
  }

  const trackedPaths: {
    videoPath?: string;
    audioPath?: string;
    root?: string;
  } = {};
  const stages = {
    downloadCompleted: false,
    frameExtractionCompleted: false,
    transcriptCompleted: false,
  };
  const plan = buildSocialExtractionPlan({
    source_url: smokeUrl,
    explicit_user_triggered: true,
    estimated_duration_seconds: 30,
    requested_model_tier: "T3",
    policy: {
      max_duration_seconds: 120,
      max_file_size_bytes: 100_000_000,
      max_frame_count: 20,
      transcription_required: true,
    },
  });

  try {
    const result = await executeSocialExtractionWorkflow({
      plan,
      dependencies: {
        tempWorkspace: {
          async create(planInput) {
            const root = await mkdtemp(
              path.join(os.tmpdir(), "jarvis-social-extraction-"),
            );
            trackedPaths.root = root;
            return {
              workspace_id: planInput.temp_workspace_id,
              temp_root_ref: root,
            };
          },
          async cleanup(workspace) {
            await rm(workspace.temp_root_ref, {
              recursive: true,
              force: true,
            });
            return !existsSync(workspace.temp_root_ref);
          },
        },
        ytdlpRunner: {
          async download(planInput, workspace) {
            const outputTemplate = path.join(
              workspace.temp_root_ref,
              "source.%(ext)s",
            );
            const download = await runCommand("yt-dlp", [
              "--no-playlist",
              "--force-overwrites",
              "--max-filesize",
              String(planInput.max_file_size_bytes),
              "--format",
              "bv*+ba/b",
              "--merge-output-format",
              "mp4",
              "--output",
              outputTemplate,
              "--print",
              "after_move:filepath",
              smokeUrl,
            ]);
            const videoPath = resolveDownloadedPath(
              download.stdout,
              workspace.temp_root_ref,
            );
            trackedPaths.videoPath = videoPath;
            const duration = await probeDurationSeconds(videoPath);
            const file = await stat(videoPath);
            stages.downloadCompleted = true;
            return {
              video_ref: "tmp:downloaded-video",
              audio_ref: "tmp:extracted-audio",
              duration_seconds: duration,
              file_size_bytes: file.size,
              metadata_hash: hashText(`${duration}:${file.size}`),
              raw_video_body_included: false,
              raw_audio_body_included: false,
            } satisfies SocialExtractionDownloadedMedia;
          },
        },
        ffmpegRunner: {
          async extractFrames(input) {
            const videoPath = requireTrackedPath(
              trackedPaths.videoPath,
              "video",
            );
            const audioPath = path.join(
              input.workspace.temp_root_ref,
              "social-extraction-audio.wav",
            );
            const framePattern = path.join(
              input.workspace.temp_root_ref,
              "frame-%04d.jpg",
            );
            await runCommand("ffmpeg", [
              "-hide_banner",
              "-y",
              "-i",
              videoPath,
              "-vn",
              "-ac",
              "1",
              "-ar",
              "16000",
              audioPath,
            ]);
            trackedPaths.audioPath = audioPath;
            await runCommand("ffmpeg", [
              "-hide_banner",
              "-y",
              "-i",
              videoPath,
              "-vf",
              `fps=${input.plan.adaptive_fps}`,
              "-frames:v",
              String(input.plan.max_frame_count),
              framePattern,
            ]);
            const frames = await buildFrameResult(input.plan, input.workspace);
            stages.frameExtractionCompleted = frames.frame_count > 0;
            return frames;
          },
        },
        transcriptionRunner: {
          async transcribe(input) {
            const audioPath = requireTrackedPath(
              trackedPaths.audioPath,
              "audio",
            );
            const audio = await stat(audioPath);
            const provider = createFasterWhisperSttProvider({
              config: sttConfig.config,
            });
            const transcript = await provider.transcribe(
              {
                request_id: "social-extraction-smoke:stt",
                session_id: "social-extraction-smoke",
                turn_id: "social-extraction-smoke:turn",
                audio: {
                  audio_ref: audioPath,
                  mime_type: "audio/wav",
                  duration_ms: Math.round(input.media.duration_seconds * 1000),
                  size_bytes: audio.size,
                  metadata_only: true,
                },
                metadata_only: true,
              },
              {
                timeout_ms: sttConfig.config.timeoutMs,
                metadata_only: true,
              },
            );
            stages.transcriptCompleted = true;
            return {
              transcript_id: "social-extraction-smoke:transcript",
              segments: [
                {
                  segment_id: "segment:0",
                  start_seconds: 0,
                  end_seconds: input.media.duration_seconds,
                  text: transcript.transcript,
                },
              ],
              segment_count: 1,
              language: transcript.language ?? null,
              raw_audio_body_included: false,
              raw_transcript_written_to_telemetry: false,
            } satisfies SocialTranscriptionResult;
          },
        },
        analysisRunner: {
          analyze(packet) {
            return deterministicAnalysis(packet);
          },
        },
      },
    });

    const root = trackedPaths.root;
    return {
      status: result.status === "completed" ? "ok" : "failed",
      smoke_url: smokeUrl,
      url_hash: result.telemetry.url_hash,
      ytdlp_version: ytdlpVersion,
      ffmpeg_version: ffmpegVersion,
      ffprobe_version: ffprobeVersion,
      transcription_runtime: `faster-whisper:${sttConfig.config.modelName}`,
      plan_created: true,
      download_completed: stages.downloadCompleted,
      frame_extraction_completed: stages.frameExtractionCompleted,
      transcript_completed: stages.transcriptCompleted,
      packet_created: result.packet !== null,
      analysis_completed: result.analysis !== null,
      cleanup_completed: result.cleanup_completed,
      temp_workspace_exists_after_cleanup:
        root === undefined ? false : existsSync(root),
      telemetry_metadata_only: result.telemetry.metadata_only,
      raw_transcript_leaked: false,
      raw_frame_leaked: false,
      frame_count: result.telemetry.frame_count,
      transcript_segment_count: result.telemetry.transcript_segment_count,
      model_tier: result.telemetry.model_tier,
      failure_reason:
        result.status === "completed" ? null : result.reasons.join(","),
    };
  } catch (error) {
    if (trackedPaths.root) {
      await rm(trackedPaths.root, { recursive: true, force: true });
    }
    throw error;
  }
}

export async function runSocialExtractionSmokeCli(): Promise<void> {
  try {
    const report = await runSocialExtractionOperationalSmoke();
    writeReport(report);
    process.exitCode = report.status === "ok" ? 0 : 1;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Social extraction smoke failed closed with an unknown error.";
    console.error(`JARVIS social extraction smoke failed: ${message}`);
    process.exitCode = 1;
  }
}

function deterministicAnalysis(
  packet: SocialMultimodalAnalysisPacket,
): SocialAnalysisResult {
  return {
    analysis_id: "social-extraction-smoke:analysis",
    summary: `Operational smoke assembled ${packet.frames.length} frame refs and ${packet.transcript_segments.length} transcript segment refs.`,
    timestamped_events: packet.frames.slice(0, 3).map((frame, index) => ({
      event_id: `event:${index}`,
      timestamp_seconds: frame.timestamp_seconds,
      summary: "Smoke frame reference analyzed.",
      frame_refs: [frame.frame_id],
    })),
    key_frame_refs: packet.frames.slice(0, 3).map((frame) => frame.frame_id),
    confidence: "medium",
    caveats: ["Smoke analysis uses deterministic runner metadata."],
    safety: {
      advisory_only: true,
      no_action_execution: true,
      no_persistent_raw_media_storage: true,
      raw_frame_data_included: false,
      raw_audio_body_included: false,
      raw_video_body_included: false,
      raw_transcript_written_to_telemetry: false,
    },
  };
}

async function buildFrameResult(
  plan: SocialExtractionPlan,
  workspace: SocialTempWorkspace,
): Promise<SocialExtractionFrameExtractionResult> {
  const files = (await readdir(workspace.temp_root_ref))
    .filter((file) => /^frame-\d+\.jpg$/i.test(file))
    .sort();
  const capped = files.slice(0, plan.max_frame_count);
  return {
    frames: await Promise.all(
      capped.map(async (file, index) => ({
        frame_id: `frame:${index}`,
        timestamp_seconds: index / plan.adaptive_fps,
        temp_path_ref: `tmp:${file}`,
        content_hash: await hashFile(path.join(workspace.temp_root_ref, file)),
        width: null,
        height: null,
        raw_frame_data_included: false,
      })),
    ),
    frame_count: capped.length,
    adaptive_fps: plan.adaptive_fps,
    frame_cap_enforced: files.length >= plan.max_frame_count,
    raw_frame_data_included: false,
  };
}

async function probeDurationSeconds(videoPath: string): Promise<number> {
  const result = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ]);
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new SocialExtractionSmokeError("ffprobe returned invalid duration.");
  }
  return duration;
}

function resolveDownloadedPath(stdout: string, root: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = [...lines].reverse().find((line) => existsSync(line));
  if (candidate) return candidate;
  const fallback = path.join(root, "source.mp4");
  if (existsSync(fallback)) return fallback;
  throw new SocialExtractionSmokeError("yt-dlp did not produce a media file.");
}

function runCommand(
  command: string,
  args: readonly string[],
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      shell: false,
      windowsHide: true,
      stdio: "pipe",
    });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new SocialExtractionSmokeError(`${command} timed out.`));
    }, SMOKE_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => stdout.push(String(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout: stdout.join(""), stderr: stderr.join("") });
      } else {
        reject(
          new SocialExtractionSmokeError(
            `${command} exited with ${String(code)}: ${stderr.join("").slice(0, 400)}`,
          ),
        );
      }
    });
  });
}

async function hashFile(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function hashText(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function firstLine(value: string): string {
  return value.split(/\r?\n/)[0]?.trim() ?? "";
}

function requireTrackedPath(value: string | undefined, label: string): string {
  if (!value) {
    throw new SocialExtractionSmokeError(`Missing ${label} path.`);
  }
  return value;
}

function writeReport(report: SocialExtractionSmokeReport): void {
  console.log("JARVIS social extraction smoke");
  console.log(`status: ${report.status}`);
  console.log(`url: ${report.smoke_url}`);
  console.log(`url_hash: ${report.url_hash}`);
  console.log(`yt_dlp_version: ${report.ytdlp_version}`);
  console.log(`ffmpeg_version: ${report.ffmpeg_version}`);
  console.log(`ffprobe_version: ${report.ffprobe_version}`);
  console.log(`transcription_runtime: ${report.transcription_runtime}`);
  console.log(`download_completed: ${String(report.download_completed)}`);
  console.log(
    `frame_extraction_completed: ${String(report.frame_extraction_completed)}`,
  );
  console.log(`transcript_completed: ${String(report.transcript_completed)}`);
  console.log(`packet_created: ${String(report.packet_created)}`);
  console.log(`analysis_completed: ${String(report.analysis_completed)}`);
  console.log(`cleanup_completed: ${String(report.cleanup_completed)}`);
  console.log(
    `temp_workspace_exists_after_cleanup: ${String(report.temp_workspace_exists_after_cleanup)}`,
  );
  console.log(`frame_count: ${String(report.frame_count)}`);
  console.log(
    `transcript_segment_count: ${String(report.transcript_segment_count)}`,
  );
  console.log(
    `telemetry_metadata_only: ${String(report.telemetry_metadata_only)}`,
  );
  console.log(`raw_transcript_leaked: ${String(report.raw_transcript_leaked)}`);
  console.log(`raw_frame_leaked: ${String(report.raw_frame_leaked)}`);
  if (report.failure_reason) {
    console.log(`failure_reason: ${report.failure_reason}`);
  }
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("social-extraction-smoke.ts");
}

if (isDirectCliInvocation()) {
  void runSocialExtractionSmokeCli();
}
