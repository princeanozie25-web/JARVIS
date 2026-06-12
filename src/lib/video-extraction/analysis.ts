import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { canExecuteRequest } from "@/lib/cost";
import type { ModelEntry, ModelTier } from "@/lib/models/types";
import {
  buildSuggestionInboxItem,
  type SuggestionInboxItem,
} from "@/lib/suggestion-inbox";
import { createVisionObservation, type VisionObservation } from "@/lib/vision";

import { gateAndEmit } from "./events";
import { MultimodalAnalysisPacketSchema } from "./packet";
import type { MultimodalAnalysisPacket } from "./packet";
import { VIDEO_EXTRACTION_VERSION } from "./workflow";

const BoundedIdSchema = z.string().trim().min(1).max(220);
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const TIER_RANK: Record<ModelTier, number> = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
};

// Locality is asserted, not assumed: ProviderId is exactly
// "openai" | "anthropic" | "ollama", and ollama is the only local provider.
// Anything else is cloud-capable and excluded from 23E analysis even when
// registry-enabled (owner ruling: cloud stays registry-disabled this phase).
export function isLocalAnalysisModel(entry: ModelEntry): boolean {
  return entry.provider === "ollama";
}

export type ResolveAnalysisModelResult =
  | { readonly ok: true; readonly model: ModelEntry }
  | { readonly ok: false; readonly reason: "no_qualifying_model" };

// Floor semantics per the 23A T4 ruling: model_tier is a MINIMUM-capability
// constraint; the resolver picks the lowest qualifying tier at or above the
// floor, cheapest first within a tier.
export function resolveAnalysisModel(input: {
  readonly candidates: readonly ModelEntry[];
  readonly floor: "T3" | "T4";
}): ResolveAnalysisModelResult {
  const qualifying = input.candidates
    .filter((entry) => entry.enabled)
    .filter((entry) => isLocalAnalysisModel(entry))
    .filter((entry) => TIER_RANK[entry.tier] >= TIER_RANK[input.floor])
    .sort((left, right) => {
      const tierDelta = TIER_RANK[left.tier] - TIER_RANK[right.tier];
      if (tierDelta !== 0) return tierDelta;
      const leftCost = left.pricing?.inputPerMillionUsd ?? Number.MAX_VALUE;
      const rightCost = right.pricing?.inputPerMillionUsd ?? Number.MAX_VALUE;
      return leftCost - rightCost;
    });
  const model = qualifying[0];
  return model
    ? { ok: true, model }
    : { ok: false, reason: "no_qualifying_model" };
}

export type VideoAnalysisModalityCoverage = "text_only" | "text_plus_frames";

// vision_lane_event rides the existing telemetry literal (no new literals this
// slice). Per the 23B lane registry, generic lane events carry their lane
// stage in `reason` ("analysis"); the failure cause rides result_status.
// event_id stays opaque — nothing may parse meaning from it.
export const VideoAnalysisLaneEventSchema = z.strictObject({
  event_type: z.literal("vision_lane_event"),
  event_id: BoundedIdSchema,
  session_id: BoundedIdSchema,
  source_id_hash: HashReferenceSchema,
  kind: z.literal("analysis"),
  reason: z.literal("analysis"),
  status: z.literal("failed"),
  result_status: z.enum([
    "no_qualifying_model",
    "cost_guard_denied",
    "runner_failed",
  ]),
  created_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export const VideoAnalysisCompletedEventSchema = z.strictObject({
  event_type: z.literal("multimodal_analysis_completed"),
  event_id: BoundedIdSchema,
  session_id: BoundedIdSchema,
  source_id_hash: HashReferenceSchema,
  status: z.literal("completed"),
  model_name: BoundedIdSchema,
  result_kind: z.enum(["text_only", "text_plus_frames"]),
  created_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});

export interface VideoAnalysisModelRunner {
  generate(input: {
    readonly model: ModelEntry;
    readonly system: string;
    readonly prompt: string;
    readonly image_paths?: readonly string[];
  }): Promise<{ readonly text: string }>;
}

export interface VideoAnalysisAuxSlugRunner {
  generateSlug(analysisText: string): Promise<string> | string;
}

export interface AnalyzeMultimodalPacketInput {
  readonly packet: MultimodalAnalysisPacket;
  readonly artifact_dir: string;
  readonly explicit_user_triggered: true;
  readonly now_ms?: number;
}

export interface AnalyzeMultimodalPacketDeps {
  readonly candidates: readonly ModelEntry[];
  readonly modelRunner: VideoAnalysisModelRunner;
  // Aux model slot (21C): configured by the caller; analysis skips gracefully
  // when absent and records the skip in the summary.
  readonly auxSlugRunner?: VideoAnalysisAuxSlugRunner | null;
  readonly costGuard?: () => { ok: boolean };
  readonly emitTelemetry?: (
    event: Record<string, unknown>,
  ) => void | Promise<void>;
}

export interface AnalyzeMultimodalPacketResult {
  readonly status:
    | "completed"
    | "no_qualifying_model"
    | "cost_guard_denied"
    | "runner_failed";
  readonly model_id: string | null;
  readonly modality_coverage: VideoAnalysisModalityCoverage | null;
  readonly observation: VisionObservation | null;
  readonly summary_path: string | null;
  readonly aux_slug: string | null;
  readonly suggestions: readonly SuggestionInboxItem[];
  readonly events: readonly Record<string, unknown>[];
}

// Deterministic, conservative action extraction: only explicit
// "- ACTION: ..." / "* SUGGEST: ..." lines become Suggestion Inbox items.
export function extractActionSuggestions(analysisText: string): string[] {
  return analysisText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s*(action|suggest(ion)?):/i.test(line))
    .map((line) => line.replace(/^[-*]\s*(action|suggest(ion)?):\s*/i, ""))
    .filter((line) => line.length > 0)
    .slice(0, 5);
}

export async function analyzeMultimodalPacket(
  input: AnalyzeMultimodalPacketInput,
  deps: AnalyzeMultimodalPacketDeps,
): Promise<AnalyzeMultimodalPacketResult> {
  if (input.explicit_user_triggered !== true) {
    throw new Error("Analysis requires an explicit user trigger.");
  }
  const packet = MultimodalAnalysisPacketSchema.parse(input.packet);
  const nowMs = input.now_ms ?? Date.now();
  const events: Record<string, unknown>[] = [];
  const hashSegment = packet.source_hash.slice(7, 23);

  async function emitFailure(
    resultStatus: "no_qualifying_model" | "cost_guard_denied" | "runner_failed",
  ): Promise<void> {
    const event = VideoAnalysisLaneEventSchema.parse({
      event_type: "vision_lane_event",
      event_id: `video-analysis:${VIDEO_EXTRACTION_VERSION}:${hashSegment}`,
      session_id: packet.session_id,
      source_id_hash: packet.source_hash,
      kind: "analysis",
      reason: "analysis",
      status: "failed",
      result_status: resultStatus,
      created_at_ms: nowMs,
      metadata_only: true,
      raw_payload_included: false,
      cloud_called: false,
      action_executed: false,
    });
    await gateAndEmit(
      event as unknown as Record<string, unknown>,
      deps.emitTelemetry,
      events,
    );
  }

  function failed(
    status: "no_qualifying_model" | "cost_guard_denied" | "runner_failed",
  ): AnalyzeMultimodalPacketResult {
    return {
      status,
      model_id: null,
      modality_coverage: null,
      observation: null,
      summary_path: null,
      aux_slug: null,
      suggestions: [],
      events,
    };
  }

  const resolution = resolveAnalysisModel({
    candidates: deps.candidates,
    floor: packet.model_tier,
  });
  if (!resolution.ok) {
    await emitFailure("no_qualifying_model");
    return failed("no_qualifying_model");
  }
  const model = resolution.model;

  const guard = (deps.costGuard ?? canExecuteRequest)();
  if (!guard.ok) {
    await emitFailure("cost_guard_denied");
    return failed("cost_guard_denied");
  }

  // MODALITY (owner-ruled): models without image input run
  // transcript+manifest-only analysis; frames are omitted and never claimed.
  const supportsImages = model.capabilities.includes("vision");
  const modality: VideoAnalysisModalityCoverage = supportsImages
    ? "text_plus_frames"
    : "text_only";

  // BOUNDED CONTEXT ASSEMBLY (Phase 7 context-assembly boundary): transcript
  // text, manifest metadata, and — only when the model supports images — the
  // packet's frame files enter the MODEL CALL ONLY. This content never
  // reaches telemetry, UI surfaces, or persistence outside the artifact
  // folder (the summary file below lives in the artifact folder).
  const transcriptText = packet.transcript_ref
    ? await readFile(packet.transcript_ref, "utf8")
    : "(no transcript)";
  const manifestText = await readFile(packet.source_manifest_ref, "utf8");
  const prompt = [
    "Analyze this locally ingested video.",
    `Manifest metadata: ${manifestText}`,
    `Transcript: ${transcriptText}`,
    supportsImages
      ? `Frames attached: ${packet.frame_refs.length}`
      : "Frames omitted: model lacks image input.",
    "Reply with a concise analysis. Propose actions only as '- ACTION: ...' lines.",
  ].join("\n\n");

  let analysisText: string;
  try {
    const generated = await deps.modelRunner.generate({
      model,
      system:
        "You are a local, advisory-only video analyst. You cannot execute actions.",
      prompt,
      image_paths: supportsImages
        ? packet.frame_refs.map((ref) => ref.path)
        : undefined,
    });
    analysisText = generated.text;
  } catch {
    await emitFailure("runner_failed");
    return failed("runner_failed");
  }

  // Aux slot (21C): reasoning stays on the resolved T3 model; slug/tag admin
  // work goes to the aux slot when configured, otherwise skipped gracefully.
  let auxSlug: string | null = null;
  let auxNote = "aux_slug: skipped (no aux model slot configured)";
  if (deps.auxSlugRunner) {
    try {
      auxSlug = await deps.auxSlugRunner.generateSlug(analysisText);
      auxNote = `aux_slug: ${auxSlug}`;
    } catch {
      auxNote = "aux_slug: skipped (aux slot failed; analysis unaffected)";
    }
  }

  const summaryPath = join(input.artifact_dir, "analysis-summary.md");
  await writeFile(
    summaryPath,
    [
      "# Analysis Summary",
      "",
      `- model: ${model.id}`,
      `- modality_coverage: ${modality}`,
      `- created_at: ${new Date(nowMs).toISOString()}`,
      `- ${auxNote}`,
      "",
      analysisText,
      "",
    ].join("\n"),
    "utf8",
  );

  const analysisHash = `sha256:${createHash("sha256")
    .update(analysisText)
    .digest("hex")}`;

  // Observation anchored to the packet (frozen Phase 7 schema: developer
  // fixture provider id, full safety-literal set). The frozen observation
  // schema has no free-form metadata slot, so modality coverage rides the
  // completed event (result_kind) and the summary file, linked by
  // output_hash.
  const observation = createVisionObservation({
    observation_id: `analysis:${hashSegment}`,
    frame_descriptor: {
      frame_id: `packet:${hashSegment}`,
      vision_session_id: packet.session_id,
      source_type: "uploaded_image",
      input_hash: packet.source_hash,
      observed_at: nowMs,
      received_at: nowMs,
      freshness_ms: 0,
      stale_after_ms: 60_000,
      stale: false,
      current_truth: false,
      redaction_status: "metadata_only",
      failure_replay_ref: null,
      metadata_only: true,
      raw_payload_stored: false,
      advisory_only: true,
      capture_started: false,
      provider_executed: false,
      cloud_called: false,
      action_executed: false,
      background_job_started: false,
    },
    provider_result: {
      frame_id: `packet:${hashSegment}`,
      vision_session_id: packet.session_id,
      provider_id: "developer_fixture",
      capability: "screen_context",
      result_class: "developer_fixture_summary",
      confidence: null,
      confidence_band: "unknown",
      output_hash: analysisHash,
      detected_count: null,
      summary_count: 1,
      redaction_status: "metadata_only",
      derived: true,
      metadata_only: true,
      raw_payload_stored: false,
      raw_payload_included: false,
      advisory_only: true,
      perception_authority: false,
      cloud_called: false,
      action_executed: false,
    },
  });

  const suggestions = extractActionSuggestions(analysisText).map(
    (actionText, index) =>
      buildSuggestionInboxItem({
        kind: "system_alert",
        title: `Video analysis suggestion ${index + 1}`,
        summary: actionText,
        source_ids: [`video-analysis:${hashSegment}:${index}`],
        readiness_status: "ready",
        degraded: false,
        created_at: new Date(nowMs).toISOString(),
        governance_notes: ["video_analysis_advisory_only"],
      }),
  );

  const completedEvent = VideoAnalysisCompletedEventSchema.parse({
    event_type: "multimodal_analysis_completed",
    event_id: `video-analysis:${VIDEO_EXTRACTION_VERSION}:${hashSegment}`,
    session_id: packet.session_id,
    source_id_hash: packet.source_hash,
    status: "completed",
    model_name: model.id,
    result_kind: modality,
    created_at_ms: nowMs,
    metadata_only: true,
    raw_payload_included: false,
    cloud_called: false,
    action_executed: false,
  });
  await gateAndEmit(
    completedEvent as unknown as Record<string, unknown>,
    deps.emitTelemetry,
    events,
  );

  return {
    status: "completed",
    model_id: model.id,
    modality_coverage: modality,
    observation,
    summary_path: existsSync(summaryPath) ? summaryPath : null,
    aux_slug: auxSlug,
    suggestions,
    events,
  };
}
