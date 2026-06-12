import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { parse } from "yaml";
import { z } from "zod";

import type { ModelEntry } from "../src/lib/models/types";
import {
  analyzeMultimodalPacket,
  executeVideoPipeline,
} from "../src/lib/video-extraction";
import { createFasterWhisperSttProvider } from "../src/lib/voice-runtime";

// Phase 23E real-execution smoke. Discovery source mandated by the slice:
// config/models/registry.yaml. Qualification = visibility enabled AND
// runtime_class local AND tier >= T3 (the packet floor). If at least one
// entry qualifies, regenerate a real 23D packet (SAPI speech -> ffmpeg ->
// faster-whisper) and run REAL local analysis through ollama; if NONE
// qualifies, HALT with the full registry listing — no mock pass, no enabling,
// no installs (owner ruling: cloud stays registry-disabled this phase).

const SMOKE_TIMEOUT_MS = 300_000;
const OLLAMA_BASE_URL =
  process.env.JARVIS_OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

const RegistryEntrySchema = z
  .object({
    id: z.string(),
    provider: z.string(),
    tier: z.enum(["T0", "T1", "T2", "T3", "T4"]),
    runtime_class: z.string(),
    visibility: z.string(),
    supports_vision: z.boolean().optional(),
  })
  .passthrough();
const RegistryFileSchema = z
  .object({
    schema_version: z.number(),
    models: z.array(RegistryEntrySchema),
  })
  .passthrough();

const TIER_RANK: Record<string, number> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };

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

// Regenerates a real 23D packet with the exact wiring proven by
// scripts/video-pipeline-smoke.ts (real SAPI speech, real ffmpeg, real
// faster-whisper).
async function regeneratePacket(root: string) {
  const sourceDir = path.join(root, "sources");
  await mkdir(sourceDir, { recursive: true });
  const clipPath = path.join(sourceDir, "smoke-clip.mp4");
  const speechPath = path.join(sourceDir, "speech.wav");

  const speak = await runCommand("powershell", [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${speechPath.replaceAll("\\", "\\\\")}'); $s.Speak('A calm blue screen with a spoken phase twenty three analysis smoke test.'); $s.Dispose()`,
  ]);
  if (speak.code !== 0) {
    throw new Error(
      `SAPI speech generation failed: ${speak.stderr.slice(0, 300)}`,
    );
  }
  const mux = await runCommand("ffmpeg", [
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
  if (mux.code !== 0) {
    throw new Error(
      `ffmpeg clip generation failed: ${mux.stderr.slice(0, 300)}`,
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
      providerId: "faster-whisper-23e-smoke",
      beamSize: 5,
      vadEnabled: false,
      timeoutMs: 240_000,
      maxAudioBytes: 25_000_000,
      metadata_only: true,
    },
  });

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
    },
  );
  if (result.status !== "completed" || !result.packet || !result.artifact_dir) {
    throw new Error(`23D regeneration failed: ${result.reasons.join(",")}`);
  }
  return { packet: result.packet, artifact_dir: result.artifact_dir };
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const registryPath = path.resolve(repoRoot, "config/models/registry.yaml");
  const watchedConfigs = [
    registryPath,
    path.resolve(repoRoot, "config/vision/standing-consent.yaml"),
    path.resolve(repoRoot, "config/vision/source-allowlist.yaml"),
  ];
  const hashesBefore = await Promise.all(watchedConfigs.map(sha256File));

  const registry = RegistryFileSchema.parse(
    parse(await readFile(registryPath, "utf8")),
  );

  console.log(
    "[smoke] registry discovery (floor T3, local-only, enabled-only):",
  );
  console.log(
    "[smoke]   id                  | tier | enabled  | runtime_class",
  );
  for (const entry of registry.models) {
    const enabled = entry.visibility === "enabled" ? "enabled " : "disabled";
    console.log(
      `[smoke]   ${entry.id.padEnd(19)} | ${entry.tier}   | ${enabled} | ${entry.runtime_class}`,
    );
  }

  const qualifying = registry.models.filter(
    (entry) =>
      entry.visibility === "enabled" &&
      entry.runtime_class === "local" &&
      (TIER_RANK[entry.tier] ?? -1) >= TIER_RANK.T3,
  );

  if (qualifying.length === 0) {
    const hashesAfter = await Promise.all(watchedConfigs.map(sha256File));
    if (!hashesBefore.every((hash, index) => hash === hashesAfter[index])) {
      throw new Error("I-23E-6 VIOLATION: committed config files changed");
    }
    console.log(
      "[smoke] I-23E-6 config byte-identity PASS (models + vision configs untouched)",
    );
    console.log(
      "[smoke] HALT: no registry entry is simultaneously enabled, local, and >= T3.",
    );
    console.log(
      "[smoke] HALT: real analysis cannot run on this machine as configured.",
    );
    console.log(
      "[smoke] HALT: nothing was mocked, enabled, or installed. To proceed, the owner",
    );
    console.log(
      "[smoke] HALT: must add/enable a LOCAL T3+ entry in config/models/registry.yaml.",
    );
    process.exitCode = 1;
    return;
  }

  // Real path (reachable once the owner enables a local T3+ entry).
  const chosen = qualifying[0] as z.infer<typeof RegistryEntrySchema>;
  console.log(
    `[smoke] qualifying entries: ${qualifying.map((m) => m.id).join(", ")}`,
  );

  const root = await mkdtemp(path.join(os.tmpdir(), "jarvis-video-23e-"));
  try {
    const { packet, artifact_dir } = await regeneratePacket(root);
    console.log(`[smoke] regenerated 23D packet: ${packet.packet_id}`);

    const candidate: ModelEntry = {
      id: chosen.id,
      provider: "ollama",
      modelName: chosen.id,
      tier: chosen.tier as ModelEntry["tier"],
      capabilities: chosen.supports_vision
        ? ["text", "stream", "vision"]
        : ["text", "stream"],
      enabled: true,
    };

    const emitted: Record<string, unknown>[] = [];
    const analysis = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir,
        explicit_user_triggered: true,
      },
      {
        candidates: [candidate],
        modelRunner: {
          generate: async (input) => {
            // node:http instead of fetch: undici's 5-minute header timeout
            // aborts long CPU generations; local 14b inference under memory
            // pressure legitimately needs longer. Bounded real call:
            // reasoning models emit long think-chains; capped predict/ctx
            // keeps it finite.
            const payload = JSON.stringify({
              model: input.model.modelName,
              system: input.system,
              prompt: input.prompt,
              stream: false,
              options: { num_predict: 384, num_ctx: 4096 },
            });
            const body = await new Promise<string>(
              (resolveBody, rejectBody) => {
                const url = new URL(`${OLLAMA_BASE_URL}/api/generate`);
                const req = httpRequest(
                  {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname,
                    method: "POST",
                    headers: {
                      "content-type": "application/json",
                      "content-length": Buffer.byteLength(payload),
                    },
                  },
                  (res) => {
                    let data = "";
                    res.on("data", (chunk: Buffer) => {
                      data += chunk.toString("utf8");
                    });
                    res.on("end", () => {
                      if ((res.statusCode ?? 500) >= 400) {
                        rejectBody(
                          new Error(
                            `ollama generate failed: ${res.statusCode} ${data.slice(0, 200)}`,
                          ),
                        );
                        return;
                      }
                      resolveBody(data);
                    });
                  },
                );
                req.on("error", rejectBody);
                req.write(payload);
                req.end();
              },
            );
            const parsed = JSON.parse(body) as { response?: string };
            return { text: parsed.response ?? "" };
          },
        },
        emitTelemetry: (event) => {
          emitted.push(event);
        },
      },
    );

    console.log(`[smoke] analysis status: ${analysis.status}`);
    console.log(`[smoke] model resolved: ${analysis.model_id}`);
    console.log(`[smoke] modality coverage: ${analysis.modality_coverage}`);
    console.log(
      `[smoke] emitted events: ${emitted.map((event) => String(event.event_type)).join(", ")}`,
    );
    console.log(`[smoke] summary: ${analysis.summary_path}`);
    console.log(`[smoke] suggestions: ${analysis.suggestions.length}`);
    if (analysis.status !== "completed") {
      throw new Error(`analysis did not complete: ${analysis.status}`);
    }

    const hashesAfter = await Promise.all(watchedConfigs.map(sha256File));
    if (!hashesBefore.every((hash, index) => hash === hashesAfter[index])) {
      throw new Error("I-23E-6 VIOLATION: committed config files changed");
    }
    console.log("[smoke] I-23E-6 config byte-identity PASS");
    console.log("[smoke] PHASE 23E ANALYSIS SMOKE: OK");
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
