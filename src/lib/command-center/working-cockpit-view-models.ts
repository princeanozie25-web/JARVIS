import { z } from "zod";

import {
  CommandCenterObservabilityResponseEnvelopeSchema,
  CommandCenterObservabilityRedactionStatusSchema,
  type CommandCenterObservabilityQueryCategory,
  type CommandCenterObservabilityResponseEnvelope,
} from "./observability-contract";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  validateObservabilityPayloadSafety,
} from "./observability-redaction";
import {
  WORKING_COCKPIT_MUTATING_AFFORDANCE_KEYS,
  WORKING_COCKPIT_PANEL_IDS,
  WorkingCockpitPanelIdSchema,
  listWorkingCockpitPanels,
  type WorkingCockpitPanelId,
} from "./working-cockpit-panels";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const WORKING_COCKPIT_STATUS_CLASSES = [
  "unknown",
  "idle",
  "nominal",
  "active",
  "degraded",
  "blocked",
  "error",
] as const;
export const WORKING_COCKPIT_COUNT_BANDS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const WORKING_COCKPIT_LATENCY_BANDS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const WORKING_COCKPIT_CONFIDENCE_BANDS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const WORKING_COCKPIT_COST_BINS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const WORKING_COCKPIT_STATE_CLASSES = [
  "unknown",
  "nominal",
  "degraded",
  "blocked",
] as const;
export const WORKING_COCKPIT_VIEW_MODEL_VALIDATION_REASONS = [
  "working_cockpit_view_model_valid",
  "schema_rejected",
  "missing_panel",
  "panel_id_mismatch",
  "raw_payload_field_present",
  "authority_key_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;

export const WorkingCockpitStatusClassSchema = z.enum(
  WORKING_COCKPIT_STATUS_CLASSES,
);
export const WorkingCockpitCountBandSchema = z.enum(
  WORKING_COCKPIT_COUNT_BANDS,
);
export const WorkingCockpitLatencyBandSchema = z.enum(
  WORKING_COCKPIT_LATENCY_BANDS,
);
export const WorkingCockpitConfidenceBandSchema = z.enum(
  WORKING_COCKPIT_CONFIDENCE_BANDS,
);
export const WorkingCockpitCostBinSchema = z.enum(WORKING_COCKPIT_COST_BINS);
export const WorkingCockpitStateClassSchema = z.enum(
  WORKING_COCKPIT_STATE_CLASSES,
);
export const WorkingCockpitViewModelValidationReasonSchema = z.enum(
  WORKING_COCKPIT_VIEW_MODEL_VALIDATION_REASONS,
);

const CountBinsSchema = z.strictObject({
  none: WorkingCockpitCountBandSchema,
  low: WorkingCockpitCountBandSchema,
  medium: WorkingCockpitCountBandSchema,
  high: WorkingCockpitCountBandSchema,
});

const SummaryBinsSchema = z.strictObject({
  primary: WorkingCockpitCountBandSchema,
  secondary: WorkingCockpitCountBandSchema,
});

const WorkingCockpitPanelViewModelBaseSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.working_cockpit_panel_view_model"),
    phase: z.literal("9D2"),
    panel_id: WorkingCockpitPanelIdSchema,
    status_class: WorkingCockpitStatusClassSchema,
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    generated_at: z.number().int().nonnegative(),
    truncated: z.boolean(),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
    render_safe: z.literal(true),
    interactive: z.literal(false),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    network_fetch_allowed: z.literal(false),
    approval_actions_allowed: z.literal(false),
    routine_actions_allowed: z.literal(false),
    tool_actions_allowed: z.literal(false),
    replay_run_actions_allowed: z.literal(false),
    capture_actions_allowed: z.literal(false),
    can_execute: z.literal(false),
    can_approve: z.literal(false),
    can_schedule: z.literal(false),
    can_retry: z.literal(false),
    can_mutate: z.literal(false),
    can_call_tools: z.literal(false),
    can_capture: z.literal(false),
    can_fetch: z.literal(false),
    can_route: z.literal(false),
  });

export const RouterPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("router"),
    count_bins: CountBinsSchema,
    latency_band: WorkingCockpitLatencyBandSchema,
  });
export const ToolCallsPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("tool_calls"),
    count_bins: CountBinsSchema,
    latency_band: WorkingCockpitLatencyBandSchema,
  });
export const ApprovalsPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("approvals"),
    count_bins: CountBinsSchema,
    state_class: WorkingCockpitStateClassSchema,
  });
export const CostsPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("costs"),
    cost_bin: WorkingCockpitCostBinSchema,
    summary_bins: SummaryBinsSchema,
  });
export const SafetyPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("safety"),
    count_bins: CountBinsSchema,
    state_class: WorkingCockpitStateClassSchema,
  });
export const VisionPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("vision"),
    confidence_band: WorkingCockpitConfidenceBandSchema,
    latency_band: WorkingCockpitLatencyBandSchema,
    degraded_state_class: WorkingCockpitStateClassSchema,
  });
export const EnvironmentPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("environment"),
    summary_bins: SummaryBinsSchema,
    state_class: WorkingCockpitStateClassSchema,
  });
export const ProjectsPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("projects"),
    count_bins: CountBinsSchema,
    state_class: WorkingCockpitStateClassSchema,
  });
export const RoutinesPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("routines"),
    count_bins: CountBinsSchema,
    state_class: WorkingCockpitStateClassSchema,
  });
export const SuggestionsPanelViewModelSchema =
  WorkingCockpitPanelViewModelBaseSchema.extend({
    panel_id: z.literal("suggestions"),
    count_bins: CountBinsSchema,
    confidence_band: WorkingCockpitConfidenceBandSchema,
  });

export const WorkingCockpitPanelViewModelSchema = z.discriminatedUnion(
  "panel_id",
  [
    RouterPanelViewModelSchema,
    ToolCallsPanelViewModelSchema,
    ApprovalsPanelViewModelSchema,
    CostsPanelViewModelSchema,
    SafetyPanelViewModelSchema,
    VisionPanelViewModelSchema,
    EnvironmentPanelViewModelSchema,
    ProjectsPanelViewModelSchema,
    RoutinesPanelViewModelSchema,
    SuggestionsPanelViewModelSchema,
  ],
);

export const WorkingCockpitViewModelSchema = z.strictObject({
  kind: z.literal("command_center.working_cockpit_view_model"),
  phase: z.literal("9D2"),
  panel_order: z
    .array(WorkingCockpitPanelIdSchema)
    .length(WORKING_COCKPIT_PANEL_IDS.length),
  panels: z.strictObject({
    router: RouterPanelViewModelSchema,
    tool_calls: ToolCallsPanelViewModelSchema,
    approvals: ApprovalsPanelViewModelSchema,
    costs: CostsPanelViewModelSchema,
    safety: SafetyPanelViewModelSchema,
    vision: VisionPanelViewModelSchema,
    environment: EnvironmentPanelViewModelSchema,
    projects: ProjectsPanelViewModelSchema,
    routines: RoutinesPanelViewModelSchema,
    suggestions: SuggestionsPanelViewModelSchema,
  }),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.literal(true),
  interactive: z.literal(false),
  raw_payloads_included: z.literal(false),
  exact_pii_included: z.literal(false),
  authority_surface: z.literal(false),
});

export const WorkingCockpitViewModelValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(WorkingCockpitViewModelValidationReasonSchema),
    missing_panels: z.array(WorkingCockpitPanelIdSchema),
    mismatched_panels: z.array(WorkingCockpitPanelIdSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
    render_safe: z.boolean(),
    interactive: z.literal(false),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type WorkingCockpitStatusClass = z.infer<
  typeof WorkingCockpitStatusClassSchema
>;
export type WorkingCockpitCountBand = z.infer<
  typeof WorkingCockpitCountBandSchema
>;
export type WorkingCockpitLatencyBand = z.infer<
  typeof WorkingCockpitLatencyBandSchema
>;
export type WorkingCockpitConfidenceBand = z.infer<
  typeof WorkingCockpitConfidenceBandSchema
>;
export type WorkingCockpitCostBin = z.infer<typeof WorkingCockpitCostBinSchema>;
export type WorkingCockpitStateClass = z.infer<
  typeof WorkingCockpitStateClassSchema
>;
export type WorkingCockpitViewModelValidationReason = z.infer<
  typeof WorkingCockpitViewModelValidationReasonSchema
>;
export type RouterPanelViewModel = z.infer<typeof RouterPanelViewModelSchema>;
export type ToolCallsPanelViewModel = z.infer<
  typeof ToolCallsPanelViewModelSchema
>;
export type ApprovalsPanelViewModel = z.infer<
  typeof ApprovalsPanelViewModelSchema
>;
export type CostsPanelViewModel = z.infer<typeof CostsPanelViewModelSchema>;
export type SafetyPanelViewModel = z.infer<typeof SafetyPanelViewModelSchema>;
export type VisionPanelViewModel = z.infer<typeof VisionPanelViewModelSchema>;
export type EnvironmentPanelViewModel = z.infer<
  typeof EnvironmentPanelViewModelSchema
>;
export type ProjectsPanelViewModel = z.infer<
  typeof ProjectsPanelViewModelSchema
>;
export type RoutinesPanelViewModel = z.infer<
  typeof RoutinesPanelViewModelSchema
>;
export type SuggestionsPanelViewModel = z.infer<
  typeof SuggestionsPanelViewModelSchema
>;
export type WorkingCockpitPanelViewModel = z.infer<
  typeof WorkingCockpitPanelViewModelSchema
>;
export type WorkingCockpitViewModel = z.infer<
  typeof WorkingCockpitViewModelSchema
>;
export type WorkingCockpitViewModelValidation = z.infer<
  typeof WorkingCockpitViewModelValidationSchema
>;

export function createDefaultWorkingCockpitViewModel(): WorkingCockpitViewModel {
  return WorkingCockpitViewModelSchema.parse({
    kind: "command_center.working_cockpit_view_model",
    phase: "9D2",
    panel_order: [...WORKING_COCKPIT_PANEL_IDS],
    panels: Object.fromEntries(
      WORKING_COCKPIT_PANEL_IDS.map((panelId) => [
        panelId,
        createDefaultPanelViewModel(panelId),
      ]),
    ),
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    interactive: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
  });
}

export function validateWorkingCockpitViewModel(
  input: unknown,
): WorkingCockpitViewModelValidation {
  const parsed = WorkingCockpitViewModelSchema.safeParse(input);
  const scan = scanViewModel(input, [], new WeakSet<object>());
  const reasons = new Set<WorkingCockpitViewModelValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const missingPanels = missingPanelIds(input);
  const mismatchedPanels = mismatchedPanelIds(input);

  if (!parsed.success) reasons.add("schema_rejected");
  if (missingPanels.length > 0) reasons.add("missing_panel");
  if (mismatchedPanels.length > 0) reasons.add("panel_id_mismatch");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.authorityKeys.length > 0) reasons.add("authority_key_present");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.authorityKeys) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return WorkingCockpitViewModelValidationSchema.parse({
    passed,
    reasons: passed ? ["working_cockpit_view_model_valid"] : [...reasons],
    missing_panels: missingPanels,
    mismatched_panels: mismatchedPanels,
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0
        ? [...notes]
        : ["working_cockpit_view_model_metadata_only"],
    metadata_only: true,
    redaction_required: true,
    render_safe: passed,
    interactive: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function deriveWorkingCockpitViewModelFromObservabilityResponses(
  responses: unknown,
): WorkingCockpitViewModel {
  const byCategory = readSafeResponsesByCategory(responses);
  return WorkingCockpitViewModelSchema.parse({
    ...createDefaultWorkingCockpitViewModel(),
    panels: Object.fromEntries(
      WORKING_COCKPIT_PANEL_IDS.map((panelId) => [
        panelId,
        createPanelViewModelFromResponse(panelId, byCategory.get(panelId)),
      ]),
    ),
  });
}

function createDefaultPanelViewModel(
  panelId: WorkingCockpitPanelId,
): WorkingCockpitPanelViewModel {
  const base = {
    kind: "command_center.working_cockpit_panel_view_model" as const,
    phase: "9D2" as const,
    panel_id: panelId,
    status_class: "unknown" as const,
    redaction_status: "metadata_only" as const,
    generated_at: 0,
    truncated: false,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
    ],
    metadata_only: true as const,
    redaction_required: true as const,
    render_safe: true as const,
    interactive: false as const,
    raw_payloads_included: false as const,
    exact_pii_included: false as const,
    authority_surface: false as const,
    callbacks_allowed: false as const,
    event_handlers_allowed: false as const,
    network_fetch_allowed: false as const,
    approval_actions_allowed: false as const,
    routine_actions_allowed: false as const,
    tool_actions_allowed: false as const,
    replay_run_actions_allowed: false as const,
    capture_actions_allowed: false as const,
    can_execute: false as const,
    can_approve: false as const,
    can_schedule: false as const,
    can_retry: false as const,
    can_mutate: false as const,
    can_call_tools: false as const,
    can_capture: false as const,
    can_fetch: false as const,
    can_route: false as const,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  };
  const countBins = {
    none: "none",
    low: "none",
    medium: "none",
    high: "none",
  } as const;
  const summaryBins = {
    primary: "none",
    secondary: "none",
  } as const;

  if (panelId === "router") {
    return RouterPanelViewModelSchema.parse({
      ...base,
      panel_id: "router",
      count_bins: countBins,
      latency_band: "unknown",
    });
  }
  if (panelId === "tool_calls") {
    return ToolCallsPanelViewModelSchema.parse({
      ...base,
      panel_id: "tool_calls",
      count_bins: countBins,
      latency_band: "unknown",
    });
  }
  if (panelId === "approvals") {
    return ApprovalsPanelViewModelSchema.parse({
      ...base,
      panel_id: "approvals",
      count_bins: countBins,
      state_class: "unknown",
    });
  }
  if (panelId === "costs") {
    return CostsPanelViewModelSchema.parse({
      ...base,
      panel_id: "costs",
      cost_bin: "unknown",
      summary_bins: summaryBins,
    });
  }
  if (panelId === "safety") {
    return SafetyPanelViewModelSchema.parse({
      ...base,
      panel_id: "safety",
      count_bins: countBins,
      state_class: "unknown",
    });
  }
  if (panelId === "vision") {
    return VisionPanelViewModelSchema.parse({
      ...base,
      panel_id: "vision",
      confidence_band: "unknown",
      latency_band: "unknown",
      degraded_state_class: "unknown",
    });
  }
  if (panelId === "environment") {
    return EnvironmentPanelViewModelSchema.parse({
      ...base,
      panel_id: "environment",
      summary_bins: summaryBins,
      state_class: "unknown",
    });
  }
  if (panelId === "projects") {
    return ProjectsPanelViewModelSchema.parse({
      ...base,
      panel_id: "projects",
      count_bins: countBins,
      state_class: "unknown",
    });
  }
  if (panelId === "routines") {
    return RoutinesPanelViewModelSchema.parse({
      ...base,
      panel_id: "routines",
      count_bins: countBins,
      state_class: "unknown",
    });
  }
  return SuggestionsPanelViewModelSchema.parse({
    ...base,
    panel_id: "suggestions",
    count_bins: countBins,
    confidence_band: "unknown",
  });
}

function createPanelViewModelFromResponse(
  panelId: WorkingCockpitPanelId,
  response: CommandCenterObservabilityResponseEnvelope | undefined,
): WorkingCockpitPanelViewModel {
  if (!response) return createDefaultPanelViewModel(panelId);

  const defaultPanel = createDefaultPanelViewModel(panelId);
  const statusClass = statusClassFromResponse(response);
  const countBand = countBandFromResponse(response);
  const common = {
    ...defaultPanel,
    status_class: statusClass,
    redaction_status: response.redaction_status,
    generated_at: response.generated_at,
    truncated: response.truncated,
    withheld_fields: response.withheld_fields,
  };

  if (panelId === "router") {
    return RouterPanelViewModelSchema.parse({
      ...common,
      panel_id: "router",
      count_bins: countBinsFromBand(countBand),
      latency_band: latencyBandFromResponse(response),
    });
  }
  if (panelId === "tool_calls") {
    return ToolCallsPanelViewModelSchema.parse({
      ...common,
      panel_id: "tool_calls",
      count_bins: countBinsFromBand(countBand),
      latency_band: latencyBandFromResponse(response),
    });
  }
  if (panelId === "approvals") {
    return ApprovalsPanelViewModelSchema.parse({
      ...common,
      panel_id: "approvals",
      count_bins: countBinsFromBand(countBand),
      state_class: stateClassFromResponse(response),
    });
  }
  if (panelId === "costs") {
    return CostsPanelViewModelSchema.parse({
      ...common,
      panel_id: "costs",
      cost_bin: costBinFromResponse(response),
      summary_bins: summaryBinsFromBand(countBand),
    });
  }
  if (panelId === "safety") {
    return SafetyPanelViewModelSchema.parse({
      ...common,
      panel_id: "safety",
      count_bins: countBinsFromBand(countBand),
      state_class: stateClassFromResponse(response),
    });
  }
  if (panelId === "vision") {
    return VisionPanelViewModelSchema.parse({
      ...common,
      panel_id: "vision",
      confidence_band: confidenceBandFromResponse(response),
      latency_band: latencyBandFromResponse(response),
      degraded_state_class: stateClassFromResponse(response),
    });
  }
  if (panelId === "environment") {
    return EnvironmentPanelViewModelSchema.parse({
      ...common,
      panel_id: "environment",
      summary_bins: summaryBinsFromBand(countBand),
      state_class: stateClassFromResponse(response),
    });
  }
  if (panelId === "projects") {
    return ProjectsPanelViewModelSchema.parse({
      ...common,
      panel_id: "projects",
      count_bins: countBinsFromBand(countBand),
      state_class: stateClassFromResponse(response),
    });
  }
  if (panelId === "routines") {
    return RoutinesPanelViewModelSchema.parse({
      ...common,
      panel_id: "routines",
      count_bins: countBinsFromBand(countBand),
      state_class: stateClassFromResponse(response),
    });
  }
  return SuggestionsPanelViewModelSchema.parse({
    ...common,
    panel_id: "suggestions",
    count_bins: countBinsFromBand(countBand),
    confidence_band: confidenceBandFromResponse(response),
  });
}

function readSafeResponsesByCategory(
  responses: unknown,
): Map<WorkingCockpitPanelId, CommandCenterObservabilityResponseEnvelope> {
  const candidates = Array.isArray(responses)
    ? responses
    : responses && typeof responses === "object"
      ? Object.values(responses)
      : [];
  const map = new Map<
    WorkingCockpitPanelId,
    CommandCenterObservabilityResponseEnvelope
  >();

  for (const candidate of candidates) {
    const parsed =
      CommandCenterObservabilityResponseEnvelopeSchema.safeParse(candidate);
    if (!parsed.success) continue;
    if (!isWorkingPanelCategory(parsed.data.category)) continue;
    if (!parsed.data.render_safe || parsed.data.raw_payloads_included) continue;
    if (!validateObservabilityPayloadSafety(parsed.data).passed) continue;
    map.set(parsed.data.category, parsed.data);
  }
  return map;
}

function statusClassFromResponse(
  response: CommandCenterObservabilityResponseEnvelope,
): WorkingCockpitStatusClass {
  const payloadStatus = response.payload[0]?.status;
  if (payloadStatus === "active") return "active";
  if (payloadStatus === "idle") return "idle";
  if (payloadStatus === "degraded") return "degraded";
  if (payloadStatus === "blocked") return "blocked";
  if (payloadStatus === "error") return "error";
  if (response.render_safe && response.payload.length > 0) return "nominal";
  return "unknown";
}

function countBandFromResponse(
  response: CommandCenterObservabilityResponseEnvelope,
): WorkingCockpitCountBand {
  return normalizeCountBand(response.payload[0]?.count_band);
}

function latencyBandFromResponse(
  response: CommandCenterObservabilityResponseEnvelope,
): WorkingCockpitLatencyBand {
  return normalizeLatencyBand(readFirstPayloadString(response, "latency_band"));
}

function confidenceBandFromResponse(
  response: CommandCenterObservabilityResponseEnvelope,
): WorkingCockpitConfidenceBand {
  return normalizeConfidenceBand(
    readFirstPayloadString(response, "confidence_band"),
  );
}

function costBinFromResponse(
  response: CommandCenterObservabilityResponseEnvelope,
): WorkingCockpitCostBin {
  return normalizeCostBin(readFirstPayloadString(response, "cost_bin"));
}

function stateClassFromResponse(
  response: CommandCenterObservabilityResponseEnvelope,
): WorkingCockpitStateClass {
  const statusClass = statusClassFromResponse(response);
  if (statusClass === "blocked") return "blocked";
  if (statusClass === "degraded" || statusClass === "error") return "degraded";
  if (statusClass === "nominal" || statusClass === "active") return "nominal";
  return "unknown";
}

function readFirstPayloadString(
  response: CommandCenterObservabilityResponseEnvelope,
  key: string,
): string | undefined {
  const first = response.payload[0] as Record<string, unknown> | undefined;
  return typeof first?.[key] === "string" ? first[key] : undefined;
}

function countBinsFromBand(
  band: WorkingCockpitCountBand,
): z.infer<typeof CountBinsSchema> {
  return {
    none: band === "none" ? "none" : "low",
    low: band === "low" ? "low" : "none",
    medium: band === "medium" ? "medium" : "none",
    high: band === "high" ? "high" : "none",
  };
}

function summaryBinsFromBand(
  band: WorkingCockpitCountBand,
): z.infer<typeof SummaryBinsSchema> {
  return {
    primary: band,
    secondary: band === "unknown" ? "unknown" : "none",
  };
}

function normalizeCountBand(input: unknown): WorkingCockpitCountBand {
  if (
    input === "none" ||
    input === "low" ||
    input === "medium" ||
    input === "high" ||
    input === "unknown"
  ) {
    return input;
  }
  return "unknown";
}

function normalizeLatencyBand(input: unknown): WorkingCockpitLatencyBand {
  return normalizeCountBand(input);
}

function normalizeConfidenceBand(input: unknown): WorkingCockpitConfidenceBand {
  return normalizeCountBand(input);
}

function normalizeCostBin(input: unknown): WorkingCockpitCostBin {
  return normalizeCountBand(input);
}

function missingPanelIds(input: unknown): WorkingCockpitPanelId[] {
  if (!input || typeof input !== "object")
    return [...WORKING_COCKPIT_PANEL_IDS];
  const panels = (input as { panels?: unknown }).panels;
  if (!panels || typeof panels !== "object")
    return [...WORKING_COCKPIT_PANEL_IDS];
  return WORKING_COCKPIT_PANEL_IDS.filter((panelId) => !(panelId in panels));
}

function mismatchedPanelIds(input: unknown): WorkingCockpitPanelId[] {
  if (!input || typeof input !== "object") return [];
  const panels = (input as { panels?: unknown }).panels;
  if (!panels || typeof panels !== "object") return [];
  return WORKING_COCKPIT_PANEL_IDS.filter((panelId) => {
    const panel = (panels as Record<string, unknown>)[panelId];
    return (
      panel &&
      typeof panel === "object" &&
      "panel_id" in panel &&
      (panel as { panel_id?: unknown }).panel_id !== panelId
    );
  });
}

interface ViewModelScanResult {
  rawPayloadFields: string[];
  authorityKeys: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanViewModel(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): ViewModelScanResult {
  const result: ViewModelScanResult = {
    rawPayloadFields: [],
    authorityKeys: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("view_model_missing");
    return result;
  }
  if (
    typeof input === "function" ||
    typeof input === "symbol" ||
    typeof input === "bigint"
  ) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable:${path.join(".") || "root"}`);
    return result;
  }
  if (input === null || typeof input !== "object") return result;
  if (seen.has(input)) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable_cycle:${path.join(".") || "root"}`);
    return result;
  }
  seen.add(input);
  if (input instanceof Date) return result;
  if (
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    result.unsafeShape = true;
    result.notes.push(`unsafe_object:${path.join(".") || "root"}`);
    return result;
  }

  const entries = Array.isArray(input)
    ? input.map((value, index) => [String(index), value] as const)
    : Object.entries(input);
  for (const [key, value] of entries) {
    if (isForbiddenRawField(key)) {
      result.rawPayloadFields.push([...path, key].join("."));
    }
    if (isAuthorityKey(key, value)) {
      result.authorityKeys.push([...path, key].join("."));
    }
    const child = scanViewModel(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.authorityKeys.push(...child.authorityKeys);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }

  return result;
}

function isForbiddenRawField(key: string): boolean {
  return (
    COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
  ).includes(key);
}

function isAuthorityKey(key: string, value: unknown): boolean {
  if (
    key === "interactive" ||
    key === "can_execute" ||
    key === "can_approve" ||
    key === "can_schedule" ||
    key === "can_retry" ||
    key === "can_mutate" ||
    key === "can_call_tools" ||
    key === "can_capture" ||
    key === "can_fetch" ||
    key === "can_route"
  ) {
    return value !== false;
  }
  return (
    [
      ...WORKING_COCKPIT_MUTATING_AFFORDANCE_KEYS,
      ...COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
      "onClick",
      "onclick",
    ] as readonly string[]
  ).includes(key);
}

function isWorkingPanelCategory(
  category: CommandCenterObservabilityQueryCategory,
): category is WorkingCockpitPanelId {
  return listWorkingCockpitPanels().some(
    (panel) => panel.panel_id === category,
  );
}
