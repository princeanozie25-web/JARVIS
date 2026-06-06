/**
 * Demo Director contracts — DD.9.
 *
 * Pure, frozen descriptors for governed demo proposals and playback.
 * Demo scripts are pipeline-first and can be narrated, recorded, and
 * exported by the closeout orchestrator, but playback itself remains
 * deterministic and authority-free.
 *
 * Strict invariants on every type:
 *   - `metadata_only: true`
 *   - `read_only: true`
 *   - no execution affordances
 *   - no execution affordances
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
  "rest",
  "suggestion_inbox",
  "pipeline",
  "aux_routing",
  "council",
  "knowledge",
  "agent_coordinator",
  "human_gate",
  "working",
  "audit",
  "telemetry",
  "governance",
] as const;

export type DemoShowcaseTarget = (typeof DEMO_SHOWCASE_TARGETS)[number];

// ---------------------------------------------------------------------------
// Cues — atomic, deterministic instructions inside a segment
// ---------------------------------------------------------------------------

export const DEMO_CUE_KINDS = [
  "ignite_reactor",
  "enter_route",
  "highlight_pipeline_stage",
  "highlight_surface",
  "ignite_human_gate",
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
  /** Optional logical target - route, pipeline stage, surface, or edge id. */
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
  "route_showcase",
  "human_gate_climax",
  "audit_replay",
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
  /** Pipeline targets the script intends to surface. Purely descriptive. */
  showcased_zones: readonly DemoShowcaseTarget[];
  metadata_only: true;
  read_only: true;
  /* DD.11/DD.12 capabilities; these never grant execution authority. */
  recording_enabled: true;
  voice_enabled: true;
  export_enabled: true;
  narration_enabled: true;
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
  "reactor",
  "rest",
  "suggestion_inbox",
  "pipeline",
  "working",
  "audit",
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
  recording_enabled: true;
  voice_enabled: true;
  export_enabled: true;
}
