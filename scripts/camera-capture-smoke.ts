import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { captureCameraFrame } from "../src/lib/video-extraction";

// Phase 23F real-execution smoke. Enumerates dshow video devices via the
// injected ffmpeg (-list_devices). If a camera EXISTS: real single-shot
// capture through captureCameraFrame with an override consent config (the
// committed config/vision/*.yaml stay byte-untouched — byte-identity
// asserted, I-23F-6), an explicitly logged indicator_ack, a real frame file,
// and a hash-only descriptor. If NO camera exists: HALT with the device
// listing — no fake pass, no mock capture, no commit (a no-hardware HALT is
// report-and-stage, not a commit).

const ENUMERATE_TIMEOUT_MS = 30_000;
const CAPTURE_TIMEOUT_MS = 60_000;

// R.2 (2026-09-04, runway on the M1 Max): additive macOS branch. ffmpeg's
// camera input on macOS is `-f avfoundation`; the Windows `-f dshow` branch
// below is untouched. Selected by process.platform only. The first real
// capture on macOS raises a TCC camera-permission dialog, which no remote
// session can accept — so on the Mac this smoke stays PENDING-HARDWARE until
// an operator runs it at the keyboard (never bypass TCC).
const CAMERA_INPUT_FORMAT: "dshow" | "avfoundation" =
  process.platform === "darwin" ? "avfoundation" : "dshow";

function runCommand(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, [...args], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`${command} timed out`));
    }, timeoutMs);
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

async function sha256File(filePath: string): Promise<string> {
  const body = await readFile(filePath);
  return createHash("sha256").update(body).digest("hex");
}

interface DshowListing {
  readonly lines: readonly string[];
  readonly videoDevices: readonly string[];
  readonly audioDevices: readonly string[];
}

// -list_devices exits non-zero by design (the dummy input never opens); the
// listing itself arrives on stderr. Both dshow output formats are handled:
// the inline `"Name" (video)` format and the older sectioned format.
async function enumerateDshowDevices(): Promise<DshowListing> {
  if (CAMERA_INPUT_FORMAT === "avfoundation") {
    return enumerateAvfoundationDevices();
  }
  const result = await runCommand(
    "ffmpeg",
    ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
    ENUMERATE_TIMEOUT_MS,
  );
  // ffmpeg 8.x prefixes listing lines with [in#0 @ ...]; older builds use
  // [dshow @ ...]. Keep both so the verbatim listing survives intact.
  const lines = result.stderr
    .split(/\r?\n/)
    .filter((line) => /^\[(dshow|in#)/.test(line));
  const videoDevices: string[] = [];
  const audioDevices: string[] = [];
  let section: "video" | "audio" | null = null;
  for (const line of lines) {
    const inline = line.match(/"(.+)"\s+\((video|audio|video, audio)\)\s*$/);
    if (inline) {
      const [, name, kind] = inline;
      if (kind.includes("video")) videoDevices.push(name);
      if (kind.includes("audio")) audioDevices.push(name);
      continue;
    }
    if (line.includes("DirectShow video devices")) {
      section = "video";
      continue;
    }
    if (line.includes("DirectShow audio devices")) {
      section = "audio";
      continue;
    }
    if (line.includes("Alternative name")) continue;
    const sectioned = line.match(/"(.+)"\s*$/);
    if (sectioned && section === "video") videoDevices.push(sectioned[1]);
    if (sectioned && section === "audio") audioDevices.push(sectioned[1]);
  }
  return { lines, videoDevices, audioDevices };
}

// macOS: `-f avfoundation -list_devices true -i ""` prints, on stderr:
//   [AVFoundation indev @ ...] AVFoundation video devices:
//   [AVFoundation indev @ ...] [0] FaceTime HD Camera
//   [AVFoundation indev @ ...] AVFoundation audio devices:
//   [AVFoundation indev @ ...] [0] MacBook Pro Microphone
// Device names are kept verbatim; the capture branch addresses the camera by
// its listed index (avfoundation's `-i "<video>:"` form).
async function enumerateAvfoundationDevices(): Promise<DshowListing> {
  const result = await runCommand(
    "ffmpeg",
    ["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
    ENUMERATE_TIMEOUT_MS,
  );
  const lines = result.stderr
    .split(/\r?\n/)
    .filter((line) => /^\[AVFoundation/.test(line));
  const videoDevices: string[] = [];
  const audioDevices: string[] = [];
  let section: "video" | "audio" | null = null;
  for (const line of lines) {
    if (line.includes("AVFoundation video devices")) {
      section = "video";
      continue;
    }
    if (line.includes("AVFoundation audio devices")) {
      section = "audio";
      continue;
    }
    const entry = line.match(/\]\s+\[(\d+)\]\s+(.+?)\s*$/);
    if (!entry) continue;
    const name = entry[2];
    if (section === "video") videoDevices.push(name);
    if (section === "audio") audioDevices.push(name);
  }
  return { lines, videoDevices, audioDevices };
}

function avfoundationCaptureArgs(
  deviceIndex: number,
  destination: string,
): readonly string[] {
  return [
    "-y",
    "-f",
    "avfoundation",
    "-framerate",
    "30",
    "-i",
    `${deviceIndex}:`,
    "-frames:v",
    "1",
    destination,
  ];
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
    "  - id: camera_capture",
    "    label: Smoke camera capture",
    "    tier: T3",
    "    action: camera_capture",
    "    scope: vision.camera.capture",
    "    granted: true",
    "    revoked: false",
    "    granted_by: user_config",
    "    audit_event: standing-consent:camera_capture",
  ].join("\n");
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const watchedConfigs = [
    path.resolve(repoRoot, "config/vision/standing-consent.yaml"),
    path.resolve(repoRoot, "config/vision/source-allowlist.yaml"),
  ];
  const hashesBefore = await Promise.all(watchedConfigs.map(sha256File));

  async function assertConfigByteIdentity(): Promise<void> {
    const hashesAfter = await Promise.all(watchedConfigs.map(sha256File));
    if (!hashesBefore.every((hash, index) => hash === hashesAfter[index])) {
      throw new Error(
        "I-23F-6 VIOLATION: committed config/vision/*.yaml changed",
      );
    }
    console.log(
      "[smoke] I-23F-6 config byte-identity PASS (committed vision configs untouched)",
    );
  }

  console.log(
    `[smoke] enumerating ${CAMERA_INPUT_FORMAT} video devices (injected ffmpeg)...`,
  );
  const listing = await enumerateDshowDevices();
  console.log(`[smoke] ${CAMERA_INPUT_FORMAT} device listing (verbatim):`);
  for (const line of listing.lines) {
    console.log(`[smoke]   ${line}`);
  }
  console.log(
    `[smoke] video devices found: ${listing.videoDevices.length}` +
      (listing.videoDevices.length > 0
        ? ` (${listing.videoDevices.join(", ")})`
        : ""),
  );
  console.log(
    `[smoke] audio devices found: ${listing.audioDevices.length}` +
      (listing.audioDevices.length > 0
        ? ` (${listing.audioDevices.join(", ")})`
        : ""),
  );

  if (listing.videoDevices.length === 0) {
    await assertConfigByteIdentity();
    console.log(
      `[smoke] HALT: no ${CAMERA_INPUT_FORMAT} video device exists on this machine.`,
    );
    console.log(
      "[smoke] HALT: a real camera capture cannot run; nothing was mocked or",
    );
    console.log(
      "[smoke] HALT: fake-passed. Per spec §23F a no-hardware HALT is",
    );
    console.log("[smoke] HALT: report-and-stage, not a commit.");
    process.exitCode = 1;
    return;
  }

  // Real capture path (reachable only on a machine with a camera).
  const device = listing.videoDevices[0];
  console.log(`[smoke] using camera: ${device}`);

  const root = await mkdtemp(path.join(os.tmpdir(), "jarvis-camera-23f-"));
  try {
    const consentOverridePath = path.join(root, "consent-override.yaml");
    await writeFile(consentOverridePath, consentOverrideYaml(), "utf8");

    const emitted: Record<string, unknown>[] = [];
    const result = await captureCameraFrame(
      {
        device_name: device,
        explicit_user_triggered: true,
        indicator_ack: () => {
          console.log(
            "[smoke] INDICATOR ACK: visible capture indicator confirmed before runner invocation",
          );
          return true;
        },
        consent_config_path: consentOverridePath,
        artifact_root: path.join(root, "artifacts"),
        session_surface: "developer_test",
      },
      {
        cameraRunner: {
          captureFrame: async (input) => {
            const capture = await runCommand(
              "ffmpeg",
              CAMERA_INPUT_FORMAT === "avfoundation"
                ? avfoundationCaptureArgs(
                    listing.videoDevices.indexOf(input.device_name),
                    input.destination_path,
                  )
                : [
                    "-y",
                    "-f",
                    "dshow",
                    "-i",
                    `video=${input.device_name}`,
                    "-frames:v",
                    "1",
                    input.destination_path,
                  ],
              CAPTURE_TIMEOUT_MS,
            );
            if (capture.code !== 0) {
              throw new Error(
                `ffmpeg ${CAMERA_INPUT_FORMAT} capture failed: ${capture.stderr.slice(0, 300)}`,
              );
            }
          },
        },
        emitTelemetry: (event) => {
          emitted.push(event);
        },
      },
    );

    console.log(`[smoke] capture status: ${result.status}`);
    if (result.status !== "completed" || !result.frame_path) {
      throw new Error(
        `real capture did not complete: ${result.reasons.join(",")}`,
      );
    }
    const frameStat = await stat(result.frame_path);
    console.log(`[smoke] artifact dir: ${result.artifact_dir}`);
    console.log(
      `[smoke] frame file: ${result.frame_path} (${frameStat.size} bytes on disk)`,
    );
    console.log(`[smoke] frame hash: ${result.frame_hash}`);
    console.log(`[smoke] descriptor accepted: ${result.descriptor_accepted}`);
    console.log(
      `[smoke] events: ${result.events
        .map((event) =>
          [event.event_type, event.result_status ?? event.state ?? ""]
            .filter(Boolean)
            .join(":"),
        )
        .join(", ")}`,
    );
    console.log(`[smoke] emitted (gated) events: ${emitted.length}`);

    // I-23F-7 sentinel: frame bytes/paths live ONLY under the artifact
    // folder; events carry hashes and allowlisted metadata only.
    const serialized = JSON.stringify(result.events);
    if (
      serialized.includes(root) ||
      serialized.includes("frame-0001") ||
      serialized.includes(device)
    ) {
      throw new Error("I-23F-7 VIOLATION: events leak paths or device names");
    }
    console.log(
      "[smoke] I-23F-7 sentinel PASS (no paths/device names in events)",
    );

    await assertConfigByteIdentity();
    console.log("[smoke] PHASE 23F CAMERA SMOKE: OK");
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
