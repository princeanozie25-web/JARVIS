import { describe, expect, it } from "vitest";

import {
  SOCIAL_EXTRACTION_PLATFORMS,
  assembleSocialMultimodalPacket,
  buildPhase21ESocialExtractionCloseoutReport,
  buildSocialExtractionPlan,
  classifySocialExtractionSource,
  estimateExtractedFrameCount,
  executeSocialExtractionWorkflow,
  selectAdaptiveFrameRate,
  type ExecuteSocialExtractionDependencies,
  type SocialAnalysisResult,
  type SocialExtractionDownloadedMedia,
  type SocialExtractionFrameExtractionResult,
  type SocialExtractionPlan,
  type SocialMultimodalAnalysisPacket,
  type SocialTranscriptionResult,
} from ".";

const HASH_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

describe("Phase 21E social extraction source policy and planning", () => {
  it("classifies supported URLs and creates deterministic extraction plans", () => {
    const first = buildSocialExtractionPlan({
      source_url: "https://www.youtube.com/watch?v=abc123",
      explicit_user_triggered: true,
      estimated_duration_seconds: 42,
    });
    const second = buildSocialExtractionPlan({
      source_url: "https://www.youtube.com/watch?v=abc123",
      explicit_user_triggered: true,
      estimated_duration_seconds: 42,
    });

    expect(first).toEqual(second);
    expect(first.source.platform).toBe("youtube");
    expect(first.source.raw_url_included).toBe(false);
    expect(first.adaptive_fps).toBe(2);
    expect(first.background_watch_requested).toBe(false);
    expect(first.bulk_download_requested).toBe(false);
  });

  it("rejects disallowed platforms and unknown platforms unless policy allows them", () => {
    const rejected = classifySocialExtractionSource(
      "https://www.instagram.com/reel/abc",
      { disallowed_platforms: ["instagram"] },
    );
    expect(rejected.allowed).toBe(false);

    expect(() =>
      buildSocialExtractionPlan({
        source_url: "https://www.instagram.com/reel/abc",
        explicit_user_triggered: true,
        policy: { disallowed_platforms: ["instagram"] },
      }),
    ).toThrow("Social extraction source rejected");

    expect(
      classifySocialExtractionSource("https://example-video.invalid/post", {
        allow_unknown_platforms: false,
        allowed_platforms: ["youtube"],
      }).allowed,
    ).toBe(false);
  });

  it("declares all supported platform families", () => {
    expect(SOCIAL_EXTRACTION_PLATFORMS).toEqual([
      "instagram",
      "tiktok",
      "youtube",
      "twitter_x",
      "yt_dlp_supported",
      "unknown",
    ]);
  });

  it("selects adaptive fps by duration and enforces frame caps", () => {
    expect(selectAdaptiveFrameRate(30)).toBe(2);
    expect(selectAdaptiveFrameRate(240)).toBe(1);
    expect(selectAdaptiveFrameRate(600)).toBe(0.5);
    expect(selectAdaptiveFrameRate(1800)).toBe(0.2);
    expect(
      estimateExtractedFrameCount({
        duration_seconds: 1800,
        adaptive_fps: 0.2,
        max_frame_count: 120,
      }),
    ).toBe(120);
  });
});

describe("Phase 21E social extraction injected-runner workflow", () => {
  it("assembles multimodal packets from injected fake runners and cleans temp workspace", async () => {
    const cleanupCalls: string[] = [];
    const analysisPackets: SocialMultimodalAnalysisPacket[] = [];
    const result = await executeSocialExtractionWorkflow({
      plan: plan(),
      dependencies: dependencies({
        cleanupCalls,
        analyze(packetInput) {
          analysisPackets.push(packetInput);
          return analysis(packetInput);
        },
      }),
    });

    expect(result.status).toBe("completed");
    expect(result.packet?.frames).toHaveLength(3);
    expect(result.packet?.transcript_segments).toHaveLength(2);
    expect(result.analysis?.summary).toContain("metadata-only social video");
    expect(analysisPackets[0]?.source_url_hash).toBe(
      result.plan.source.source_url_hash,
    );
    expect(cleanupCalls).toEqual([result.plan.temp_workspace_id]);
    expect(result.cleanup_attempted).toBe(true);
    expect(result.cleanup_completed).toBe(true);
    expect(result.temp_workspace_wiped).toBe(true);
    expect(result.telemetry).toMatchObject({
      metadata_only: true,
      frame_count: 3,
      transcript_segment_count: 2,
      raw_url_included: false,
      raw_transcript_included: false,
      raw_frame_data_included: false,
      raw_audio_path_included_after_cleanup: false,
      raw_video_body_included: false,
    });
  });

  it("fails closed when yt-dlp is unavailable", async () => {
    const result = await executeSocialExtractionWorkflow({
      plan: plan(),
      dependencies: { ...dependencies(), ytdlpRunner: undefined },
    });
    expect(result.status).toBe("unavailable");
    expect(result.reasons).toContain("ytdlp_unavailable");
    expect(result.cleanup_attempted).toBe(false);
  });

  it("fails closed when ffmpeg is unavailable", async () => {
    const result = await executeSocialExtractionWorkflow({
      plan: plan(),
      dependencies: { ...dependencies(), ffmpegRunner: undefined },
    });
    expect(result.status).toBe("unavailable");
    expect(result.reasons).toContain("ffmpeg_unavailable");
    expect(result.cleanup_attempted).toBe(false);
  });

  it("fails or degrades transcription according to policy", async () => {
    const required = await executeSocialExtractionWorkflow({
      plan: plan({ policy: { transcription_required: true } }),
      dependencies: { ...dependencies(), transcriptionRunner: undefined },
    });
    expect(required.status).toBe("unavailable");
    expect(required.reasons).toContain("transcription_unavailable");

    const optional = await executeSocialExtractionWorkflow({
      plan: plan({ policy: { transcription_required: false } }),
      dependencies: { ...dependencies(), transcriptionRunner: undefined },
    });
    expect(optional.status).toBe("completed");
    expect(optional.packet?.transcript_segments).toEqual([]);
    expect(optional.telemetry.transcript_segment_count).toBe(0);
  });

  it("enforces policy max duration and cleans up after runner failure", async () => {
    const cleanupCalls: string[] = [];
    const result = await executeSocialExtractionWorkflow({
      plan: plan({ policy: { max_duration_seconds: 60 } }),
      dependencies: dependencies({
        cleanupCalls,
        media: { ...media(), duration_seconds: 61 },
      }),
    });

    expect(result.status).toBe("runner_failed");
    expect(result.reasons[0]).toContain("max duration");
    expect(result.cleanup_attempted).toBe(true);
    expect(result.cleanup_completed).toBe(true);
    expect(cleanupCalls).toEqual([result.plan.temp_workspace_id]);
  });

  it("cleans temp workspace after analysis failure", async () => {
    const cleanupCalls: string[] = [];
    const result = await executeSocialExtractionWorkflow({
      plan: plan(),
      dependencies: dependencies({
        cleanupCalls,
        analyze() {
          throw new Error("analysis runner unavailable after packet assembly");
        },
      }),
    });

    expect(result.status).toBe("analysis_failed");
    expect(result.packet).not.toBeNull();
    expect(result.analysis).toBeNull();
    expect(result.cleanup_attempted).toBe(true);
    expect(result.cleanup_completed).toBe(true);
    expect(cleanupCalls).toEqual([result.plan.temp_workspace_id]);
  });

  it("does not expose raw transcript, frame, audio, video, URL, or background/bulk affordances", async () => {
    const result = await executeSocialExtractionWorkflow({
      plan: plan(),
      dependencies: dependencies(),
    });
    const serializedTelemetry = JSON.stringify(result.telemetry);

    expect(serializedTelemetry).not.toContain("Speaker says private words");
    expect(serializedTelemetry).not.toContain("https://www.youtube.com");
    expect(serializedTelemetry).not.toContain("video.mp4");
    expect(result.background_watch_started).toBe(false);
    expect(result.bulk_download_started).toBe(false);
    expect(result.raw_payload_telemetry_enabled).toBe(false);
  });
});

describe("Phase 21E packet and closeout contracts", () => {
  it("assembles packets directly from supplied metadata without raw media", () => {
    const packet = assembleSocialMultimodalPacket({
      plan: plan(),
      media: media(),
      frames: frames(),
      transcript: transcript(),
    });
    expect(packet.frames[0].raw_frame_data_included).toBe(false);
    expect(packet.raw_transcript_written_to_telemetry).toBe(false);
    expect(packet.analysis_prompt_metadata.cost_gate_required).toBe(true);
  });

  it("reports Phase 21E as execution-enabled but governed", () => {
    const report = buildPhase21ESocialExtractionCloseoutReport();
    expect(report.classification).toBe("execution_enabled");
    expect(report.phase_21e_may_close).toBe(true);
    expect(report.governance).toMatchObject({
      user_initiated_only: true,
      no_background_url_watching: true,
      no_bulk_download: true,
      injected_runner_boundaries: true,
      cloud_analysis_cost_gated: true,
      metadata_only_telemetry: true,
      no_auto_execution: true,
    });
  });
});

function plan(input: {
  readonly policy?: Parameters<typeof buildSocialExtractionPlan>[0]["policy"];
} = {}): SocialExtractionPlan {
  return buildSocialExtractionPlan({
    source_url: "https://www.youtube.com/watch?v=abc123",
    explicit_user_triggered: true,
    estimated_duration_seconds: 90,
    policy: input.policy,
  });
}

function media(): SocialExtractionDownloadedMedia {
  return {
    video_ref: "tmp:video",
    audio_ref: "tmp:audio",
    duration_seconds: 90,
    file_size_bytes: 10_000_000,
    metadata_hash: HASH_A,
    raw_video_body_included: false,
    raw_audio_body_included: false,
  };
}

function frames(): SocialExtractionFrameExtractionResult {
  return {
    frames: [0, 15, 30].map((timestamp, index) => ({
      frame_id: `frame:${index}`,
      timestamp_seconds: timestamp,
      temp_path_ref: `tmp:frame:${index}`,
      content_hash: index === 0 ? HASH_A : index === 1 ? HASH_B : HASH_C,
      width: 1280,
      height: 720,
      raw_frame_data_included: false,
    })),
    frame_count: 3,
    adaptive_fps: 1,
    frame_cap_enforced: true,
    raw_frame_data_included: false,
  };
}

function transcript(): SocialTranscriptionResult {
  return {
    transcript_id: "transcript:1",
    segments: [
      {
        segment_id: "segment:1",
        start_seconds: 0,
        end_seconds: 3,
        text: "Speaker says private words.",
      },
      {
        segment_id: "segment:2",
        start_seconds: 4,
        end_seconds: 8,
        text: "Second timestamped segment.",
      },
    ],
    segment_count: 2,
    language: "en",
    raw_audio_body_included: false,
    raw_transcript_written_to_telemetry: false,
  };
}

function analysis(packet: SocialMultimodalAnalysisPacket): SocialAnalysisResult {
  return {
    analysis_id: "analysis:1",
    summary: "A metadata-only social video summary was generated.",
    timestamped_events: [
      {
        event_id: "event:1",
        timestamp_seconds: packet.frames[0]?.timestamp_seconds ?? 0,
        summary: "Opening visual event.",
        frame_refs: [packet.frames[0]?.frame_id ?? "frame:0"],
      },
    ],
    key_frame_refs: packet.frames.slice(0, 2).map((frame) => frame.frame_id),
    confidence: "medium",
    caveats: ["Analysis used injected runner output only."],
    safety: {
      advisory_only: true,
      no_action_execution: true,
      no_persistent_raw_media_storage: true,
      raw_frame_data_included: false,
      raw_audio_body_included: false,
      raw_video_body_included: false,
      raw_transcript_written_to_telemetry: false,
    },
  };
}

function dependencies(input: {
  readonly cleanupCalls?: string[];
  readonly media?: SocialExtractionDownloadedMedia;
  readonly analyze?: (packet: SocialMultimodalAnalysisPacket) => SocialAnalysisResult;
} = {}): ExecuteSocialExtractionDependencies {
  return {
    tempWorkspace: {
      create(planInput) {
        return {
          workspace_id: planInput.temp_workspace_id,
          temp_root_ref: `tmp:${planInput.temp_workspace_id}`,
        };
      },
      cleanup(workspace) {
        input.cleanupCalls?.push(workspace.workspace_id);
        return true;
      },
    },
    ytdlpRunner: {
      download() {
        return input.media ?? media();
      },
    },
    ffmpegRunner: {
      extractFrames() {
        return frames();
      },
    },
    transcriptionRunner: {
      transcribe() {
        return transcript();
      },
    },
    analysisRunner: {
      analyze(packetInput) {
        return input.analyze?.(packetInput) ?? analysis(packetInput);
      },
    },
  };
}
