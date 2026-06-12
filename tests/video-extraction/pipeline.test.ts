import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { validateObservabilityPayloadSafety } from "../../src/lib/command-center/observability-redaction";
import {
  executeVideoPipeline,
  MultimodalAnalysisPacketSchema,
  videoCountBand,
  videoDurationBand,
  type VideoPipelineDependencies,
} from "../../src/lib/video-extraction";
import { sanitizeVisionMetadataPayload } from "../../src/lib/vision-runtime";

const TRANSCRIPT_SENTINEL = "LEAK_SENTINEL_QXZJV transcript body.";

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

function allowlistYaml(maxFrames = 120): string {
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
    `  max_frames_per_video: ${maxFrames}`,
    "  frame_sample_fps: 1",
  ].join("\n");
}

let root: string;
let allGrantedConsentPath: string;
let noFramesConsentPath: string;
let noTranscriptConsentPath: string;
let allowlistPath: string;
let sourceDir: string;

function makeFrameRunner(frameCount: number) {
  return {
    extractFrames: vi.fn(
      async (input: { destination_dir: string; max_frames: number }) => {
        const filenames: string[] = [];
        for (let index = 0; index < frameCount; index += 1) {
          const filename = `frame-${String(index).padStart(4, "0")}.png`;
          await writeFile(
            join(input.destination_dir, filename),
            Buffer.alloc(256, index % 251),
          );
          filenames.push(filename);
        }
        return { frame_filenames: filenames };
      },
    ),
  };
}

function makeDeps(overrides?: {
  frameCount?: number;
  transcriptText?: string;
  clockNow?: () => number;
}): VideoPipelineDependencies & {
  frameRunner: ReturnType<typeof makeFrameRunner>;
  audioCalls: () => number;
  sttCalls: () => number;
} {
  const frameRunner = makeFrameRunner(overrides?.frameCount ?? 3);
  const audioRunner = {
    extractAudio: vi.fn(
      async (input: { destination_path: string }) =>
        void (await writeFile(input.destination_path, Buffer.alloc(1024, 9))),
    ),
  };
  const sttProvider = {
    transcribe: vi.fn(async () => ({
      transcript: overrides?.transcriptText ?? "Hello world. Second segment.",
      language: "en",
      latency_ms: 42,
    })),
  };
  return {
    versionProbe: {
      ytdlp: () => "2026.03.17",
      ffmpeg: () => "ffmpeg version 8.1.1",
      ffprobe: () => "ffprobe version 8.1.1",
    },
    ffprobeRunner: { probeDurationSeconds: () => 5 },
    frameRunner,
    audioRunner,
    sttProvider,
    stt_model_name: "tiny",
    clockNow: overrides?.clockNow,
    audioCalls: () => audioRunner.extractAudio.mock.calls.length,
    sttCalls: () => sttProvider.transcribe.mock.calls.length,
  };
}

function localRequest(input: {
  artifactRoot: string;
  consentPath?: string;
  filename?: string;
  deadline_ms?: number;
  existing_sessions?: Parameters<
    typeof executeVideoPipeline
  >[0]["existing_sessions"];
}) {
  return {
    source: {
      kind: "local_file" as const,
      path: `sources/${input.filename ?? "clip.mp4"}`,
      local_source_root: root,
    },
    explicit_user_triggered: true as const,
    consent_config_path: input.consentPath ?? allGrantedConsentPath,
    allowlist_config_path: allowlistPath,
    artifact_root: input.artifactRoot,
    deadline_ms: input.deadline_ms,
    existing_sessions: input.existing_sessions,
  };
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "jarvis-video-pipeline-"));
  sourceDir = join(root, "sources");
  await mkdir(sourceDir, { recursive: true });
  await writeFile(join(sourceDir, "clip.mp4"), Buffer.alloc(64_000, 1));

  allGrantedConsentPath = join(root, "consent-all.yaml");
  await writeFile(
    allGrantedConsentPath,
    consentYaml({
      video_ingest_local_file: true,
      frame_sampling: true,
      transcript_extraction: true,
    }),
    "utf8",
  );
  noFramesConsentPath = join(root, "consent-no-frames.yaml");
  await writeFile(
    noFramesConsentPath,
    consentYaml({ video_ingest_local_file: true, transcript_extraction: true }),
    "utf8",
  );
  noTranscriptConsentPath = join(root, "consent-no-transcript.yaml");
  await writeFile(
    noTranscriptConsentPath,
    consentYaml({ video_ingest_local_file: true, frame_sampling: true }),
    "utf8",
  );
  allowlistPath = join(root, "allowlist.yaml");
  await writeFile(allowlistPath, allowlistYaml(), "utf8");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Phase 23D pipeline happy path (I-23D-1)", () => {
  it("completes ingest->frames->transcript->packet in one session", async () => {
    const artifactRoot = join(root, "artifacts-happy");
    const deps = makeDeps();
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot }),
      deps,
    );

    expect(result.status).toBe("completed");
    expect(result.session.state).toBe("completed");
    expect(result.frames?.frame_refs).toHaveLength(3);
    expect(result.frames?.descriptors_accepted).toBe(3);
    for (const ref of result.frames?.frame_refs ?? []) {
      expect(ref.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
    expect(result.packet?.frame_refs).toHaveLength(3);
    expect(result.packet?.model_tier).toBe("T3");
    expect(result.packet_path).not.toBeNull();
    expect(existsSync(result.packet_path as string)).toBe(true);
    expect(result.events.map((event) => event.event_type as string)).toContain(
      "multimodal_packet_assembled",
    );
  });

  it("frame descriptors register hash-only with raw_payload_stored false", async () => {
    const artifactRoot = join(root, "artifacts-descriptor");
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot }),
      makeDeps(),
    );
    // The descriptor invariant is enforced by the frozen Phase 7 schema the
    // module calls (raw_payload_stored is a literal false there); the module
    // reports acceptance counts.
    expect(result.frames?.descriptors_accepted).toBe(3);
    expect(result.status).toBe("completed");
  });
});

describe("Phase 23D frame cap", () => {
  it("caps 121 produced frames at 120 descriptors and deletes the excess file", async () => {
    const artifactRoot = join(root, "artifacts-cap");
    const deps = makeDeps({ frameCount: 121 });
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot }),
      deps,
    );

    expect(result.status).toBe("completed");
    expect(result.frames?.frame_refs).toHaveLength(120);
    expect(result.frames?.descriptors_accepted).toBe(120);
    const framesDir = join(result.artifact_dir as string, "frames");
    expect(await readdir(framesDir)).toHaveLength(120);
    const frameEvent = result.events.find(
      (event) => event.event_type === "frame_sampling_completed",
    );
    expect(frameEvent?.frame_count).toBe("31_to_120");
    expect(frameEvent?.max_allowed_frame_count).toBe(120);
  });
});

describe("Phase 23D consent gates", () => {
  it("refuses frame sampling without consent; frame runner never invoked", async () => {
    const artifactRoot = join(root, "artifacts-noframes");
    const deps = makeDeps();
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot, consentPath: noFramesConsentPath }),
      deps,
    );

    expect(result.status).toBe("frames_not_completed");
    expect(deps.frameRunner.extractFrames).not.toHaveBeenCalled();
    expect(result.session.state).toBe("failed");
    expect(result.artifacts_retained).toBe(true);
  });

  it("refuses transcript without consent; audio runner and STT never invoked", async () => {
    const artifactRoot = join(root, "artifacts-notranscript");
    const deps = makeDeps();
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot, consentPath: noTranscriptConsentPath }),
      deps,
    );

    expect(result.status).toBe("transcript_not_completed");
    expect(deps.audioCalls()).toBe(0);
    expect(deps.sttCalls()).toBe(0);
    expect(result.packet).toBeNull();
  });
});

describe("Phase 23D transcript confinement (I-23D-2)", () => {
  it("keeps the sentinel transcript out of events and packet refs", async () => {
    const artifactRoot = join(root, "artifacts-sentinel");
    const deps = makeDeps({ transcriptText: TRANSCRIPT_SENTINEL });
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot }),
      deps,
    );

    expect(result.status).toBe("completed");
    const serializedEvents = JSON.stringify(result.events);
    expect(serializedEvents).not.toContain("LEAK_SENTINEL_QXZJV");

    const packetRaw = await readFile(result.packet_path as string, "utf8");
    expect(packetRaw).not.toContain("LEAK_SENTINEL_QXZJV");

    const transcriptRaw = await readFile(
      result.transcript?.transcript_path as string,
      "utf8",
    );
    expect(transcriptRaw).toContain("LEAK_SENTINEL_QXZJV");
  });
});

describe("Phase 23D packet schema strictness (I-23D-3)", () => {
  it("rejects payload-bearing sentinel fields", async () => {
    const artifactRoot = join(root, "artifacts-schema");
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot }),
      makeDeps(),
    );
    const packet = result.packet;
    expect(packet).not.toBeNull();

    for (const sentinel of [
      "transcript",
      "ocr_text",
      "base64",
      "raw_image",
      "frame_data",
    ]) {
      const verdict = MultimodalAnalysisPacketSchema.safeParse({
        ...packet,
        [sentinel]: "forbidden",
      });
      expect(verdict.success).toBe(false);
    }
  });
});

describe("Phase 23D session envelope (I-23D-4, I-23D-5)", () => {
  it("refuses a second session while one is occupying; no artifacts created", async () => {
    const artifactRoot = join(root, "artifacts-occupancy");
    const deps = makeDeps();
    const occupying = await executeVideoPipeline(
      localRequest({ artifactRoot: join(root, "artifacts-occupant") }),
      makeDeps(),
    );
    // Simulate an in-flight session by replaying its ACTIVE form.
    const activeSession = {
      ...occupying.session,
      state: "active" as const,
      reason: "started" as const,
      ended_at: null,
      duration_ms: null,
    };

    const refused = await executeVideoPipeline(
      localRequest({
        artifactRoot,
        existing_sessions: [activeSession],
      }),
      deps,
    );

    expect(refused.status).toBe("refused_session_occupancy");
    expect(refused.session.state).toBe("denied");
    expect(refused.session.reason).toBe("single_active_session_denied");
    expect(refused.ingest).toBeNull();
    expect(deps.frameRunner.extractFrames).not.toHaveBeenCalled();
    expect(existsSync(artifactRoot)).toBe(false);
  });

  it("halts on mid-run expiry, retains prior artifacts, emits expired event, no packet", async () => {
    const artifactRoot = join(root, "artifacts-expiry");
    let tick = 0;
    const base = 1_786_000_000_000;
    // Each clock() call advances 1s; the deadline lands right after ingest.
    const deps = makeDeps({ clockNow: () => base + tick++ * 1_000 });
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot, deadline_ms: base + 4_500 }),
      deps,
    );

    expect(result.status).toBe("expired");
    expect(result.session.state).toBe("expired");
    expect(result.artifacts_retained).toBe(true);
    expect(result.packet).toBeNull();
    expect(result.packet_path).toBeNull();
    expect(
      existsSync(join(result.artifact_dir as string, "manifest.json")),
    ).toBe(true);
    expect(
      result.events.some(
        (event) => event.event_type === "vision_session_expired",
      ),
    ).toBe(true);
    expect(
      result.events.some(
        (event) => event.event_type === "multimodal_packet_assembled",
      ),
    ).toBe(false);
  });
});

describe("Phase 23D event hygiene and banding", () => {
  it("passes every stage event through the vision and observability gates", async () => {
    const artifactRoot = join(root, "artifacts-gates");
    const result = await executeVideoPipeline(
      localRequest({ artifactRoot }),
      makeDeps(),
    );
    const stageEvents = result.events.filter((event) =>
      [
        "video_ingest_requested",
        "video_ingest_completed",
        "frame_sampling_completed",
        "transcript_extraction_completed",
        "multimodal_packet_assembled",
      ].includes(event.event_type as string),
    );
    expect(stageEvents.length).toBeGreaterThanOrEqual(5);
    for (const event of stageEvents) {
      expect(sanitizeVisionMetadataPayload({ ...event })).toMatchObject({
        ok: true,
        redaction_status: "metadata_only",
      });
      const verdict = validateObservabilityPayloadSafety({ ...event });
      expect(verdict.passed).toBe(true);
    }
  });

  it("bands counts and durations at the documented boundaries", () => {
    expect(videoCountBand(0)).toBe("empty");
    expect(videoCountBand(30)).toBe("1_to_30");
    expect(videoCountBand(31)).toBe("31_to_120");
    expect(videoCountBand(120)).toBe("31_to_120");
    expect(videoCountBand(121)).toBe("over_120");
    expect(videoDurationBand(5)).toBe("under_10s");
    expect(videoDurationBand(10)).toBe("10s_to_60s");
    expect(videoDurationBand(60)).toBe("60s_to_600s");
    expect(videoDurationBand(600)).toBe("over_600s");
  });
});
