import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { executeVideoPipeline } from "../src/lib/video-extraction";
import { createFasterWhisperSttProvider } from "../src/lib/voice-runtime";

// Phase 23D real-execution smoke: ingest -> frames -> transcript -> packet on
// a locally generated clip, inside one real vision session. Real ffmpeg frame
// extraction and REAL faster-whisper transcription against locally generated
// SAPI speech (the frozen Phase 22 STT contract fails closed on empty
// transcripts, so the clip must contain real words — still no network).
// Committed config/vision/*.yaml stay byte-untouched and default-deny
// (asserted, invariant I-23D-6). If the Python faster-whisper runtime is
// missing, this HALTS with a clear report — no mock fallback, no installs.

const SMOKE_TIMEOUT_MS = 300_000;

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
  const entry = (id: string) =>
    [
      `  - id: ${id}`,
      `    label: Smoke ${id}`,
      "    tier: T2",
      `    action: ${id}`,
      `    scope: vision.smoke.${id}`,
      "    granted: true",
      "    revoked: false",
      "    granted_by: user_config",
      `    audit_event: standing-consent:${id}`,
    ].join("\n");
  return [
    "version: phase23.vision.standing-consent.v1",
    "owner_controlled: true",
    "auditable: true",
    "revocable: true",
    "vision_may_grant_consent: false",
    "no_self_expansion: true",
    "metadata_only: true",
    "consents:",
    entry("video_ingest_local_file"),
    entry("frame_sampling"),
    entry("transcript_extraction"),
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
  // HALT-precheck: real faster-whisper runtime required; no mock fallback.
  const pythonProbe = await runCommand("python", [
    "-c",
    "import faster_whisper; print(faster_whisper.__version__)",
  ]);
  if (pythonProbe.code !== 0) {
    throw new Error(
      `HALT: Python faster-whisper runtime missing (probe stderr: ${pythonProbe.stderr.slice(0, 200)}). Install per docs/runbooks/phase23-runtime-setup.md; nothing was mocked or installed.`,
    );
  }
  console.log(
    `[smoke] faster-whisper python runtime: ${pythonProbe.stdout.trim()}`,
  );

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

  const root = await mkdtemp(path.join(os.tmpdir(), "jarvis-video-23d-"));
  try {
    const sourceDir = path.join(root, "sources");
    await mkdir(sourceDir, { recursive: true });
    const clipPath = path.join(sourceDir, "smoke-clip.mp4");

    // The frozen Phase 22 STT contract fails closed on an EMPTY transcript
    // (nonempty required by parseFasterWhisperJson), so a sine tone cannot
    // round-trip. Generate real speech via the local Windows SAPI voice —
    // still no network — and mux it under the test video.
    const speechPath = path.join(sourceDir, "speech.wav");
    console.log(
      "[smoke] generating local TTS speech via Windows SAPI (no network)",
    );
    const speak = await runCommand("powershell", [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${speechPath.replaceAll("\\", "\\\\")}'); $s.Speak('The quick brown fox jumps over the lazy dog. Phase twenty three pipeline smoke test.'); $s.Dispose()`,
    ]);
    if (speak.code !== 0) {
      throw new Error(
        `SAPI speech generation failed: ${speak.stderr.slice(0, 300)}`,
      );
    }

    console.log("[smoke] muxing test clip via ffmpeg (no network)");
    const generate = await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=320x240:d=8",
      "-i",
      speechPath,
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

    const sttProvider = createFasterWhisperSttProvider({
      config: {
        pythonCommand: "python",
        executablePath: "",
        modelName: "tiny",
        modelPath: path.join(os.homedir(), ".cache", "huggingface", "hub"),
        providerId: "faster-whisper-23d-smoke",
        beamSize: 5,
        vadEnabled: false,
        timeoutMs: 240_000,
        maxAudioBytes: 25_000_000,
        metadata_only: true,
      },
    });

    const emitted: Record<string, unknown>[] = [];
    const result = await executeVideoPipeline(
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
        session_surface: "developer_test",
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
        frameRunner: {
          extractFrames: async (input) => {
            const extract = await runCommand("ffmpeg", [
              "-y",
              "-i",
              input.media_path,
              "-vf",
              `fps=${input.frame_sample_fps}`,
              "-frames:v",
              String(input.max_frames),
              path.join(input.destination_dir, "frame-%04d.png"),
            ]);
            if (extract.code !== 0) {
              throw new Error(
                `ffmpeg frame extraction failed: ${extract.stderr.slice(0, 300)}`,
              );
            }
            const filenames = (await readdir(input.destination_dir)).sort();
            return { frame_filenames: filenames };
          },
        },
        audioRunner: {
          extractAudio: async (input) => {
            const extract = await runCommand("ffmpeg", [
              "-y",
              "-i",
              input.media_path,
              "-vn",
              "-ac",
              "1",
              "-ar",
              "16000",
              input.destination_path,
            ]);
            if (extract.code !== 0) {
              throw new Error(
                `ffmpeg audio extraction failed: ${extract.stderr.slice(0, 300)}`,
              );
            }
          },
        },
        sttProvider: {
          transcribe: async (request) => {
            const sttResult = await sttProvider.transcribe(
              request as never,
              {} as never,
            );
            return {
              transcript: sttResult.transcript,
              language: sttResult.language ?? "unknown",
              latency_ms: sttResult.latency_ms,
            };
          },
        },
        stt_model_name: "tiny",
        emitTelemetry: (event) => {
          emitted.push(event);
        },
      },
    );

    console.log(`[smoke] pipeline status: ${result.status}`);
    console.log(`[smoke] session state: ${result.session.state}`);
    console.log(
      `[smoke] emitted events: ${emitted
        .map((event) => String(event.event_type))
        .join(", ")}`,
    );
    if (result.status !== "completed" || !result.packet_path) {
      throw new Error(
        `smoke pipeline did not complete: ${result.reasons.join(",")}`,
      );
    }

    const frameCount = result.frames?.frame_refs.length ?? 0;
    const descriptorCount = result.frames?.descriptors_accepted ?? 0;
    const transcriptPath = result.transcript?.transcript_path as string;
    const transcriptBytes = (await stat(transcriptPath)).size;
    console.log(
      `[smoke] frames extracted: ${frameCount}; descriptors accepted: ${descriptorCount}`,
    );
    console.log(
      `[smoke] transcript.md written: ${existsSync(transcriptPath)} (${transcriptBytes} bytes; content stays in the artifact folder)`,
    );
    console.log(`[smoke] packet: ${result.packet_path}`);
    console.log(
      `[smoke] packet frame_refs: ${result.packet?.frame_refs.length}; model_tier: ${result.packet?.model_tier}`,
    );

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
        "I-23D-6 VIOLATION: committed config/vision files changed",
      );
    }
    console.log(
      `[smoke] I-23D-6 config byte-identity PASS (consent sha256:${consentHashBefore.slice(0, 12)}..., allowlist sha256:${allowlistHashBefore.slice(0, 12)}...)`,
    );
    console.log("[smoke] PHASE 23D PIPELINE SMOKE: OK");
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
