import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildPipelineVisualizationModel } from "../pipeline-visualization";
import {
  captureDemoWithPlaywright,
  validateDemoExportFiles,
  type DemoBrowserCaptureInput,
  type DemoBrowserCaptureResult,
} from "./browser-capture";
import type { DemoScript } from "./contracts";
import type { DemoNarrationTrack } from "./narration";
import {
  assertRecordingPlanSafe,
  createDemoRecordingPlan,
  type DemoRecordingManifest,
  type DemoRecordingTarget,
} from "./recording";

export interface DemoExportPackage {
  export_id: string;
  root_dir: string;
  demo_mp4_path: string;
  screenshots_dir: string;
  screenshot_paths: Record<DemoRecordingTarget, string>;
  transcript_path: string;
  architecture_summary_path: string;
  linkedin_post_path: string;
  release_notes_path: string;
  manifest: DemoRecordingManifest;
  capture_result: DemoBrowserCaptureResult;
  export_validation: Awaited<ReturnType<typeof validateDemoExportFiles>>;
  real_browser_capture: true;
  local_disk_only: true;
  upload_performed: false;
  post_performed: false;
  share_performed: false;
  execution_bypass_enabled: false;
}

export interface CreateDemoExportInput {
  script: DemoScript;
  narration: DemoNarrationTrack;
  outputRoot?: string;
  timestamp: string;
  baseUrl?: string;
  capture_backend?: (
    input: DemoBrowserCaptureInput,
  ) => Promise<DemoBrowserCaptureResult>;
  dwell_ms?: number;
  ffmpeg_path?: string;
}

export async function createDemoExportPackage(
  input: CreateDemoExportInput,
): Promise<DemoExportPackage> {
  const root = path.resolve(
    input.outputRoot ?? "demo-exports",
    safeTimestamp(input.timestamp),
  );
  const screenshotsDir = path.join(root, "screenshots");
  await mkdir(screenshotsDir, { recursive: true });

  const plan = createDemoRecordingPlan({
    script: input.script,
    narration: input.narration,
  });
  assertRecordingPlanSafe(plan);

  const demoMp4Path = path.join(root, "demo.mp4");
  const transcriptPath = path.join(root, "transcript.md");
  const architectureSummaryPath = path.join(root, "architecture-summary.md");
  const linkedinPostPath = path.join(root, "linkedin-post.md");
  const releaseNotesPath = path.join(root, "release-notes.md");

  await Promise.all([
    writeFile(
      transcriptPath,
      transcriptMarkdown(input.script, input.narration),
    ),
    writeFile(architectureSummaryPath, architectureMarkdown(input.script)),
    writeFile(linkedinPostPath, linkedinMarkdown(input.script)),
    writeFile(releaseNotesPath, releaseNotesMarkdown(input.script)),
  ]);

  const captureBackend = input.capture_backend ?? captureDemoWithPlaywright;
  if (!input.capture_backend && !input.baseUrl) {
    throw new Error(
      "Real demo export requires a baseUrl for Playwright browser capture.",
    );
  }
  const capture_result = await captureBackend({
    base_url: input.baseUrl ?? "http://127.0.0.1:3000",
    output_dir: root,
    screenshots_dir: screenshotsDir,
    frames: plan.frames,
    demo_mp4_path: demoMp4Path,
    dwell_ms: input.dwell_ms,
    ffmpeg_path: input.ffmpeg_path,
  });
  const export_validation = await validateDemoExportFiles({
    demo_mp4_path: demoMp4Path,
    screenshot_paths: capture_result.screenshot_paths,
  });
  if (!export_validation.valid) {
    throw new Error("Demo export validation failed.");
  }

  const manifest: DemoRecordingManifest = {
    recording_id: `demo-recording:${input.script.audience}:${safeTimestamp(
      input.timestamp,
    )}`,
    plan,
    mp4_path: demoMp4Path,
    screenshot_paths: capture_result.screenshot_paths,
    transcript_path: transcriptPath,
    metadata_only: true,
    local_disk_only: true,
    upload_performed: false,
    post_performed: false,
    execution_bypass_enabled: false,
  };

  return {
    export_id: `demo-export:${input.script.audience}:${safeTimestamp(
      input.timestamp,
    )}`,
    root_dir: root,
    demo_mp4_path: demoMp4Path,
    screenshots_dir: screenshotsDir,
    screenshot_paths: capture_result.screenshot_paths,
    transcript_path: transcriptPath,
    architecture_summary_path: architectureSummaryPath,
    linkedin_post_path: linkedinPostPath,
    release_notes_path: releaseNotesPath,
    manifest,
    capture_result,
    export_validation,
    real_browser_capture: true,
    local_disk_only: true,
    upload_performed: false,
    post_performed: false,
    share_performed: false,
    execution_bypass_enabled: false,
  };
}

export function transcriptMarkdown(
  script: DemoScript,
  narration: DemoNarrationTrack,
): string {
  const lines = narration.lines
    .map((line) => `- ${formatMs(line.at_ms)} - ${line.text}`)
    .join("\n");
  return `# ${script.title} Transcript

Audience: ${script.audience}

${lines}
`;
}

export function architectureMarkdown(script: DemoScript): string {
  const model = buildPipelineVisualizationModel();
  return `# Pipeline Architecture Summary

Demo: ${script.title}

Pipeline is the authoritative UI direction. The removed gauntlet direction is not part of this product path.

Stages: ${model.stages.map((stage) => stage.label).join(" -> ")}

Governance posture: ${model.summary.governance_posture}

Human Gate: proposals halt at the approval boundary before any side effect can proceed.

Audit: replay and telemetry stay read-only and metadata-only.
`;
}

export function linkedinMarkdown(script: DemoScript): string {
  return `# LinkedIn Draft

I built a JARVIS demo director that can create a ${script.audience} demo of itself: generate the script, narrate it, play the governed pipeline, record the session locally, and export a recruiter-ready package.

No auto-posting. No auto-uploading. No silent execution. The pipeline is the product UI direction.
`;
}

export function releaseNotesMarkdown(script: DemoScript): string {
  return `# Release Notes

- Added DD.11 narration planning with Chatterbox, Kokoro, and local fallback ordering.
- Added DD.12 local recording and export orchestration.
- Integrated demo playback around Rest, Working, Audit, and the Pipeline Command Center.
- Preserved approval and publishing boundaries: no auto-posting, no upload, no execution bypass.

Demo fixture: ${script.script_id}
`;
}

function safeTimestamp(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^0-9A-Za-z._:-]+/g, "-")
    .replace(/:/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatMs(value: number): string {
  const seconds = Math.floor(value / 1000);
  return `${seconds}s`;
}
