import { z } from "zod";

import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS,
  CommandCenterObservabilityQueryCategorySchema,
  type CommandCenterObservabilityQueryCategory,
} from "./observability-contract";
import {
  CommandCenterObservabilitySourcePhaseSchema,
  type CommandCenterObservabilitySourcePhase,
} from "./observability-adapters";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  CommandCenterObservabilityAllowedMetadataFieldClassSchema,
  type CommandCenterObservabilityAllowedMetadataFieldClass,
} from "./observability-redaction";
import {
  COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
  COMMAND_CENTER_WORKING_PANEL_SLOTS,
} from "./screens";

export const WORKING_COCKPIT_PANEL_IDS = [
  ...COMMAND_CENTER_WORKING_PANEL_SLOTS,
] as const;
export const WORKING_COCKPIT_SOURCE_CATEGORIES = [
  ...WORKING_COCKPIT_PANEL_IDS,
] as const;
export const WORKING_COCKPIT_UPDATE_CADENCE_BANDS = [
  "manual",
  "low",
  "medium",
] as const;
export const WORKING_COCKPIT_FORBIDDEN_AFFORDANCES = [
  ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS,
  "call_tool",
  "capture_audio",
  "capture_video",
  "fetch",
  "route",
  "open_remote_dashboard",
] as const;
export const WORKING_COCKPIT_PANEL_VALIDATION_REASONS = [
  "panel_descriptor_valid",
  "schema_rejected",
  "unknown_panel_id",
  "unknown_source_category",
  "interactive_panel",
  "mutating_affordance_declared",
  "redaction_bypassed",
  "raw_payload_field_declared",
  "unsafe_cadence",
  "hard_cap_exceeded",
] as const;
export const WORKING_COCKPIT_PANEL_REGISTRY_VALIDATION_REASONS = [
  ...WORKING_COCKPIT_PANEL_VALIDATION_REASONS,
  "duplicate_panel_id",
  "missing_panel_id",
  "priority_order_not_deterministic",
] as const;
export const WORKING_COCKPIT_MUTATING_AFFORDANCE_KEYS = [
  "allowed_affordances",
  "enabled_affordances",
  "mutating_affordances",
  "execute",
  "approve",
  "schedule",
  "retry",
  "mutate",
  "call_tool",
  "capture",
  "fetch",
  "route",
  "on_execute",
  "on_approve",
  "on_schedule_routine",
  "tool_call_hook",
  "approval_hook",
  "routine_hook",
] as const;

export const WorkingCockpitPanelIdSchema = z.enum(WORKING_COCKPIT_PANEL_IDS);
export const WorkingCockpitSourceCategorySchema = z.enum(
  WORKING_COCKPIT_SOURCE_CATEGORIES,
);
export const WorkingCockpitUpdateCadenceBandSchema = z.enum(
  WORKING_COCKPIT_UPDATE_CADENCE_BANDS,
);
export const WorkingCockpitForbiddenAffordanceSchema = z.enum(
  WORKING_COCKPIT_FORBIDDEN_AFFORDANCES,
);
export const WorkingCockpitPanelValidationReasonSchema = z.enum(
  WORKING_COCKPIT_PANEL_VALIDATION_REASONS,
);
export const WorkingCockpitPanelRegistryValidationReasonSchema = z.enum(
  WORKING_COCKPIT_PANEL_REGISTRY_VALIDATION_REASONS,
);
export const WorkingCockpitMutatingAffordanceKeySchema = z.enum(
  WORKING_COCKPIT_MUTATING_AFFORDANCE_KEYS,
);

export const WorkingCockpitPanelDescriptorSchema = z.strictObject({
  kind: z.literal("command_center.working_cockpit_panel_descriptor"),
  phase: z.literal("9D1"),
  panel_id: WorkingCockpitPanelIdSchema,
  source_category: WorkingCockpitSourceCategorySchema,
  source_phase: CommandCenterObservabilitySourcePhaseSchema,
  display_priority: z
    .number()
    .int()
    .min(1)
    .max(WORKING_COCKPIT_PANEL_IDS.length),
  update_cadence_band: WorkingCockpitUpdateCadenceBandSchema,
  max_items: z.number().int().min(1).max(50),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.literal(true),
  interactive: z.literal(false),
  allowed_field_classes: z.array(
    CommandCenterObservabilityAllowedMetadataFieldClassSchema,
  ),
  forbidden_affordances: z.array(WorkingCockpitForbiddenAffordanceSchema),
  raw_payload_fields_allowed: z.literal(false),
  source_reads_wired: z.literal(false),
  observability_api_reads_wired: z.literal(false),
  db_access_wired: z.literal(false),
  telemetry_access_wired: z.literal(false),
  live_stream_wired: z.literal(false),
  network_fetch_allowed: z.literal(false),
  can_execute: z.literal(false),
  can_approve: z.literal(false),
  can_schedule: z.literal(false),
  can_retry: z.literal(false),
  can_mutate: z.literal(false),
  can_call_tools: z.literal(false),
  can_capture: z.literal(false),
  can_route: z.literal(false),
});

export const WorkingCockpitPanelRegistrySchema = z.strictObject({
  kind: z.literal("command_center.working_cockpit_panel_registry"),
  phase: z.literal("9D1"),
  panels: z.array(WorkingCockpitPanelDescriptorSchema),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.literal(true),
  interactive: z.literal(false),
  descriptor_only: z.literal(true),
});

export const WorkingCockpitPanelValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(WorkingCockpitPanelValidationReasonSchema),
  panel_id: WorkingCockpitPanelIdSchema.nullable(),
  source_category: CommandCenterObservabilityQueryCategorySchema.nullable(),
  metadata_only: z.boolean(),
  redaction_required: z.boolean(),
  render_safe: z.boolean(),
  interactive: z.boolean(),
  descriptor_only: z.literal(true),
  source_reads_wired: z.literal(false),
  observability_api_reads_wired: z.literal(false),
  db_access_wired: z.literal(false),
  telemetry_access_wired: z.literal(false),
  live_stream_wired: z.literal(false),
  can_execute: z.literal(false),
  can_approve: z.literal(false),
  can_schedule: z.literal(false),
  can_retry: z.literal(false),
  can_mutate: z.literal(false),
  can_call_tools: z.literal(false),
  can_capture: z.literal(false),
  can_route: z.literal(false),
});

export const WorkingCockpitPanelRegistryValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(WorkingCockpitPanelRegistryValidationReasonSchema),
  panel_count: z.number().int().nonnegative(),
  missing_panel_ids: z.array(WorkingCockpitPanelIdSchema),
  duplicate_panel_ids: z.array(WorkingCockpitPanelIdSchema),
  invalid_panel_ids: z.array(WorkingCockpitPanelIdSchema),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.literal(true),
  interactive: z.literal(false),
  descriptor_only: z.literal(true),
  source_reads_wired: z.literal(false),
  observability_api_reads_wired: z.literal(false),
  db_access_wired: z.literal(false),
  telemetry_access_wired: z.literal(false),
  live_stream_wired: z.literal(false),
  can_execute: z.literal(false),
  can_approve: z.literal(false),
  can_schedule: z.literal(false),
  can_retry: z.literal(false),
  can_mutate: z.literal(false),
  can_call_tools: z.literal(false),
  can_capture: z.literal(false),
  can_route: z.literal(false),
});

export const WorkingCockpitPanelLookupSchema = z.strictObject({
  found: z.boolean(),
  panel_id: WorkingCockpitPanelIdSchema.nullable(),
  panel: WorkingCockpitPanelDescriptorSchema.nullable(),
  reason: WorkingCockpitPanelValidationReasonSchema,
  descriptor_only: z.literal(true),
  source_reads_wired: z.literal(false),
});

export type WorkingCockpitPanelId = z.infer<typeof WorkingCockpitPanelIdSchema>;
export type WorkingCockpitSourceCategory = z.infer<
  typeof WorkingCockpitSourceCategorySchema
>;
export type WorkingCockpitUpdateCadenceBand = z.infer<
  typeof WorkingCockpitUpdateCadenceBandSchema
>;
export type WorkingCockpitForbiddenAffordance = z.infer<
  typeof WorkingCockpitForbiddenAffordanceSchema
>;
export type WorkingCockpitPanelValidationReason = z.infer<
  typeof WorkingCockpitPanelValidationReasonSchema
>;
export type WorkingCockpitPanelRegistryValidationReason = z.infer<
  typeof WorkingCockpitPanelRegistryValidationReasonSchema
>;
export type WorkingCockpitMutatingAffordanceKey = z.infer<
  typeof WorkingCockpitMutatingAffordanceKeySchema
>;
export type WorkingCockpitPanelDescriptor = z.infer<
  typeof WorkingCockpitPanelDescriptorSchema
>;
export type WorkingCockpitPanelRegistry = z.infer<
  typeof WorkingCockpitPanelRegistrySchema
>;
export type WorkingCockpitPanelValidation = z.infer<
  typeof WorkingCockpitPanelValidationSchema
>;
export type WorkingCockpitPanelRegistryValidation = z.infer<
  typeof WorkingCockpitPanelRegistryValidationSchema
>;
export type WorkingCockpitPanelLookup = z.infer<
  typeof WorkingCockpitPanelLookupSchema
>;

export const DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY: WorkingCockpitPanelRegistry =
  WorkingCockpitPanelRegistrySchema.parse({
    kind: "command_center.working_cockpit_panel_registry",
    phase: "9D1",
    panels: WORKING_COCKPIT_PANEL_IDS.map((panelId, index) =>
      createWorkingCockpitPanelDescriptor(panelId, index + 1),
    ),
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    interactive: false,
    descriptor_only: true,
  });

export function listWorkingCockpitPanels(
  registry: WorkingCockpitPanelRegistry = DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
): WorkingCockpitPanelDescriptor[] {
  return [...WorkingCockpitPanelRegistrySchema.parse(registry).panels].sort(
    (left, right) => left.display_priority - right.display_priority,
  );
}

export function findWorkingCockpitPanel(
  panelIdInput: unknown,
  registry: WorkingCockpitPanelRegistry = DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
): WorkingCockpitPanelLookup {
  const panelId = WorkingCockpitPanelIdSchema.safeParse(panelIdInput);
  if (!panelId.success) {
    return WorkingCockpitPanelLookupSchema.parse({
      found: false,
      panel_id: null,
      panel: null,
      reason: "unknown_panel_id",
      descriptor_only: true,
      source_reads_wired: false,
    });
  }

  const panel = WorkingCockpitPanelRegistrySchema.parse(registry).panels.find(
    (item) => item.panel_id === panelId.data,
  );
  return WorkingCockpitPanelLookupSchema.parse({
    found: panel !== undefined,
    panel_id: panelId.data,
    panel: panel ?? null,
    reason: panel ? "panel_descriptor_valid" : "unknown_panel_id",
    descriptor_only: true,
    source_reads_wired: false,
  });
}

export function validateWorkingCockpitPanelDescriptor(
  input: unknown,
): WorkingCockpitPanelValidation {
  const parsed = WorkingCockpitPanelDescriptorSchema.safeParse(input);
  const partial = readPartialPanel(input);
  const reasons = new Set<WorkingCockpitPanelValidationReason>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (partial.panel_id === null) reasons.add("unknown_panel_id");
  if (
    partial.source_category === null ||
    (partial.source_category !== null &&
      !isWorkingPanelCategory(partial.source_category))
  ) {
    reasons.add("unknown_source_category");
  }
  if (partial.interactive !== false) reasons.add("interactive_panel");
  if (
    partial.metadata_only !== true ||
    partial.render_safe !== true ||
    partial.redaction_required !== true
  ) {
    reasons.add("redaction_bypassed");
  }
  if (declaresMutatingAffordance(input)) {
    reasons.add("mutating_affordance_declared");
  }
  if (declaresRawPayloadFieldClass(input)) {
    reasons.add("raw_payload_field_declared");
  }
  if (
    partial.update_cadence_band !== undefined &&
    !isSafeCadenceBand(partial.update_cadence_band)
  ) {
    reasons.add("unsafe_cadence");
  }
  if (
    typeof partial.max_items === "number" &&
    (partial.max_items < 1 || partial.max_items > 50)
  ) {
    reasons.add("hard_cap_exceeded");
  }

  return WorkingCockpitPanelValidationSchema.parse({
    passed: reasons.size === 0,
    reasons: reasons.size === 0 ? ["panel_descriptor_valid"] : [...reasons],
    panel_id: partial.panel_id,
    source_category: partial.source_category,
    metadata_only: partial.metadata_only === true,
    redaction_required: partial.redaction_required === true,
    render_safe: partial.render_safe === true,
    interactive: partial.interactive === true,
    descriptor_only: true,
    source_reads_wired: false,
    observability_api_reads_wired: false,
    db_access_wired: false,
    telemetry_access_wired: false,
    live_stream_wired: false,
    can_execute: false,
    can_approve: false,
    can_schedule: false,
    can_retry: false,
    can_mutate: false,
    can_call_tools: false,
    can_capture: false,
    can_route: false,
  });
}

export function validateWorkingCockpitPanelRegistry(
  input: unknown = DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
): WorkingCockpitPanelRegistryValidation {
  const parsed = WorkingCockpitPanelRegistrySchema.safeParse(input);
  const panels = readPanels(input);
  const reasons = new Set<WorkingCockpitPanelRegistryValidationReason>();
  const seen = new Set<WorkingCockpitPanelId>();
  const duplicates = new Set<WorkingCockpitPanelId>();
  const invalidPanelIds = new Set<WorkingCockpitPanelId>();

  if (!parsed.success) reasons.add("schema_rejected");
  for (const panel of panels) {
    const validation = validateWorkingCockpitPanelDescriptor(panel);
    if (!validation.passed) {
      validation.reasons.forEach((reason) => {
        if (reason !== "panel_descriptor_valid") reasons.add(reason);
      });
      if (validation.panel_id !== null)
        invalidPanelIds.add(validation.panel_id);
    }
    if (validation.panel_id !== null) {
      if (seen.has(validation.panel_id)) {
        duplicates.add(validation.panel_id);
        reasons.add("duplicate_panel_id");
      }
      seen.add(validation.panel_id);
    }
  }

  const missing = WORKING_COCKPIT_PANEL_IDS.filter(
    (panelId) => !seen.has(panelId),
  );
  if (missing.length > 0) reasons.add("missing_panel_id");
  if (!hasDeterministicPriorityOrder(panels)) {
    reasons.add("priority_order_not_deterministic");
  }

  return WorkingCockpitPanelRegistryValidationSchema.parse({
    passed: reasons.size === 0,
    reasons: reasons.size === 0 ? ["panel_descriptor_valid"] : [...reasons],
    panel_count: panels.length,
    missing_panel_ids: missing,
    duplicate_panel_ids: [...duplicates],
    invalid_panel_ids: [...invalidPanelIds],
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    interactive: false,
    descriptor_only: true,
    source_reads_wired: false,
    observability_api_reads_wired: false,
    db_access_wired: false,
    telemetry_access_wired: false,
    live_stream_wired: false,
    can_execute: false,
    can_approve: false,
    can_schedule: false,
    can_retry: false,
    can_mutate: false,
    can_call_tools: false,
    can_capture: false,
    can_route: false,
  });
}

function createWorkingCockpitPanelDescriptor(
  panelId: WorkingCockpitPanelId,
  displayPriority: number,
): WorkingCockpitPanelDescriptor {
  const sourceCategory = sourceCategoryForPanel(panelId);
  return {
    kind: "command_center.working_cockpit_panel_descriptor",
    phase: "9D1",
    panel_id: panelId,
    source_category: sourceCategory,
    source_phase: sourcePhaseForCategory(sourceCategory),
    display_priority: displayPriority,
    update_cadence_band: cadenceForPanel(panelId),
    max_items: maxItemsForPanel(panelId),
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    interactive: false,
    allowed_field_classes: allowedFieldClassesForPanel(panelId),
    forbidden_affordances: [...WORKING_COCKPIT_FORBIDDEN_AFFORDANCES],
    raw_payload_fields_allowed: false,
    source_reads_wired: false,
    observability_api_reads_wired: false,
    db_access_wired: false,
    telemetry_access_wired: false,
    live_stream_wired: false,
    network_fetch_allowed: false,
    can_execute: false,
    can_approve: false,
    can_schedule: false,
    can_retry: false,
    can_mutate: false,
    can_call_tools: false,
    can_capture: false,
    can_route: false,
  };
}

function sourceCategoryForPanel(
  panelId: WorkingCockpitPanelId,
): WorkingCockpitSourceCategory {
  return panelId;
}

function sourcePhaseForCategory(
  category: WorkingCockpitSourceCategory,
): CommandCenterObservabilitySourcePhase {
  const map: Record<
    WorkingCockpitPanelId,
    CommandCenterObservabilitySourcePhase
  > = {
    router: "phase_router",
    tool_calls: "phase_tools",
    approvals: "phase_approvals",
    costs: "phase_costs",
    safety: "phase_safety",
    vision: "phase_vision",
    environment: "phase_environment",
    projects: "phase_projects",
    routines: "phase_routines",
    suggestions: "phase_suggestions",
  };
  return map[category as WorkingCockpitPanelId];
}

function cadenceForPanel(
  panelId: WorkingCockpitPanelId,
): WorkingCockpitUpdateCadenceBand {
  if (panelId === "approvals" || panelId === "safety") return "medium";
  if (panelId === "router" || panelId === "tool_calls") return "medium";
  return "low";
}

function maxItemsForPanel(panelId: WorkingCockpitPanelId): number {
  if (panelId === "suggestions") return 10;
  if (panelId === "tool_calls" || panelId === "approvals") return 20;
  return 15;
}

function allowedFieldClassesForPanel(
  panelId: WorkingCockpitPanelId,
): CommandCenterObservabilityAllowedMetadataFieldClass[] {
  const common: CommandCenterObservabilityAllowedMetadataFieldClass[] = [
    "status_classes",
    "error_classes",
    "gate_decisions",
    "hashes",
    "redacted_ids",
    "timestamps",
    "subsystem_ids",
  ];
  if (panelId === "costs") return [...common, "cost_bins", "binned_counts"];
  if (panelId === "tool_calls") {
    return [...common, "capability_ids", "provider_ids", "latency_bands"];
  }
  if (panelId === "routines") {
    return [...common, "schedule_metadata", "routine_ids"];
  }
  if (panelId === "vision") {
    return [...common, "confidence_bands", "latency_bands"];
  }
  return [...common, "binned_counts", "latency_bands"];
}

function readPartialPanel(input: unknown): {
  panel_id: WorkingCockpitPanelId | null;
  source_category: CommandCenterObservabilityQueryCategory | null;
  metadata_only?: unknown;
  redaction_required?: unknown;
  render_safe?: unknown;
  interactive?: unknown;
  update_cadence_band?: unknown;
  max_items?: unknown;
} {
  if (!input || typeof input !== "object") {
    return { panel_id: null, source_category: null };
  }
  const record = input as Record<string, unknown>;
  const panelId = WorkingCockpitPanelIdSchema.safeParse(record.panel_id);
  const sourceCategory =
    CommandCenterObservabilityQueryCategorySchema.safeParse(
      record.source_category,
    );
  return {
    panel_id: panelId.success ? panelId.data : null,
    source_category: sourceCategory.success ? sourceCategory.data : null,
    metadata_only: record.metadata_only,
    redaction_required: record.redaction_required,
    render_safe: record.render_safe,
    interactive: record.interactive,
    update_cadence_band: record.update_cadence_band,
    max_items: record.max_items,
  };
}

function declaresMutatingAffordance(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  if (Array.isArray(input)) {
    return input.some((item) => declaresMutatingAffordance(item));
  }
  for (const [key, value] of Object.entries(input)) {
    if (key === "forbidden_affordances") {
      if (!hasAllForbiddenAffordances(value)) return true;
      continue;
    }
    if (
      (
        [
          ...WORKING_COCKPIT_MUTATING_AFFORDANCE_KEYS,
          ...COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
        ] as readonly string[]
      ).includes(key)
    ) {
      return true;
    }
    if (declaresMutatingAffordance(value)) return true;
  }
  return false;
}

function hasAllForbiddenAffordances(input: unknown): boolean {
  if (!Array.isArray(input)) return false;
  return WORKING_COCKPIT_FORBIDDEN_AFFORDANCES.every((affordance) =>
    input.includes(affordance),
  );
}

function declaresRawPayloadFieldClass(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  if (Array.isArray(input)) {
    return input.some((item) => declaresRawPayloadFieldClass(item));
  }
  for (const [key, value] of Object.entries(input)) {
    if (
      key === "allowed_field_classes" &&
      Array.isArray(value) &&
      value.some((item) =>
        (
          COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
        ).includes(String(item)),
      )
    ) {
      return true;
    }
    if (declaresRawPayloadFieldClass(value)) return true;
  }
  return false;
}

function isSafeCadenceBand(input: unknown): boolean {
  return (WORKING_COCKPIT_UPDATE_CADENCE_BANDS as readonly unknown[]).includes(
    input,
  );
}

function isWorkingPanelCategory(
  category: CommandCenterObservabilityQueryCategory,
): boolean {
  return (WORKING_COCKPIT_PANEL_IDS as readonly string[]).includes(category);
}

function readPanels(input: unknown): unknown[] {
  if (!input || typeof input !== "object") return [];
  const panels = (input as { panels?: unknown }).panels;
  return Array.isArray(panels) ? panels : [];
}

function hasDeterministicPriorityOrder(panels: unknown[]): boolean {
  const parsedPanels = panels
    .map((panel) => WorkingCockpitPanelDescriptorSchema.safeParse(panel))
    .filter((result) => result.success)
    .map((result) => result.data);
  if (parsedPanels.length !== panels.length) return false;
  return parsedPanels.every(
    (panel, index) =>
      panel.display_priority === index + 1 &&
      panel.panel_id === WORKING_COCKPIT_PANEL_IDS[index],
  );
}
