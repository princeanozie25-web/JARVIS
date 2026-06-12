import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { gateAndEmit, videoCountBand } from "./events";
import { VIDEO_EXTRACTION_VERSION } from "./workflow";

const BoundedIdSchema = z.string().trim().min(1).max(220);
const BoundedPathSchema = z.string().trim().min(1).max(2048);
const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

// Disk-only artifact: refs are paths + hashes, never inline content. The
// social-extraction packet stays byte-untouched; convergence is explicitly
// out of phase (spec §23D.3).
export const MultimodalAnalysisPacketSchema = z.strictObject({
  packet_id: BoundedIdSchema,
  version: z.literal(VIDEO_EXTRACTION_VERSION),
  session_id: BoundedIdSchema,
  source_hash: HashReferenceSchema,
  source_manifest_ref: BoundedPathSchema,
  frame_refs: z.array(
    z.strictObject({
      path: BoundedPathSchema,
      hash: HashReferenceSchema,
    }),
  ),
  transcript_ref: BoundedPathSchema.nullable(),
  model_tier: z.enum(["T3", "T4"]),
  metadata_only_telemetry: z.literal(true),
  created_at_iso: z.string().trim().min(10).max(40),
});
export type MultimodalAnalysisPacket = z.infer<
  typeof MultimodalAnalysisPacketSchema
>;

export const VideoPacketEventSchema = z.strictObject({
  event_type: z.literal("multimodal_packet_assembled"),
  event_id: BoundedIdSchema,
  session_id: BoundedIdSchema,
  source_id_hash: HashReferenceSchema,
  status: z.literal("completed"),
  artifact_kind: z.literal("multimodal_packet"),
  frame_count: z.enum(["empty", "1_to_30", "31_to_120", "over_120"]),
  created_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  action_executed: z.literal(false),
});
export type VideoPacketEvent = z.infer<typeof VideoPacketEventSchema>;

export interface AssembleMultimodalPacketInput {
  readonly artifact_dir: string;
  readonly session_id: string;
  readonly source_hash: string;
  readonly manifest_path: string;
  readonly frame_refs: readonly { path: string; hash: string }[];
  readonly transcript_path: string | null;
  readonly model_tier?: "T3" | "T4";
  readonly now_ms: number;
}

export interface AssembleMultimodalPacketDeps {
  readonly emitTelemetry?: (
    event: Record<string, unknown>,
  ) => void | Promise<void>;
}

export interface AssembleMultimodalPacketResult {
  readonly status: "completed";
  readonly packet: MultimodalAnalysisPacket;
  readonly packet_path: string;
  readonly events: readonly Record<string, unknown>[];
}

export async function assembleMultimodalPacket(
  input: AssembleMultimodalPacketInput,
  deps: AssembleMultimodalPacketDeps,
): Promise<AssembleMultimodalPacketResult> {
  const events: Record<string, unknown>[] = [];
  const sourceHashSegment = input.source_hash.slice(7, 23);

  const packet = MultimodalAnalysisPacketSchema.parse({
    packet_id: `video-packet:${sourceHashSegment}`,
    version: VIDEO_EXTRACTION_VERSION,
    session_id: input.session_id,
    source_hash: input.source_hash,
    source_manifest_ref: input.manifest_path,
    frame_refs: input.frame_refs.map((ref) => ({
      path: ref.path,
      hash: ref.hash,
    })),
    transcript_ref: input.transcript_path,
    // Minimum-capability floor per the T4 semantics ruling (23A).
    model_tier: input.model_tier ?? "T3",
    metadata_only_telemetry: true,
    created_at_iso: new Date(input.now_ms).toISOString(),
  });

  const packetPath = join(input.artifact_dir, "packet.json");
  await writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  const event = VideoPacketEventSchema.parse({
    event_type: "multimodal_packet_assembled",
    event_id: `video-packet:${VIDEO_EXTRACTION_VERSION}:${sourceHashSegment}`,
    session_id: input.session_id,
    source_id_hash: input.source_hash,
    status: "completed",
    artifact_kind: "multimodal_packet",
    frame_count: videoCountBand(packet.frame_refs.length),
    created_at_ms: input.now_ms,
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

  return {
    status: "completed",
    packet,
    packet_path: packetPath,
    events,
  };
}
