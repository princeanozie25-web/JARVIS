import { z } from "zod";

import { FinalSystemPhaseIdSchema } from "./contracts";
import { FinalDisabledFeatureIdSchema } from "./disabled-feature-matrix";

export const FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION = "20A.4" as const;

export const FINAL_AUTHORITY_SURFACE_IDS = [
  "authority-surface:model-runtime",
  "authority-surface:local-providers",
  "authority-surface:cloud-providers",
  "authority-surface:voice-runtime",
  "authority-surface:vision-runtime",
  "authority-surface:room-adapter-runtime",
  "authority-surface:scheduler-routines",
  "authority-surface:approval-service",
  "authority-surface:tool-runtime",
  "authority-surface:command-center-ui",
  "authority-surface:architecture-graph",
  "authority-surface:telemetry-cockpit",
  "authority-surface:governance-visualizer",
  "authority-surface:red-team-sandbox-cai",
  "authority-surface:event-store-persistence",
  "authority-surface:project-intelligence",
  "authority-surface:memory-bridge",
] as const;

export const FINAL_AUTHORITY_READ_POSTURES = [
  "none",
  "metadata_only",
  "redacted_projection",
  "local_state",
  "local_sensitive_boundary",
] as const;

export const FINAL_AUTHORITY_WRITE_POSTURES = [
  "none",
  "append_only_metadata",
  "proposal_metadata_only",
  "approval_gated_side_effect",
  "in_memory_or_fixture_only",
] as const;

export const FINAL_AUTHORITY_EXECUTE_POSTURES = [
  "none",
  "local_runtime_invocation",
  "cloud_runtime_disabled",
  "approval_gated_runtime",
  "foreground_scheduler_metadata_only",
  "sandbox_dry_run_only",
] as const;

export const FINAL_AUTHORITY_APPROVAL_REQUIREMENTS = [
  "not_applicable",
  "approval_required_for_writes",
  "approval_required_for_execution",
  "approval_required_for_authority",
  "approval_required_for_red_team_classes",
  "disabled_no_approval_path",
] as const;

export const FINAL_AUTHORITY_NETWORK_POSTURES = [
  "none",
  "local_only",
  "lan_local_only",
  "cloud_disabled_by_default",
  "cloud_opt_in_gated",
  "sandbox_whitelist_only",
] as const;

export const FINAL_AUTHORITY_RAW_PAYLOAD_POSTURES = [
  "metadata_only_redacted",
  "raw_forbidden",
  "in_memory_only_redacted_boundary",
] as const;

export const FINAL_AUTHORITY_PHASE20_POSTURES = [
  "inventory_only_no_change",
  "read_only_metadata_inventory",
  "remains_approval_gated",
  "remains_disabled_or_gated",
] as const;

export type FinalAuthoritySurfaceId =
  (typeof FINAL_AUTHORITY_SURFACE_IDS)[number];
export type FinalAuthorityReadPosture =
  (typeof FINAL_AUTHORITY_READ_POSTURES)[number];
export type FinalAuthorityWritePosture =
  (typeof FINAL_AUTHORITY_WRITE_POSTURES)[number];
export type FinalAuthorityExecutePosture =
  (typeof FINAL_AUTHORITY_EXECUTE_POSTURES)[number];
export type FinalAuthorityApprovalRequirement =
  (typeof FINAL_AUTHORITY_APPROVAL_REQUIREMENTS)[number];
export type FinalAuthorityNetworkPosture =
  (typeof FINAL_AUTHORITY_NETWORK_POSTURES)[number];
export type FinalAuthorityRawPayloadPosture =
  (typeof FINAL_AUTHORITY_RAW_PAYLOAD_POSTURES)[number];
export type FinalAuthorityPhase20Posture =
  (typeof FINAL_AUTHORITY_PHASE20_POSTURES)[number];

export const FinalAuthoritySurfaceIdSchema = z.enum(
  FINAL_AUTHORITY_SURFACE_IDS,
);
export const FinalAuthorityReadPostureSchema = z.enum(
  FINAL_AUTHORITY_READ_POSTURES,
);
export const FinalAuthorityWritePostureSchema = z.enum(
  FINAL_AUTHORITY_WRITE_POSTURES,
);
export const FinalAuthorityExecutePostureSchema = z.enum(
  FINAL_AUTHORITY_EXECUTE_POSTURES,
);
export const FinalAuthorityApprovalRequirementSchema = z.enum(
  FINAL_AUTHORITY_APPROVAL_REQUIREMENTS,
);
export const FinalAuthorityNetworkPostureSchema = z.enum(
  FINAL_AUTHORITY_NETWORK_POSTURES,
);
export const FinalAuthorityRawPayloadPostureSchema = z.enum(
  FINAL_AUTHORITY_RAW_PAYLOAD_POSTURES,
);
export const FinalAuthorityPhase20PostureSchema = z.enum(
  FINAL_AUTHORITY_PHASE20_POSTURES,
);

export const FinalAuthoritySurfaceRecordSchema = z.strictObject({
  inventory_version: z.literal(FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION),
  surface_id: FinalAuthoritySurfaceIdSchema,
  label: z.string().trim().min(1).max(120),
  phase_origin: z.array(FinalSystemPhaseIdSchema).min(1),
  read_authority: FinalAuthorityReadPostureSchema,
  write_authority: FinalAuthorityWritePostureSchema,
  execute_authority: FinalAuthorityExecutePostureSchema,
  approval_requirement: FinalAuthorityApprovalRequirementSchema,
  auto_approval_allowed: z.literal(false),
  network_posture: FinalAuthorityNetworkPostureSchema,
  raw_payload_posture: FinalAuthorityRawPayloadPostureSchema,
  disabled_feature_dependencies: z.array(FinalDisabledFeatureIdSchema).min(1),
  governance_notes: z.string().trim().min(1).max(360),
  final_phase20_posture: FinalAuthorityPhase20PostureSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  inventory_only: z.literal(true),
  creates_new_authority_surface: z.literal(false),
  reclassifies_existing_surface: z.literal(false),
  weakens_disabled_feature_matrix: z.literal(false),
  provider_call_performed: z.literal(false),
  network_call_performed: z.literal(false),
  runtime_filesystem_mutation_performed: z.literal(false),
  room_device_action_performed: z.literal(false),
  raw_payload_field_included: z.literal(false),
});

export const FinalAuthoritySurfacePostureSummarySchema = z.strictObject({
  inventory_version: z.literal(FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION),
  surface_count: z.number().int().positive(),
  approval_required_surface_count: z.number().int().nonnegative(),
  executable_surface_count: z.number().int().nonnegative(),
  network_capable_surface_count: z.number().int().nonnegative(),
  auto_approved_surface_count: z.literal(0),
  raw_payload_allowed_surface_count: z.literal(0),
  new_authority_surface_count: z.literal(0),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
});

export type FinalAuthoritySurfaceRecord = z.infer<
  typeof FinalAuthoritySurfaceRecordSchema
>;
export type FinalAuthoritySurfacePostureSummary = z.infer<
  typeof FinalAuthoritySurfacePostureSummarySchema
>;

const INVENTORY = [
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:model-runtime",
    label: "Model Runtime",
    phase_origin: ["phase-13"],
    read_authority: "metadata_only",
    write_authority: "append_only_metadata",
    execute_authority: "local_runtime_invocation",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "local_only",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:remote-cloud-defaults",
      "disabled-feature:ungoverned-provider-escalation",
      "disabled-feature:raw-payload-telemetry-ui-exposure",
    ],
    governance_notes:
      "Model routing remains governed by registry, safety, cost, and local-first policy; Phase 20A.4 only inventories the surface.",
    final_phase20_posture: "inventory_only_no_change",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:local-providers",
    label: "Local Providers",
    phase_origin: ["phase-13", "phase-14", "phase-15"],
    read_authority: "local_state",
    write_authority: "none",
    execute_authority: "local_runtime_invocation",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "local_only",
    raw_payload_posture: "in_memory_only_redacted_boundary",
    disabled_feature_dependencies: [
      "disabled-feature:remote-cloud-defaults",
      "disabled-feature:ungoverned-provider-escalation",
      "disabled-feature:raw-payload-telemetry-ui-exposure",
    ],
    governance_notes:
      "Local provider invocation remains bounded by provider contracts, redaction, and local-first governance; no provider is called by this inventory.",
    final_phase20_posture: "inventory_only_no_change",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:cloud-providers",
    label: "Cloud Providers",
    phase_origin: ["phase-13", "phase-14", "phase-15"],
    read_authority: "none",
    write_authority: "none",
    execute_authority: "cloud_runtime_disabled",
    approval_requirement: "disabled_no_approval_path",
    auto_approval_allowed: false,
    network_posture: "cloud_disabled_by_default",
    raw_payload_posture: "raw_forbidden",
    disabled_feature_dependencies: [
      "disabled-feature:remote-cloud-defaults",
      "disabled-feature:ungoverned-provider-escalation",
      "disabled-feature:raw-payload-telemetry-ui-exposure",
    ],
    governance_notes:
      "Cloud routes remain disabled by default and require explicit future consent, budget, and governance; Phase 20A.4 does not enable them.",
    final_phase20_posture: "remains_disabled_or_gated",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:voice-runtime",
    label: "Voice Runtime",
    phase_origin: ["phase-14"],
    read_authority: "local_sensitive_boundary",
    write_authority: "append_only_metadata",
    execute_authority: "local_runtime_invocation",
    approval_requirement: "approval_required_for_authority",
    auto_approval_allowed: false,
    network_posture: "local_only",
    raw_payload_posture: "in_memory_only_redacted_boundary",
    disabled_feature_dependencies: [
      "disabled-feature:wake-word",
      "disabled-feature:always-listening",
      "disabled-feature:hidden-capture",
      "disabled-feature:voice-only-approval",
      "disabled-feature:raw-payload-telemetry-ui-exposure",
    ],
    governance_notes:
      "Voice remains transport only; governance forbids voice-only approval, hidden capture, and raw transcript/audio telemetry.",
    final_phase20_posture: "remains_disabled_or_gated",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:vision-runtime",
    label: "Vision Runtime",
    phase_origin: ["phase-15"],
    read_authority: "local_sensitive_boundary",
    write_authority: "append_only_metadata",
    execute_authority: "local_runtime_invocation",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "local_only",
    raw_payload_posture: "in_memory_only_redacted_boundary",
    disabled_feature_dependencies: [
      "disabled-feature:background-camera",
      "disabled-feature:hidden-capture",
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:autonomous-device-execution",
    ],
    governance_notes:
      "Vision remains advisory and user-initiated; governance forbids background capture, raw frames, and autonomous action.",
    final_phase20_posture: "inventory_only_no_change",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:room-adapter-runtime",
    label: "Room Adapter Runtime",
    phase_origin: ["phase-16"],
    read_authority: "local_state",
    write_authority: "approval_gated_side_effect",
    execute_authority: "approval_gated_runtime",
    approval_requirement: "approval_required_for_execution",
    auto_approval_allowed: false,
    network_posture: "lan_local_only",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:autonomous-device-execution",
      "disabled-feature:unapproved-room-device-actions",
      "disabled-feature:whole-home-multi-room",
      "disabled-feature:remote-cloud-defaults",
    ],
    governance_notes:
      "Room adapter authority remains dry-run first, approval-gated, verification-bound, local/LAN-scoped, and never autonomous.",
    final_phase20_posture: "remains_approval_gated",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:scheduler-routines",
    label: "Scheduler and Routines",
    phase_origin: ["phase-17"],
    read_authority: "metadata_only",
    write_authority: "append_only_metadata",
    execute_authority: "foreground_scheduler_metadata_only",
    approval_requirement: "approval_required_for_authority",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:scheduler-side-effects",
      "disabled-feature:routine-chaining",
      "disabled-feature:auto-approval",
    ],
    governance_notes:
      "Scheduler output remains foreground, killable, suggestion-only, and governance-bound before any user action.",
    final_phase20_posture: "remains_disabled_or_gated",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:approval-service",
    label: "Approval Service",
    phase_origin: ["phase-18"],
    read_authority: "metadata_only",
    write_authority: "proposal_metadata_only",
    execute_authority: "approval_gated_runtime",
    approval_requirement: "approval_required_for_authority",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:auto-approval",
      "disabled-feature:voice-only-approval",
      "disabled-feature:unapproved-room-device-actions",
    ],
    governance_notes:
      "Approval service is the authority boundary; auto-approval, inherited approval, and bypass paths remain forbidden.",
    final_phase20_posture: "remains_approval_gated",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:tool-runtime",
    label: "Tool Runtime",
    phase_origin: ["phase-18"],
    read_authority: "local_sensitive_boundary",
    write_authority: "approval_gated_side_effect",
    execute_authority: "approval_gated_runtime",
    approval_requirement: "approval_required_for_execution",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:auto-approval",
      "disabled-feature:unapproved-room-device-actions",
      "disabled-feature:ui-run-retry-mutate-affordances",
    ],
    governance_notes:
      "Tool runtime remains behind approval lifecycle, dry-run metadata, audit preview, verification, and compensation boundaries.",
    final_phase20_posture: "remains_approval_gated",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:command-center-ui",
    label: "Command Center UI",
    phase_origin: ["phase-12"],
    read_authority: "redacted_projection",
    write_authority: "none",
    execute_authority: "none",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "local_only",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:public-remote-dashboards",
      "disabled-feature:ui-run-retry-mutate-affordances",
      "disabled-feature:raw-payload-telemetry-ui-exposure",
    ],
    governance_notes:
      "Command Center remains a local read-only observability surface with no run, retry, mutate, or approve shortcut controls.",
    final_phase20_posture: "read_only_metadata_inventory",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:architecture-graph",
    label: "Architecture Graph",
    phase_origin: ["phase-19"],
    read_authority: "metadata_only",
    write_authority: "none",
    execute_authority: "none",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:graph-driven-execution",
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:ui-run-retry-mutate-affordances",
    ],
    governance_notes:
      "Architecture graph remains an inert visibility and tripwire surface; graph edges cannot control runtime behavior.",
    final_phase20_posture: "read_only_metadata_inventory",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:telemetry-cockpit",
    label: "Telemetry Cockpit",
    phase_origin: ["phase-19"],
    read_authority: "redacted_projection",
    write_authority: "none",
    execute_authority: "none",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:ui-run-retry-mutate-affordances",
      "disabled-feature:public-remote-dashboards",
    ],
    governance_notes:
      "Telemetry cockpit remains a deterministic read-only projection and does not ingest live data or control runtime state.",
    final_phase20_posture: "read_only_metadata_inventory",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:governance-visualizer",
    label: "Governance Visualizer",
    phase_origin: ["phase-19"],
    read_authority: "metadata_only",
    write_authority: "none",
    execute_authority: "none",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:graph-driven-execution",
      "disabled-feature:auto-approval",
      "disabled-feature:ui-run-retry-mutate-affordances",
    ],
    governance_notes:
      "Governance visualizer can explain policy boundaries but cannot edit policy, approval state, or trust classes.",
    final_phase20_posture: "read_only_metadata_inventory",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:red-team-sandbox-cai",
    label: "Red-Team Sandbox / CAI Layer",
    phase_origin: ["phase-19"],
    read_authority: "metadata_only",
    write_authority: "proposal_metadata_only",
    execute_authority: "sandbox_dry_run_only",
    approval_requirement: "approval_required_for_red_team_classes",
    auto_approval_allowed: false,
    network_posture: "sandbox_whitelist_only",
    raw_payload_posture: "raw_forbidden",
    disabled_feature_dependencies: [
      "disabled-feature:cai-non-whitelisted-targets",
      "disabled-feature:auto-approval",
      "disabled-feature:remote-cloud-defaults",
      "disabled-feature:raw-payload-telemetry-ui-exposure",
    ],
    governance_notes:
      "Red-team/CAI remains sandboxed, whitelist-bound, dry-run-first, approval-governed, and non-executing outside explicit future enablement.",
    final_phase20_posture: "remains_disabled_or_gated",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:event-store-persistence",
    label: "Event Store / Persistence",
    phase_origin: ["phase-11"],
    read_authority: "metadata_only",
    write_authority: "append_only_metadata",
    execute_authority: "none",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:remote-cloud-defaults",
    ],
    governance_notes:
      "Persistence remains local, append-only, projection-safe, and redaction-aware; inventory performs no filesystem or database mutation.",
    final_phase20_posture: "inventory_only_no_change",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:project-intelligence",
    label: "Project Intelligence",
    phase_origin: ["phase-10", "phase-11", "phase-12"],
    read_authority: "metadata_only",
    write_authority: "append_only_metadata",
    execute_authority: "none",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:scheduler-side-effects",
      "disabled-feature:auto-approval",
    ],
    governance_notes:
      "Project intelligence remains registry, continuity, and context metadata; it does not grant autonomous task execution.",
    final_phase20_posture: "inventory_only_no_change",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
  {
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_id: "authority-surface:memory-bridge",
    label: "Memory Bridge",
    phase_origin: ["phase-11", "phase-13"],
    read_authority: "local_sensitive_boundary",
    write_authority: "append_only_metadata",
    execute_authority: "none",
    approval_requirement: "not_applicable",
    auto_approval_allowed: false,
    network_posture: "none",
    raw_payload_posture: "metadata_only_redacted",
    disabled_feature_dependencies: [
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:remote-cloud-defaults",
      "disabled-feature:ungoverned-provider-escalation",
    ],
    governance_notes:
      "Memory bridge remains local, redacted, and projection-bounded; retrieval context cannot bypass provider or approval governance.",
    final_phase20_posture: "inventory_only_no_change",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    inventory_only: true,
    creates_new_authority_surface: false,
    reclassifies_existing_surface: false,
    weakens_disabled_feature_matrix: false,
    provider_call_performed: false,
    network_call_performed: false,
    runtime_filesystem_mutation_performed: false,
    room_device_action_performed: false,
    raw_payload_field_included: false,
  },
] satisfies readonly FinalAuthoritySurfaceRecord[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copySurface(
  surface: FinalAuthoritySurfaceRecord,
): FinalAuthoritySurfaceRecord {
  return FinalAuthoritySurfaceRecordSchema.parse(
    JSON.parse(JSON.stringify(surface)),
  );
}

function copySurfaces(
  surfaces: readonly FinalAuthoritySurfaceRecord[],
): FinalAuthoritySurfaceRecord[] {
  return surfaces.map(copySurface);
}

function hasExecutionAuthority(surface: FinalAuthoritySurfaceRecord): boolean {
  return !["none", "cloud_runtime_disabled"].includes(
    surface.execute_authority,
  );
}

function isNetworkCapable(surface: FinalAuthoritySurfaceRecord): boolean {
  return !["none", "local_only"].includes(surface.network_posture);
}

export const FINAL_AUTHORITY_SURFACE_INVENTORY = deepFreeze(
  FinalAuthoritySurfaceRecordSchema.array().parse(INVENTORY),
);

export function getFinalAuthoritySurfaceInventory(): readonly FinalAuthoritySurfaceRecord[] {
  return copySurfaces(FINAL_AUTHORITY_SURFACE_INVENTORY);
}

export function getAuthoritySurfacesRequiringApproval(): readonly FinalAuthoritySurfaceRecord[] {
  return copySurfaces(
    FINAL_AUTHORITY_SURFACE_INVENTORY.filter(
      (surface) => surface.approval_requirement !== "not_applicable",
    ),
  );
}

export function getExecutableAuthoritySurfaces(): readonly FinalAuthoritySurfaceRecord[] {
  return copySurfaces(
    FINAL_AUTHORITY_SURFACE_INVENTORY.filter(hasExecutionAuthority),
  );
}

export function getNetworkCapableAuthoritySurfaces(): readonly FinalAuthoritySurfaceRecord[] {
  return copySurfaces(
    FINAL_AUTHORITY_SURFACE_INVENTORY.filter(isNetworkCapable),
  );
}

export function summarizeAuthoritySurfacePosture(): FinalAuthoritySurfacePostureSummary {
  const approvalRequired = getAuthoritySurfacesRequiringApproval();
  const executable = getExecutableAuthoritySurfaces();
  const networkCapable = getNetworkCapableAuthoritySurfaces();

  return FinalAuthoritySurfacePostureSummarySchema.parse({
    inventory_version: FINAL_AUTHORITY_SURFACE_INVENTORY_VERSION,
    surface_count: FINAL_AUTHORITY_SURFACE_INVENTORY.length,
    approval_required_surface_count: approvalRequired.length,
    executable_surface_count: executable.length,
    network_capable_surface_count: networkCapable.length,
    auto_approved_surface_count: 0,
    raw_payload_allowed_surface_count: 0,
    new_authority_surface_count: 0,
    metadata_only: true,
    read_only: true,
    deterministic: true,
  });
}
