import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEMO_RECORDING_TARGETS,
  DEMO_SCRIPT_RECRUITER,
  createDemoRecordingPlan,
  prepareDemoNarration,
} from "@/lib/demo-director";
import {
  architectureMarkdown,
  createDemoExportPackage,
  linkedinMarkdown,
  releaseNotesMarkdown,
  transcriptMarkdown,
} from "@/lib/demo-director/export-package";
import type {
  DemoBrowserCaptureInput,
  DemoBrowserCaptureResult,
} from "@/lib/demo-director/browser-capture";

let tmpRoot: string | null = null;

afterEach(async () => {
  if (tmpRoot) {
    await rm(tmpRoot, { recursive: true, force: true });
    tmpRoot = null;
  }
});

async function tempRoot() {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), "jarvis-demo-export-"));
  return tmpRoot;
}

async function fakeCaptureBackend(
  input: DemoBrowserCaptureInput,
): Promise<DemoBrowserCaptureResult> {
  await mkdir(input.screenshots_dir, { recursive: true });
  const screenshot_paths = {
    reactor: path.join(input.screenshots_dir, "reactor.png"),
    pipeline: path.join(input.screenshots_dir, "pipeline.png"),
    working: path.join(input.screenshots_dir, "working.png"),
    audit: path.join(input.screenshots_dir, "audit.png"),
  } as const;
  await writeFile(input.demo_mp4_path, Buffer.from("real-capture-test-video"));
  await Promise.all(
    Object.values(screenshot_paths).map((screenshotPath) =>
      writeFile(screenshotPath, Buffer.from("png")),
    ),
  );
  return {
    video_path: input.demo_mp4_path,
    raw_video_path: path.join(input.output_dir, "raw.webm"),
    screenshot_paths,
    capture_engine: "playwright-chromium",
    real_browser_capture: true,
    mp4_transcoded: true,
    metadata_only: true,
    local_disk_only: true,
    upload_performed: false,
    post_performed: false,
  };
}

describe("DD.12 recording and export", () => {
  it("creates a synchronized recording plan for reactor, pipeline, working, and audit", async () => {
    const narration = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
    });
    const plan = createDemoRecordingPlan({
      script: DEMO_SCRIPT_RECRUITER,
      narration,
    });

    expect(plan.synchronized_timeline).toBe(true);
    expect(plan.screen_capture_enabled).toBe(true);
    expect(plan.audio_capture_enabled).toBe(true);
    expect(plan.camera_capture_enabled).toBe(false);
    expect(plan.execution_bypass_enabled).toBe(false);
    expect(plan.frames.map((frame) => frame.target)).toEqual([
      ...DEMO_RECORDING_TARGETS,
    ]);
  });

  it("writes the required local export directory structure", async () => {
    const narration = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
    });
    const pkg = await createDemoExportPackage({
      script: DEMO_SCRIPT_RECRUITER,
      narration,
      outputRoot: await tempRoot(),
      timestamp: "2026-06-06T12:00:00.000Z",
      capture_backend: fakeCaptureBackend,
    });

    await expect(stat(pkg.demo_mp4_path)).resolves.toMatchObject({
      isFile: expect.any(Function),
    });
    for (const target of DEMO_RECORDING_TARGETS) {
      await expect(stat(pkg.screenshot_paths[target])).resolves.toBeTruthy();
    }
    await expect(stat(pkg.transcript_path)).resolves.toBeTruthy();
    await expect(stat(pkg.architecture_summary_path)).resolves.toBeTruthy();
    await expect(stat(pkg.linkedin_post_path)).resolves.toBeTruthy();
    await expect(stat(pkg.release_notes_path)).resolves.toBeTruthy();
    expect(path.basename(pkg.root_dir)).toBe("2026-06-06T12-00-00.000Z");
    expect(pkg.real_browser_capture).toBe(true);
    expect(pkg.export_validation.valid).toBe(true);
    expect(pkg.local_disk_only).toBe(true);
  });

  it("generates transcript, architecture summary, LinkedIn draft, and release notes", async () => {
    const narration = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
    });
    const transcript = transcriptMarkdown(DEMO_SCRIPT_RECRUITER, narration);
    const architecture = architectureMarkdown(DEMO_SCRIPT_RECRUITER);
    const linkedin = linkedinMarkdown(DEMO_SCRIPT_RECRUITER);
    const releaseNotes = releaseNotesMarkdown(DEMO_SCRIPT_RECRUITER);

    expect(transcript).toContain("Recruiter Demo Transcript");
    expect(architecture).toContain(
      "Pipeline is the authoritative UI direction",
    );
    expect(linkedin).toContain("No auto-posting");
    expect(releaseNotes).toContain("DD.11 narration");
  });

  it("does not auto-post, auto-upload, or bypass approval authority", async () => {
    const narration = await prepareDemoNarration({
      script: DEMO_SCRIPT_RECRUITER,
    });
    const pkg = await createDemoExportPackage({
      script: DEMO_SCRIPT_RECRUITER,
      narration,
      outputRoot: await tempRoot(),
      timestamp: "2026-06-06T12:00:00.000Z",
      capture_backend: fakeCaptureBackend,
    });

    expect(pkg.upload_performed).toBe(false);
    expect(pkg.post_performed).toBe(false);
    expect(pkg.share_performed).toBe(false);
    expect(pkg.execution_bypass_enabled).toBe(false);
    expect(pkg.manifest.upload_performed).toBe(false);
    expect(pkg.manifest.post_performed).toBe(false);
    expect(pkg.manifest.execution_bypass_enabled).toBe(false);

    const linkedin = await readFile(pkg.linkedin_post_path, "utf8");
    expect(linkedin).toContain("No auto-uploading");
  });
});
