import { mkdir, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import type { DemoRecordingFrame, DemoRecordingTarget } from "./recording";

export interface DemoBrowserCaptureInput {
  base_url: string;
  output_dir: string;
  screenshots_dir: string;
  frames: readonly DemoRecordingFrame[];
  demo_mp4_path: string;
  viewport?: { width: number; height: number };
  dwell_ms?: number;
  ffmpeg_path?: string;
}

export interface DemoBrowserCaptureResult {
  video_path: string;
  raw_video_path: string;
  screenshot_paths: Record<DemoRecordingTarget, string>;
  capture_engine: "playwright-chromium";
  real_browser_capture: true;
  mp4_transcoded: boolean;
  metadata_only: true;
  local_disk_only: true;
  upload_performed: false;
  post_performed: false;
}

export async function captureDemoWithPlaywright(
  input: DemoBrowserCaptureInput,
): Promise<DemoBrowserCaptureResult> {
  const { chromium } = await import("playwright");
  const videoDir = path.join(input.output_dir, ".playwright-video");
  await mkdir(videoDir, { recursive: true });
  await mkdir(input.screenshots_dir, { recursive: true });

  const screenshot_paths = screenshotPathMap(input.screenshots_dir);
  const browser = await chromium.launch({ headless: true });
  let rawVideoPath = "";
  try {
    const context = await browser.newContext({
      viewport: input.viewport ?? { width: 1920, height: 1080 },
      recordVideo: {
        dir: videoDir,
        size: input.viewport ?? { width: 1920, height: 1080 },
      },
    });
    const page = await context.newPage();

    for (const frame of input.frames) {
      await page.goto(new URL(frame.route, input.base_url).toString(), {
        waitUntil: "networkidle",
        timeout: 30_000,
      });
      await page.waitForTimeout(input.dwell_ms ?? 1_200);
      await page.screenshot({
        path: screenshot_paths[frame.target],
        fullPage: true,
      });
    }

    const video = page.video();
    await context.close();
    rawVideoPath = video ? await video.path() : await latestVideo(videoDir);
  } finally {
    await browser.close();
  }

  const transcoded = await transcodeToMp4({
    input_path: rawVideoPath,
    output_path: input.demo_mp4_path,
    ffmpeg_path: input.ffmpeg_path,
  });
  if (!transcoded) {
    await rename(rawVideoPath, input.demo_mp4_path);
  }

  return {
    video_path: input.demo_mp4_path,
    raw_video_path: rawVideoPath,
    screenshot_paths,
    capture_engine: "playwright-chromium",
    real_browser_capture: true,
    mp4_transcoded: transcoded,
    metadata_only: true,
    local_disk_only: true,
    upload_performed: false,
    post_performed: false,
  };
}

export async function validateDemoExportFiles(input: {
  demo_mp4_path: string;
  screenshot_paths: Record<DemoRecordingTarget, string>;
}): Promise<{
  valid: boolean;
  demo_mp4_bytes: number;
  screenshot_count: number;
  metadata_only: true;
}> {
  const video = await stat(input.demo_mp4_path);
  let screenshotCount = 0;
  for (const screenshotPath of Object.values(input.screenshot_paths)) {
    const item = await stat(screenshotPath);
    if (item.size > 0) screenshotCount += 1;
  }
  return {
    valid: video.size > 0 && screenshotCount === 4,
    demo_mp4_bytes: video.size,
    screenshot_count: screenshotCount,
    metadata_only: true,
  };
}

function screenshotPathMap(
  screenshotsDir: string,
): Record<DemoRecordingTarget, string> {
  return {
    reactor: path.join(screenshotsDir, "reactor.png"),
    pipeline: path.join(screenshotsDir, "pipeline.png"),
    working: path.join(screenshotsDir, "working.png"),
    audit: path.join(screenshotsDir, "audit.png"),
  };
}

async function latestVideo(videoDir: string): Promise<string> {
  const files = await readdir(videoDir);
  const webm = files.filter((file) => file.endsWith(".webm"));
  if (webm.length === 0) {
    throw new Error("Playwright did not produce a demo video.");
  }
  return path.join(videoDir, webm[webm.length - 1]!);
}

async function transcodeToMp4(input: {
  input_path: string;
  output_path: string;
  ffmpeg_path?: string;
}): Promise<boolean> {
  const ffmpeg = input.ffmpeg_path ?? "ffmpeg";
  return new Promise((resolve) => {
    const child = spawn(ffmpeg, [
      "-y",
      "-i",
      input.input_path,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      input.output_path,
    ]);
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}
