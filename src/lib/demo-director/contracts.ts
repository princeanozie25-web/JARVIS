/**
 * Demo Director contracts — DD.9.
 *
 * Pure, frozen, read-only descriptors for governed demo proposals and
 * playback. No recording, no exports, no voice. The Demo Director only
 * proposes scripts; playback is deterministic and metadata-only.
 *
 * Strict invariants on every type:
 *   - `metadata_only: true`
 *   - `read_only: true`
 *   - no execution affordances
 *   - no narration / audio / mp4 references
 */

// ---------------------------------------------------------------------------
// Audience
// ---------------------------------------------------------------------------

export const DEMO_AUDIENCES = [
  "security",
  "recruiter",
  "technical",
  "general",
] as const;

export type DemoAudience = (typeof DEMO_AUDIENCES)[number];

export const DEMO_SHOWCASE_TARGETS = [
  "space",
  "time",
  "mind",
  "soul",
  "reality",
  "power",
] as const;

export type DemoShowcaseTarget = (typeof DEMO_SHOWCASE_TARGETS)[number];

// ---------------------------------------------------------------------------
// Cues — atomic, deterministic instructions inside a segment
// ---------------------------------------------------------------------------

export const DEMO_CUE_KINDS = [
  "assemble_stone",
  "ignite_human_gate",
  "highlight_zone",
  "pulse",
  "halt",
  "approve",
  "deny",
  "show_label",
] as const;

export type DemoCueKind = (typeof DEMO_CUE_KINDS)[number];

export interface DemoCue {
  cue_id: string;
  /** Offset within the parent segment in milliseconds. */
  at_ms: number;
  kind: DemoCueKind;
  /** Optional logical target — stone id, zone id, edge id, or hub id. */
  target?: string;
  /** Optional metadata-only annotation (label text, beat notes). */
  note?: string;
  metadata_only: true;
  read_only: true;
}

// ---------------------------------------------------------------------------
// Segments — coherent phases of a demo script
// ---------------------------------------------------------------------------

export const DEMO_SEGMENT_KINDS = [
  "assembly",
  "narrative",
  "pipeline_walk",
  "human_gate_climax",
] as const;

export type DemoSegmentKind = (typeof DEMO_SEGMENT_KINDS)[number];

export interface DemoSegment {
  segment_id: string;
  kind: DemoSegmentKind;
  label: string;
  description: string;
  duration_ms: number;
  cues: readonly DemoCue[];
  metadata_only: true;
  read_only: true;
}

// ---------------------------------------------------------------------------
// Script — the full ordered demo
// ---------------------------------------------------------------------------

export interface DemoScript {
  script_id: string;
  audience: DemoAudience;
  title: string;
  subtitle: string;
  /** Sum of every segment.duration_ms — deterministic, recomputed at build. */
  total_duration_ms: number;
  segments: readonly DemoSegment[];
  /** Legacy demo targets the script intends to surface. Purely descriptive. */
  showcased_zones: readonly DemoShowcaseTarget[];
  metadata_only: true;
  read_only: true;
  /* explicit non-features — the schema and tests guard these */
  recording_enabled: false;
  voice_enabled: false;
  export_enabled: false;
  narration_enabled: false;
  ffmpeg_enabled: false;
}

// ---------------------------------------------------------------------------
// Proposal envelope — what lands in the Suggestion Inbox
// ---------------------------------------------------------------------------

export const DEMO_PROPOSAL_STATUSES = [
  "proposed",
  "approved",
  "denied",
] as const;

export type DemoProposalStatus = (typeof DEMO_PROPOSAL_STATUSES)[number];

export interface DemoProposal {
  proposal_id: string;
  audience: DemoAudience;
  status: DemoProposalStatus;
  script: DemoScript;
  /** Logical clock — monotonic across an inbox session. */
  proposed_at_ms: number;
  metadata_only: true;
  read_only: true;
}

export interface DemoProposalInbox {
  inbox_id: "demo-director:suggestion-inbox";
  proposals: readonly DemoProposal[];
  metadata_only: true;
  read_only: true;
}

// ---------------------------------------------------------------------------
// Assembly + Playback — DD.10
// ---------------------------------------------------------------------------

export const DEMO_ASSEMBLY_STAGES = [
  "black",
  "orb",
  "space",
  "time",
  "mind",
  "soul",
  "reality",
  "power",
  "human_gate",
  "first_pulse",
  "complete",
] as const;

export type DemoAssemblyStage = (typeof DEMO_ASSEMBLY_STAGES)[number];

export const DEMO_PLAYBACK_STATES = [
  "idle",
  "assembling",
  "playing",
  "halted",
  "approved",
  "denied",
  "complete",
] as const;

export type DemoPlaybackState = (typeof DEMO_PLAYBACK_STATES)[number];

export interface DemoPlaybackSnapshot {
  snapshot_id: string;
  script_id: string;
  audience: DemoAudience;
  state: DemoPlaybackState;
  assembly_stage: DemoAssemblyStage;
  current_segment_id: string | null;
  /** Active cues at the snapshot's time. */
  active_cues: readonly DemoCue[];
  /** Logical time (ms) into the script. */
  elapsed_ms: number;
  metadata_only: true;
  read_only: true;
  execute_affordance_present: false;
  approve_affordance_present: false;
  mutation_affordance_present: false;
  recording_enabled: false;
  voice_enabled: false;
  export_enabled: false;
}
