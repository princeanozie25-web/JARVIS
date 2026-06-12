import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  executeVideoIngest,
  type VideoIngestTelemetryEvent,
} from "../src/lib/video-extraction";

// Phase 23C real-execution smoke: local-file ingest only (URL-source real
// execution is 23G evidence). Generates its own 5-second clip via ffmpeg
// lavfi sources — no network. Uses EXPLICIT OVERRIDE config paths so the
// committed config/vision/*.yaml stay byte-untouched and default-deny
// (verified below via before/after hashes — invariant I-23C-5).

const SMOKE_TIMEOUT_MS = 120_000;

function runCommand(
  command: string,
  args: readonly string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, [...args], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`${command} timed out`));
    }, SMOKE_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function versionLine(
  command: string,
  flag: string,
): Promise<string | null> {
  try {
    const result = await runCommand(command, [flag]);
    if (result.code !== 0) return null;
    const line = (result.stdout || result.stderr).split(/\r?\n/)[0]?.trim();
    return line && line.length > 0 ? line : null;
  } catch {
    return null;
  }
}

async function sha256File(filePath: string): Promise<string> {
  const body = await readFile(filePath);
  return createHash("sha256").update(body).digest("hex");
}

function consentOverrideYaml(): string {
  return [
    "version: phase23.vision.standing-consent.v1",
    "owner_controlled: true",
    "auditable: true",
    "revocable: true",
    "vision_may_grant_consent: false",
    "no_self_expansion: true",
    "metadata_only: true",
    "consents:",
    "  - id: video_ingest_local_file",
    "    label: Smoke-run local file ingest",
    "    tier: T2",
    "    action: video_ingest",
    "    scope: vision.smoke.local_file",
    "    granted: true",
    "    revoked: false",
    "    granted_by: user_config",
    "    audit_event: standing-consent:video_ingest_local_file",
  ].join("\n");
}

function allowlistOverrideYaml(): string {
  const platform = (name: string, enabled: boolean) =>
    `  ${name}:\n    enabled: ${enabled}`;
  return [
    "version: phase23.vision.source-allowlist.v1",
    "owner_controlled: true",
    "metadata_only: true",
    "platforms:",
    platform("youtube", false),
    platform("instagram_reels", false),
    platform("tiktok", false),
    platform("x_twitter", false),
    platform("local_file", true),
    "caps:",
    "  max_filesize_mb: 512",
    "  max_duration_s: 3600",
    "  max_frames_per_video: 120",
    "  frame_sample_fps: 1",
  ].join("\n");
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const realConsentPath = path.resolve(
    repoRoot,
    "config/vision/standing-consent.yaml",
  );
  const realAllowlistPath = path.resolve(
    repoRoot,
    "config/vision/source-allowlist.yaml",
  );
  const consentHashBefore = await sha256File(realConsentPath);
  const allowlistHashBefore = await sha256File(realAllowlistPath);

  const root = await mkdtemp(path.join(os.tmpdir(), "jarvis-video-smoke-"));
  try {
    const sourceDir = path.join(root, "sources");
    await mkdir(sourceDir, { recursive: true });
    const clipPath = path.join(sourceDir, "smoke-clip.mp4");

    console.log(
      "[smoke] generating 5s test clip via ffmpeg lavfi (no network)",
    );
    const generate = await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=320x240:d=5",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=5",
      "-shortest",
      "-pix_fmt",
      "yuv420p",
      clipPath,
    ]);
    if (generate.code !== 0) {
      throw new Error(
        `ffmpeg clip generation failed: ${generate.stderr.slice(0, 400)}`,
      );
    }

    const consentOverridePath = path.join(root, "consent-override.yaml");
    const allowlistOverridePath = path.join(root, "allowlist-override.yaml");
    await writeFile(consentOverridePath, consentOverrideYaml(), "utf8");
    await writeFile(allowlistOverridePath, allowlistOverrideYaml(), "utf8");

    const emitted: VideoIngestTelemetryEvent[] = [];
    const result = await executeVideoIngest(
      {
        source: {
          kind: "local_file",
          path: "sources/smoke-clip.mp4",
          local_source_root: root,
        },
        explicit_user_triggered: true,
        consent_config_path: consentOverridePath,
        allowlist_config_path: allowlistOverridePath,
        artifact_root: path.join(root, "artifacts"),
      },
      {
        versionProbe: {
          ytdlp: () => versionLine("yt-dlp", "--version"),
          ffmpeg: () => versionLine("ffmpeg", "-version"),
          ffprobe: () => versionLine("ffprobe", "-version"),
        },
        ffprobeRunner: {
          probeDurationSeconds: async (mediaPath: string) => {
            const probe = await runCommand("ffprobe", [
              "-v",
              "error",
              "-show_entries",
              "format=duration",
              "-of",
              "default=noprint_wrappers=1:nokey=1",
              mediaPath,
            ]);
            if (probe.code !== 0) {
              throw new Error(`ffprobe failed: ${probe.stderr.slice(0, 200)}`);
            }
            return Number.parseFloat(probe.stdout.trim());
          },
        },
        emitTelemetry: (event) => {
          emitted.push(event);
        },
      },
    );

    console.log(`[smoke] result status: ${result.status}`);
    console.log(
      `[smoke] emitted events: ${emitted
        .map((event) => event.event_type)
        .join(", ")}`,
    );
    if (result.status !== "completed" || !result.manifest) {
      throw new Error(
        `smoke ingest did not complete: ${result.reasons.join(",")}`,
      );
    }
    const manifestRaw = await readFile(
      path.join(result.artifact_dir as string, "manifest.json"),
      "utf8",
    );
    console.log("[smoke] manifest.json:");
    console.log(manifestRaw.trim());

    const serializedEvents = JSON.stringify(emitted);
    if (
      serializedEvents.includes("smoke-clip") ||
      serializedEvents.includes(root.replaceAll("\\", "\\\\"))
    ) {
      throw new Error(
        "telemetry hygiene violation: raw path leaked into events",
      );
    }
    console.log("[smoke] telemetry hygiene: no raw path in events PASS");

    const consentHashAfter = await sha256File(realConsentPath);
    const allowlistHashAfter = await sha256File(realAllowlistPath);
    if (
      consentHashBefore !== consentHashAfter ||
      allowlistHashBefore !== allowlistHashAfter
    ) {
      throw new Error(
        "I-23C-5 VIOLATION: committed config/vision files changed",
      );
    }
    console.log(
      `[smoke] I-23C-5 config byte-identity PASS (consent sha256:${consentHashBefore.slice(0, 12)}..., allowlist sha256:${allowlistHashBefore.slice(0, 12)}...)`,
    );
    console.log("[smoke] PHASE 23C LOCAL-FILE SMOKE: OK");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    `[smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
