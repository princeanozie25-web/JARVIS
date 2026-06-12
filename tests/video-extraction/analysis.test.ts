import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ModelEntry } from "../../src/lib/models/types";
import {
  analyzeMultimodalPacket,
  extractActionSuggestions,
  MultimodalAnalysisPacketSchema,
  resolveAnalysisModel,
  type MultimodalAnalysisPacket,
} from "../../src/lib/video-extraction";

const TRANSCRIPT_SENTINEL = "ANALYSIS_LEAK_SENTINEL_WQXR.";

const LOCAL_T2: ModelEntry = {
  id: "ollama/local-t2",
  provider: "ollama",
  modelName: "local-t2",
  tier: "T2",
  capabilities: ["text", "stream"],
  enabled: true,
};
const LOCAL_T3: ModelEntry = {
  id: "ollama/local-t3",
  provider: "ollama",
  modelName: "local-t3",
  tier: "T3",
  capabilities: ["text", "stream"],
  enabled: true,
  pricing: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
};
const LOCAL_T4_VISION: ModelEntry = {
  id: "ollama/local-t4-vision",
  provider: "ollama",
  modelName: "local-t4-vision",
  tier: "T4",
  capabilities: ["text", "stream", "vision"],
  enabled: true,
};
const CLOUD_T4_ENABLED: ModelEntry = {
  id: "anthropic/cloud-t4",
  provider: "anthropic",
  modelName: "cloud-t4",
  tier: "T4",
  capabilities: ["text", "stream", "vision"],
  enabled: true,
};

let root: string;
let artifactDir: string;
let packet: MultimodalAnalysisPacket;

function okGuard() {
  return { ok: true };
}

function textRunner(text: string) {
  return {
    generate: vi.fn<
      (input: {
        model: ModelEntry;
        system: string;
        prompt: string;
        image_paths?: readonly string[];
      }) => Promise<{ text: string }>
    >(async () => ({ text })),
  };
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "jarvis-video-analysis-"));
  artifactDir = join(root, "artifact");
  await mkdir(join(artifactDir, "frames"), { recursive: true });

  const framePath = join(artifactDir, "frames", "frame-0000.png");
  await writeFile(framePath, Buffer.alloc(128, 3));
  const transcriptPath = join(artifactDir, "transcript.md");
  await writeFile(transcriptPath, `${TRANSCRIPT_SENTINEL}\n`, "utf8");
  const manifestPath = join(artifactDir, "manifest.json");
  await writeFile(manifestPath, `{"duration_seconds":5}\n`, "utf8");

  packet = MultimodalAnalysisPacketSchema.parse({
    packet_id: "video-packet:test0000test0000",
    version: "video-extraction:v1.phase23c",
    session_id: "video:pipeline:test",
    source_hash: `sha256:${"ab".repeat(32)}`,
    source_manifest_ref: manifestPath,
    frame_refs: [
      {
        path: framePath,
        hash: `sha256:${"cd".repeat(32)}`,
      },
    ],
    transcript_ref: transcriptPath,
    model_tier: "T3",
    metadata_only_telemetry: true,
    created_at_iso: "2026-06-12T12:00:00.000Z",
  });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Phase 23E model resolution (I-23E-2)", () => {
  it("applies the floor: T2 local never qualifies for a T3 packet", () => {
    const verdict = resolveAnalysisModel({
      candidates: [LOCAL_T2],
      floor: "T3",
    });
    expect(verdict.ok).toBe(false);
  });

  it("excludes an enabled cloud-capable T4 and picks the local T3", () => {
    const verdict = resolveAnalysisModel({
      candidates: [CLOUD_T4_ENABLED, LOCAL_T3, LOCAL_T4_VISION],
      floor: "T3",
    });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.model.id).toBe("ollama/local-t3");
    }
  });

  it("fails closed when only cloud entries qualify", () => {
    const verdict = resolveAnalysisModel({
      candidates: [CLOUD_T4_ENABLED],
      floor: "T3",
    });
    expect(verdict).toEqual({ ok: false, reason: "no_qualifying_model" });
  });
});

describe("Phase 23E fail-closed analysis (I-23E-3)", () => {
  it("no qualifying model: no observation, no summary, failure lane event", async () => {
    const failDir = join(root, "artifact-failclosed");
    await mkdir(failDir, { recursive: true });
    const runner = textRunner("never called");
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: failDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T2, CLOUD_T4_ENABLED],
        modelRunner: runner,
        costGuard: okGuard,
      },
    );

    expect(result.status).toBe("no_qualifying_model");
    expect(result.observation).toBeNull();
    expect(result.summary_path).toBeNull();
    expect(existsSync(join(failDir, "analysis-summary.md"))).toBe(false);
    expect(runner.generate).not.toHaveBeenCalled();
    const laneEvent = result.events.find(
      (event) => event.event_type === "vision_lane_event",
    );
    expect(laneEvent?.reason).toBe("analysis");
    expect(laneEvent?.result_status).toBe("no_qualifying_model");
  });

  it("cost guard denial fails closed before the model call", async () => {
    const runner = textRunner("never called");
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: artifactDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T3],
        modelRunner: runner,
        costGuard: () => ({ ok: false }),
      },
    );
    expect(result.status).toBe("cost_guard_denied");
    expect(runner.generate).not.toHaveBeenCalled();
  });
});

describe("Phase 23E modality coverage", () => {
  it("text-only model: frames omitted, coverage recorded honestly", async () => {
    const runner = textRunner("A calm blue test video.");
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: artifactDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T3],
        modelRunner: runner,
        costGuard: okGuard,
      },
    );

    expect(result.status).toBe("completed");
    expect(result.modality_coverage).toBe("text_only");
    const call = runner.generate.mock.calls[0]?.[0];
    expect(call?.image_paths).toBeUndefined();
    expect(call?.prompt).toContain("Frames omitted");
    const summary = await readFile(result.summary_path as string, "utf8");
    expect(summary).toContain("modality_coverage: text_only");
    const completed = result.events.find(
      (event) => event.event_type === "multimodal_analysis_completed",
    );
    expect(completed?.result_kind).toBe("text_only");
  });

  it("vision-capable model: frames attached, coverage text_plus_frames", async () => {
    const runner = textRunner("Frames show a blue screen.");
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: artifactDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T4_VISION],
        modelRunner: runner,
        costGuard: okGuard,
      },
    );

    expect(result.status).toBe("completed");
    expect(result.modality_coverage).toBe("text_plus_frames");
    const call = runner.generate.mock.calls[0]?.[0];
    expect(call?.image_paths).toHaveLength(1);
  });
});

describe("Phase 23E observation literals (I-23E-1)", () => {
  it("carries the full frozen safety-literal set", async () => {
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: artifactDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T3],
        modelRunner: textRunner("Observation literal check."),
        costGuard: okGuard,
      },
    );

    const observation = result.observation;
    expect(observation).not.toBeNull();
    expect(observation).toMatchObject({
      current_truth: false,
      derived: true,
      advisory_only: true,
      canonical_truth: false,
      perception_authority: false,
      metadata_only: true,
      raw_payload_stored: false,
      text_payload_stored: false,
      action_executed: false,
      cloud_called: false,
      provider_executed: false,
    });
    expect(observation?.output_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe("Phase 23E sentinel hygiene (I-23E-4)", () => {
  it("sentinel reaches the model payload and summary only — never events", async () => {
    const runner = textRunner("Echo without sentinel.");
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: artifactDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T3],
        modelRunner: runner,
        costGuard: okGuard,
      },
    );

    const call = runner.generate.mock.calls[0]?.[0];
    expect(call?.prompt).toContain("ANALYSIS_LEAK_SENTINEL_WQXR");
    expect(JSON.stringify(result.events)).not.toContain(
      "ANALYSIS_LEAK_SENTINEL_WQXR",
    );
    expect(JSON.stringify(result.suggestions)).not.toContain(
      "ANALYSIS_LEAK_SENTINEL_WQXR",
    );
    expect(result.status).toBe("completed");
  });
});

describe("Phase 23E suggestions (I-23E-5)", () => {
  it("builds inbox items from explicit ACTION lines with closed governance", async () => {
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: artifactDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T3],
        modelRunner: textRunner(
          "Summary line.\n- ACTION: archive the clip\n- SUGGEST: tag as demo\nplain line",
        ),
        costGuard: okGuard,
      },
    );

    expect(result.suggestions).toHaveLength(2);
    for (const item of result.suggestions) {
      expect(item.governance.approval_finalization_supported).toBe(false);
      expect(item.governance.action_execution_supported).toBe(false);
      expect(item.no_approval_finalization).toBe(true);
    }
  });

  it("extracts only explicit action markers", () => {
    expect(
      extractActionSuggestions("no markers here\njust prose"),
    ).toHaveLength(0);
  });

  it("adds zero new runtime.runTool call sites (video-extraction is clean; chat baseline is two)", () => {
    const videoDir = "src/lib/video-extraction";
    for (const file of readdirSync(videoDir)) {
      if (!statSync(join(videoDir, file)).isFile()) continue;
      expect(readFileSync(join(videoDir, file), "utf8")).not.toContain(
        "runTool",
      );
    }
    const baselineFiles = [
      "src/lib/chat/tool-approvals.ts",
      "src/lib/chat/tool-continuation.ts",
    ];
    let baselineCount = 0;
    for (const file of baselineFiles) {
      baselineCount += (
        readFileSync(file, "utf8").match(/runtime\.runTool\(/g) ?? []
      ).length;
    }
    expect(baselineCount).toBe(2);
  });
});

describe("Phase 23E aux slot grace", () => {
  it("skips gracefully without an aux runner and records it", async () => {
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: artifactDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T3],
        modelRunner: textRunner("No aux configured."),
        costGuard: okGuard,
      },
    );
    expect(result.aux_slug).toBeNull();
    const summary = await readFile(result.summary_path as string, "utf8");
    expect(summary).toContain("aux_slug: skipped");
  });

  it("uses the aux slot when configured", async () => {
    const result = await analyzeMultimodalPacket(
      {
        packet,
        artifact_dir: artifactDir,
        explicit_user_triggered: true,
        now_ms: 1_786_000_000_000,
      },
      {
        candidates: [LOCAL_T3],
        modelRunner: textRunner("Aux configured."),
        auxSlugRunner: { generateSlug: () => "video-analysis-demo" },
        costGuard: okGuard,
      },
    );
    expect(result.aux_slug).toBe("video-analysis-demo");
    const summary = await readFile(result.summary_path as string, "utf8");
    expect(summary).toContain("aux_slug: video-analysis-demo");
  });
});
