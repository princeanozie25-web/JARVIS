import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { executeVideoIngest } from "../../src/lib/video-extraction";

function consentYaml(grants: Partial<Record<string, boolean>>): string {
  const ids = [
    "video_ingest_url",
    "video_ingest_local_file",
    "frame_sampling",
    "transcript_extraction",
    "multimodal_analysis",
    "camera_capture",
  ];
  const entries = ids
    .map((id) =>
      [
        `  - id: ${id}`,
        `    label: Test ${id}`,
        "    tier: T2",
        `    action: ${id}`,
        `    scope: vision.test.${id}`,
        `    granted: ${grants[id] === true}`,
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

function allowlistYaml(
  enabled: Partial<Record<string, boolean>>,
  caps?: Partial<Record<string, number>>,
): string {
  const platform = (name: string) =>
    `  ${name}:\n    enabled: ${enabled[name] === true}`;
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
    `  max_filesize_mb: ${caps?.max_filesize_mb ?? 512}`,
    `  max_duration_s: ${caps?.max_duration_s ?? 3600}`,
    `  max_frames_per_video: ${caps?.max_frames_per_video ?? 120}`,
    `  frame_sample_fps: ${caps?.frame_sample_fps ?? 1}`,
  ].join("\n");
}

function healthyProbe() {
  return {
    ytdlp: vi.fn(() => "2026.03.17"),
    ffmpeg: vi.fn(() => "ffmpeg version 8.1.1-essentials_build"),
    ffprobe: vi.fn(() => "ffprobe version 8.1.1-essentials_build"),
  };
}

let root: string;
let grantedConsentPath: string;
let urlConsentPath: string;
let localAllowlistPath: string;
let youtubeAllowlistPath: string;
let tinyCapsAllowlistPath: string;
let sourceDir: string;
let smallClipPath: string;
let bigClipPath: string;
let artifactRoot: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "jarvis-video-gates-"));
  sourceDir = join(root, "sources");
  artifactRoot = join(root, "artifacts");
  await writeFile(join(root, "placeholder.txt"), "x", "utf8");
  await rm(sourceDir, { recursive: true, force: true });
  const { mkdir } = await import("node:fs/promises");
  await mkdir(sourceDir, { recursive: true });

  grantedConsentPath = join(root, "consent-local.yaml");
  await writeFile(
    grantedConsentPath,
    consentYaml({ video_ingest_local_file: true }),
    "utf8",
  );
  urlConsentPath = join(root, "consent-url.yaml");
  await writeFile(
    urlConsentPath,
    consentYaml({ video_ingest_url: true }),
    "utf8",
  );
  localAllowlistPath = join(root, "allow-local.yaml");
  await writeFile(
    localAllowlistPath,
    allowlistYaml({ local_file: true }),
    "utf8",
  );
  youtubeAllowlistPath = join(root, "allow-youtube.yaml");
  await writeFile(
    youtubeAllowlistPath,
    allowlistYaml({ youtube: true }),
    "utf8",
  );
  tinyCapsAllowlistPath = join(root, "allow-tiny.yaml");
  await writeFile(
    tinyCapsAllowlistPath,
    allowlistYaml({ local_file: true }, { max_filesize_mb: 1 }),
    "utf8",
  );

  smallClipPath = join(sourceDir, "small.mp4");
  await writeFile(smallClipPath, Buffer.alloc(64_000, 1));
  bigClipPath = join(sourceDir, "big.mp4");
  await writeFile(bigClipPath, Buffer.alloc(2_000_000, 1));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Phase 23C ingest gates", () => {
  it("I-23C-1: default consent config denies and never invokes a runner", async () => {
    const probe = healthyProbe();
    const download = vi.fn();
    const probeDuration = vi.fn(() => 5);

    const result = await executeVideoIngest(
      {
        source: {
          kind: "local_file",
          path: "sources/small.mp4",
          local_source_root: root,
        },
        explicit_user_triggered: true,
        artifact_root: artifactRoot,
        now_ms: 1_786_000_000_000,
      },
      {
        versionProbe: probe,
        ytdlpRunner: { download },
        ffprobeRunner: { probeDurationSeconds: probeDuration },
      },
    );

    expect(result.status).toBe("refused_consent");
    expect(download).not.toHaveBeenCalled();
    expect(probeDuration).not.toHaveBeenCalled();
    expect(probe.ytdlp).not.toHaveBeenCalled();
    expect(existsSync(artifactRoot)).toBe(false);
    expect(result.events.map((event) => event.event_type)).toEqual([
      "video_ingest_requested",
      "video_ingest_failed",
    ]);
  });

  it("refuses a disabled platform via the default allowlist", async () => {
    const download = vi.fn();
    const result = await executeVideoIngest(
      {
        source: { kind: "url", url: "https://www.youtube.com/watch?v=abc123" },
        explicit_user_triggered: true,
        consent_config_path: urlConsentPath,
        artifact_root: artifactRoot,
        now_ms: 1_786_000_000_000,
      },
      {
        versionProbe: healthyProbe(),
        ytdlpRunner: { download },
        ffprobeRunner: { probeDurationSeconds: vi.fn(() => 5) },
      },
    );

    expect(result.status).toBe("refused_allowlist");
    expect(result.reasons).toEqual(["platform_disabled:youtube"]);
    expect(download).not.toHaveBeenCalled();
  });

  it("I-23C-4: below-minimum tool version refuses before any download", async () => {
    const download = vi.fn();
    const result = await executeVideoIngest(
      {
        source: { kind: "url", url: "https://youtu.be/abc123" },
        explicit_user_triggered: true,
        consent_config_path: urlConsentPath,
        allowlist_config_path: youtubeAllowlistPath,
        artifact_root: artifactRoot,
        now_ms: 1_786_000_000_000,
      },
      {
        versionProbe: {
          ytdlp: () => "2020.01.01",
          ffmpeg: () => "ffmpeg version 8.1.1",
          ffprobe: () => "ffprobe version 8.1.1",
        },
        ytdlpRunner: { download },
        ffprobeRunner: { probeDurationSeconds: vi.fn(() => 5) },
      },
    );

    expect(result.status).toBe("refused_health");
    expect(result.reasons).toEqual(["health_below_minimum:yt-dlp"]);
    expect(download).not.toHaveBeenCalled();
    expect(existsSync(artifactRoot)).toBe(false);
  });

  it("refuses when a required tool is absent (null version)", async () => {
    const result = await executeVideoIngest(
      {
        source: {
          kind: "local_file",
          path: "sources/small.mp4",
          local_source_root: root,
        },
        explicit_user_triggered: true,
        consent_config_path: grantedConsentPath,
        allowlist_config_path: localAllowlistPath,
        artifact_root: artifactRoot,
        now_ms: 1_786_000_000_000,
      },
      {
        versionProbe: {
          ytdlp: () => null,
          ffmpeg: () => null,
          ffprobe: () => "ffprobe version 8.1.1",
        },
        ffprobeRunner: { probeDurationSeconds: vi.fn(() => 5) },
      },
    );

    expect(result.status).toBe("refused_health");
    expect(result.reasons).toEqual(["health_below_minimum:ffmpeg"]);
  });

  it("I-23C-2: filesize cap breach deletes the artifact dir and emits failure", async () => {
    const result = await executeVideoIngest(
      {
        source: {
          kind: "local_file",
          path: "sources/big.mp4",
          local_source_root: root,
        },
        explicit_user_triggered: true,
        consent_config_path: grantedConsentPath,
        allowlist_config_path: tinyCapsAllowlistPath,
        artifact_root: artifactRoot,
        now_ms: 1_786_000_000_000,
      },
      {
        versionProbe: healthyProbe(),
        ffprobeRunner: { probeDurationSeconds: vi.fn(() => 5) },
      },
    );

    expect(result.status).toBe("failed_cap_filesize");
    expect(result.artifact_dir_present).toBe(false);
    expect(
      result.events.filter(
        (event) => event.event_type === "video_ingest_failed",
      ),
    ).toHaveLength(1);
    const artifactDirs = existsSync(artifactRoot)
      ? (await import("node:fs/promises")).readdir(artifactRoot)
      : Promise.resolve([] as string[]);
    expect(await artifactDirs).toHaveLength(0);
  });

  it("I-23C-2: duration cap breach deletes the artifact dir", async () => {
    const result = await executeVideoIngest(
      {
        source: {
          kind: "local_file",
          path: "sources/small.mp4",
          local_source_root: root,
        },
        explicit_user_triggered: true,
        consent_config_path: grantedConsentPath,
        allowlist_config_path: localAllowlistPath,
        artifact_root: artifactRoot,
        now_ms: 1_786_000_000_000,
      },
      {
        versionProbe: healthyProbe(),
        ffprobeRunner: { probeDurationSeconds: vi.fn(() => 99_999) },
      },
    );

    expect(result.status).toBe("failed_cap_duration");
    expect(result.artifact_dir_present).toBe(false);
    expect(result.manifest).toBeNull();
  });

  it("rejects a path escaping the local source root", async () => {
    const download = vi.fn();
    const result = await executeVideoIngest(
      {
        source: {
          kind: "local_file",
          path: "../outside.mp4",
          local_source_root: sourceDir,
        },
        explicit_user_triggered: true,
        consent_config_path: grantedConsentPath,
        allowlist_config_path: localAllowlistPath,
        artifact_root: artifactRoot,
        now_ms: 1_786_000_000_000,
      },
      {
        versionProbe: healthyProbe(),
        ytdlpRunner: { download },
        ffprobeRunner: { probeDurationSeconds: vi.fn(() => 5) },
      },
    );

    expect(result.status).toBe("refused_source");
    expect(result.reasons[0]).toMatch(/^unsafe_path:/);
    expect(download).not.toHaveBeenCalled();
  });

  it("completes a local-file ingest and writes a conforming manifest", async () => {
    const result = await executeVideoIngest(
      {
        source: {
          kind: "local_file",
          path: "sources/small.mp4",
          local_source_root: root,
        },
        explicit_user_triggered: true,
        consent_config_path: grantedConsentPath,
        allowlist_config_path: localAllowlistPath,
        artifact_root: artifactRoot,
        now_ms: 1_786_000_000_000,
      },
      {
        versionProbe: healthyProbe(),
        ffprobeRunner: { probeDurationSeconds: vi.fn(() => 5) },
      },
    );

    expect(result.status).toBe("completed");
    expect(result.artifact_dir_present).toBe(true);
    expect(result.manifest?.source_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.manifest?.consent_entry_consumed).toBe(
      "video_ingest_local_file",
    );
    expect(result.manifest?.duration_seconds).toBe(5);
    expect(result.events.map((event) => event.event_type)).toEqual([
      "video_ingest_requested",
      "video_ingest_completed",
    ]);

    const manifestRaw = await readFile(
      join(result.artifact_dir as string, "manifest.json"),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as { source_hash: string };
    expect(manifest.source_hash).toBe(result.source_hash);
  });
});
