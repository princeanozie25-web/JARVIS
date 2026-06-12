import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { validateObservabilityPayloadSafety } from "../../src/lib/command-center/observability-redaction";
import {
  executeVideoIngest,
  hashVideoSource,
  type VideoIngestTelemetryEvent,
} from "../../src/lib/video-extraction";
import { sanitizeVisionMetadataPayload } from "../../src/lib/vision-runtime";
import { sanitizeVoiceTelemetryEvent } from "../../src/lib/voice-streaming";

const SENTINEL_URL = "https://www.youtube.com/watch?v=SENTINEL_RAW_URL_XYZJQ";
const SENTINEL_FILENAME = "SENTINEL_TITLE_CLIP.mp4";
const FORBIDDEN_SENTINELS = [
  "transcript",
  "ocr_text",
  "base64",
  "raw_image",
] as const;

function consentYamlAllGranted(): string {
  const ids = ["video_ingest_url", "video_ingest_local_file"];
  const entries = ids
    .map((id) =>
      [
        `  - id: ${id}`,
        `    label: Test ${id}`,
        "    tier: T2",
        `    action: ${id}`,
        `    scope: vision.test.${id}`,
        "    granted: true",
        "    revoked: false",
        "    granted_by: user_config",
        `    audit_event: standing-consent:${id}`,
      ].join("\n"),
    )
    .join("\n");
  return [
    "version: phase23.vision.standing-consent.v1",
    "owner_controlled: true",
    "auditable: true",
    "revocable: true",
    "vision_may_grant_consent: false",
    "no_self_expansion: true",
    "metadata_only: true",
    "consents:",
    entries,
  ].join("\n");
}

function allowlistYamlAllEnabled(): string {
  const platform = (name: string) => `  ${name}:\n    enabled: true`;
  return [
    "version: phase23.vision.source-allowlist.v1",
    "owner_controlled: true",
    "metadata_only: true",
    "platforms:",
    platform("youtube"),
    platform("instagram_reels"),
    platform("tiktok"),
    platform("x_twitter"),
    platform("local_file"),
    "caps:",
    "  max_filesize_mb: 512",
    "  max_duration_s: 3600",
    "  max_frames_per_video: 120",
    "  frame_sample_fps: 1",
  ].join("\n");
}

let root: string;
let consentPath: string;
let allowlistPath: string;
let artifactRoot: string;
let urlEvents: VideoIngestTelemetryEvent[] = [];
let localEvents: VideoIngestTelemetryEvent[] = [];
let localSourcePath: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "jarvis-video-hygiene-"));
  artifactRoot = join(root, "artifacts");
  consentPath = join(root, "consent.yaml");
  allowlistPath = join(root, "allowlist.yaml");
  await writeFile(consentPath, consentYamlAllGranted(), "utf8");
  await writeFile(allowlistPath, allowlistYamlAllEnabled(), "utf8");
  const sourceDir = join(root, "sources");
  await mkdir(sourceDir, { recursive: true });
  localSourcePath = join(sourceDir, SENTINEL_FILENAME);
  await writeFile(localSourcePath, Buffer.alloc(32_000, 7));

  const captured: VideoIngestTelemetryEvent[] = [];
  const urlResult = await executeVideoIngest(
    {
      source: { kind: "url", url: SENTINEL_URL },
      explicit_user_triggered: true,
      consent_config_path: consentPath,
      allowlist_config_path: allowlistPath,
      artifact_root: artifactRoot,
      now_ms: 1_786_000_000_000,
    },
    {
      versionProbe: {
        ytdlp: () => "2026.03.17",
        ffmpeg: () => "ffmpeg version 8.1.1",
        ffprobe: () => "ffprobe version 8.1.1",
      },
      ytdlpRunner: {
        download: vi.fn(async (input) => {
          await writeFile(
            join(input.destination_dir, "video.mp4"),
            Buffer.alloc(48_000, 3),
          );
          return { media_filename: "video.mp4" };
        }),
      },
      ffprobeRunner: { probeDurationSeconds: () => 5 },
      emitTelemetry: (event) => {
        captured.push(event);
      },
    },
  );
  urlEvents = [...urlResult.events];
  expect(urlResult.status).toBe("completed");
  expect(captured).toHaveLength(urlEvents.length);

  const localResult = await executeVideoIngest(
    {
      source: {
        kind: "local_file",
        path: `sources/${SENTINEL_FILENAME}`,
        local_source_root: root,
      },
      explicit_user_triggered: true,
      consent_config_path: consentPath,
      allowlist_config_path: allowlistPath,
      artifact_root: artifactRoot,
      now_ms: 1_786_000_000_001,
    },
    {
      versionProbe: {
        ytdlp: () => "2026.03.17",
        ffmpeg: () => "ffmpeg version 8.1.1",
        ffprobe: () => "ffprobe version 8.1.1",
      },
      ffprobeRunner: { probeDurationSeconds: () => 4 },
    },
  );
  localEvents = [...localResult.events];
  expect(localResult.status).toBe("completed");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Phase 23C telemetry hygiene (I-23C-3)", () => {
  it("emits no raw URL, query fragment, title, or filesystem path", () => {
    const serialized = JSON.stringify([...urlEvents, ...localEvents]);

    expect(serialized).not.toContain("SENTINEL_RAW_URL_XYZJQ");
    expect(serialized).not.toContain("watch?v=");
    expect(serialized).not.toContain("youtube.com");
    expect(serialized).not.toContain("SENTINEL_TITLE_CLIP");
    expect(serialized).not.toContain(root.replaceAll("\\", "\\\\"));
    expect(serialized).not.toContain("sources/");
    expect(serialized).not.toContain("artifacts");
  });

  it("carries only hash identities for the source", () => {
    for (const event of urlEvents) {
      expect(event.source_id_hash).toBe(hashVideoSource(SENTINEL_URL));
      expect(event.source_id_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  it("passes the vision metadata gate for every emitted event", () => {
    for (const event of [...urlEvents, ...localEvents]) {
      const gate = sanitizeVisionMetadataPayload({ ...event });
      expect(gate).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
    }
  });

  it("passes the observability safety gate for every emitted event", () => {
    for (const event of [...urlEvents, ...localEvents]) {
      const verdict = validateObservabilityPayloadSafety({ ...event });
      expect(verdict.passed).toBe(true);
      expect(verdict.reason).toBe("metadata_only_payload");
    }
  });

  it("survives voice hygiene with no value redactions", () => {
    for (const event of [...urlEvents, ...localEvents]) {
      const result = sanitizeVoiceTelemetryEvent({ ...event });
      expect(result.redactedKeys).toEqual([]);
    }
  });

  it("rejects forbidden sentinel fields injected into any event", () => {
    for (const event of [...urlEvents, ...localEvents]) {
      for (const sentinel of FORBIDDEN_SENTINELS) {
        const gate = sanitizeVisionMetadataPayload({
          ...event,
          [sentinel]: "forbidden",
        });
        expect(gate).toMatchObject({
          ok: false,
          reason: "forbidden_field",
        });
      }
    }
  });

  it("bands sizes instead of reporting exact bytes", () => {
    const completed = urlEvents.find(
      (event) => event.event_type === "video_ingest_completed",
    );
    expect(completed?.size_band).toBe("under_1mb");
    expect(JSON.stringify(urlEvents)).not.toContain("48000");
  });
});
