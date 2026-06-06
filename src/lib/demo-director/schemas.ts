/**
 * Demo Director zod schemas — DD.9.
 *
 * Boundary schemas for DemoCue / DemoSegment / DemoScript / DemoProposal.
 * Everything is metadata-only at the script/playback layer. DD.11/DD.12
 * enable narration, local recording, and local export as bounded package
 * orchestration, while ffmpeg and execution authority remain absent.
 */

import { z } from "zod";

import {
  DEMO_AUDIENCES,
  DEMO_CUE_KINDS,
  DEMO_PROPOSAL_STATUSES,
  DEMO_SEGMENT_KINDS,
  DEMO_SHOWCASE_TARGETS,
  type DemoProposal,
  type DemoScript,
  type DemoSegment,
} from "./contracts";

export const DemoAudienceSchema = z.enum(DEMO_AUDIENCES);
export const DemoCueKindSchema = z.enum(DEMO_CUE_KINDS);
export const DemoSegmentKindSchema = z.enum(DEMO_SEGMENT_KINDS);
export const DemoProposalStatusSchema = z.enum(DEMO_PROPOSAL_STATUSES);

export const DemoCueSchema = z.object({
  cue_id: z.string().min(1).max(120),
  at_ms: z.number().int().nonnegative(),
  kind: DemoCueKindSchema,
  target: z.string().min(1).max(80).optional(),
  note: z.string().max(160).optional(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const DemoSegmentSchema = z.object({
  segment_id: z.string().min(1).max(120),
  kind: DemoSegmentKindSchema,
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(200),
  duration_ms: z.number().int().positive(),
  cues: z.array(DemoCueSchema).min(1),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

const ShowcasedZoneSchema = z.enum(DEMO_SHOWCASE_TARGETS);

export const DemoScriptSchema = z.object({
  script_id: z.string().min(1).max(120),
  audience: DemoAudienceSchema,
  title: z.string().min(1).max(120),
  subtitle: z.string().min(1).max(200),
  total_duration_ms: z.number().int().positive(),
  segments: z.array(DemoSegmentSchema).min(1),
  showcased_zones: z.array(ShowcasedZoneSchema).min(1),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  recording_enabled: z.literal(true),
  voice_enabled: z.literal(true),
  export_enabled: z.literal(true),
  narration_enabled: z.literal(true),
  ffmpeg_enabled: z.literal(false),
});

export const DemoProposalSchema = z.object({
  proposal_id: z.string().min(1).max(160),
  audience: DemoAudienceSchema,
  status: DemoProposalStatusSchema,
  script: DemoScriptSchema,
  proposed_at_ms: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export function parseDemoScript(input: unknown): DemoScript {
  return DemoScriptSchema.parse(input) as DemoScript;
}

export function tryParseDemoScript(input: unknown): DemoScript | null {
  const result = DemoScriptSchema.safeParse(input);
  return result.success ? (result.data as DemoScript) : null;
}

export function parseDemoSegment(input: unknown): DemoSegment {
  return DemoSegmentSchema.parse(input) as DemoSegment;
}

export function parseDemoProposal(input: unknown): DemoProposal {
  return DemoProposalSchema.parse(input) as DemoProposal;
}

/**
 * Computes a script's total_duration_ms from its segments — used by
 * fixture builders to keep the field deterministic.
 */
export function sumSegmentDurations(
  segments: readonly { duration_ms: number }[],
): number {
  let total = 0;
  for (const segment of segments) total += segment.duration_ms;
  return total;
}
