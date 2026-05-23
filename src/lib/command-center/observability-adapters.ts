import { z } from "zod";

import {
  COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES,
  CommandCenterObservabilityQueryCategorySchema,
  type CommandCenterObservabilityQueryCategory,
} from "./observability-contract";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES,
  CommandCenterObservabilityAllowedMetadataFieldClassSchema,
  CommandCenterObservabilityForbiddenRawFieldClassSchema,
  type CommandCenterObservabilityAllowedMetadataFieldClass,
} from "./observability-redaction";

export const COMMAND_CENTER_OBSERVABILITY_SOURCE_PHASES = [
  "phase_router",
  "phase_tools",
  "phase_approvals",
  "phase_costs",
  "phase_safety",
  "phase_vision",
  "phase_environment",
  "phase_projects",
  "phase_routines",
  "phase_suggestions",
  "phase_traces",
  "phase_governance",
  "phase_runtime_dependencies",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_ADAPTER_VALIDATION_REASONS = [
  "adapter_valid",
  "schema_rejected",
  "mutating_adapter",
  "raw_payload_field_declared",
  "hard_cap_exceeded",
  "replay_safe_not_allowed",
  "unknown_category",
  "duplicate_category",
  "missing_category",
] as const;

export const CommandCenterObservabilitySourcePhaseSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_SOURCE_PHASES,
);
export const CommandCenterObservabilityAdapterValidationReasonSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_ADAPTER_VALIDATION_REASONS,
);

export const CommandCenterObservabilitySourceAdapterDescriptorSchema =
  z.strictObject({
    kind: z.literal("command_center.observability_source_adapter_descriptor"),
    adapter_id: z.string().trim().min(1).max(120),
    category: CommandCenterObservabilityQueryCategorySchema,
    source_phase: CommandCenterObservabilitySourcePhaseSchema,
    read_only: z.literal(true),
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
    max_items_default: z.number().int().min(1).max(100),
    max_items_hard_cap: z.number().int().min(1).max(100),
    allowed_field_classes: z.array(
      CommandCenterObservabilityAllowedMetadataFieldClassSchema,
    ),
    forbidden_field_classes: z.array(
      CommandCenterObservabilityForbiddenRawFieldClassSchema,
    ),
    supports_replay_safe: z.boolean(),
    descriptor_only: z.literal(true),
    source_reads_wired: z.literal(false),
    db_read_performed: z.literal(false),
    telemetry_read_performed: z.literal(false),
    live_stream_wired: z.literal(false),
    can_mutate: z.literal(false),
    can_execute: z.literal(false),
    can_collect_new_data: z.literal(false),
  });

export const CommandCenterObservabilitySourceAdapterRegistrySchema =
  z.strictObject({
    kind: z.literal("command_center.observability_source_adapter_registry"),
    adapters: z.array(CommandCenterObservabilitySourceAdapterDescriptorSchema),
    descriptor_only: z.literal(true),
    read_only: z.literal(true),
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
  });

export const CommandCenterObservabilityAdapterValidationSchema = z.strictObject(
  {
    passed: z.boolean(),
    reasons: z.array(CommandCenterObservabilityAdapterValidationReasonSchema),
    category: CommandCenterObservabilityQueryCategorySchema.nullable(),
    adapter_id: z.string().trim().min(1).max(120).nullable(),
    read_only: z.boolean(),
    metadata_only: z.boolean(),
    redaction_required: z.boolean(),
    descriptor_only: z.literal(true),
    source_reads_wired: z.literal(false),
    db_read_performed: z.literal(false),
    telemetry_read_performed: z.literal(false),
    live_stream_wired: z.literal(false),
    can_mutate: z.literal(false),
    can_execute: z.literal(false),
    can_collect_new_data: z.literal(false),
  },
);

export const CommandCenterObservabilityAdapterRegistryValidationSchema =
  z.strictObject({
    passed: z.boolean(),
    reasons: z.array(CommandCenterObservabilityAdapterValidationReasonSchema),
    adapter_count: z.number().int().nonnegative(),
    missing_categories: z.array(CommandCenterObservabilityQueryCategorySchema),
    duplicate_categories: z.array(
      CommandCenterObservabilityQueryCategorySchema,
    ),
    invalid_categories: z.array(CommandCenterObservabilityQueryCategorySchema),
    descriptor_only: z.literal(true),
    read_only: z.literal(true),
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
    source_reads_wired: z.literal(false),
    db_read_performed: z.literal(false),
    telemetry_read_performed: z.literal(false),
    live_stream_wired: z.literal(false),
    can_mutate: z.literal(false),
    can_execute: z.literal(false),
    can_collect_new_data: z.literal(false),
  });

export const CommandCenterObservabilityAdapterLookupSchema = z.strictObject({
  found: z.boolean(),
  category: CommandCenterObservabilityQueryCategorySchema.nullable(),
  adapter: CommandCenterObservabilitySourceAdapterDescriptorSchema.nullable(),
  reason: CommandCenterObservabilityAdapterValidationReasonSchema,
  descriptor_only: z.literal(true),
  source_reads_wired: z.literal(false),
});

export type CommandCenterObservabilitySourcePhase = z.infer<
  typeof CommandCenterObservabilitySourcePhaseSchema
>;
export type CommandCenterObservabilityAdapterValidationReason = z.infer<
  typeof CommandCenterObservabilityAdapterValidationReasonSchema
>;
export type CommandCenterObservabilitySourceAdapterDescriptor = z.infer<
  typeof CommandCenterObservabilitySourceAdapterDescriptorSchema
>;
export type CommandCenterObservabilitySourceAdapterRegistry = z.infer<
  typeof CommandCenterObservabilitySourceAdapterRegistrySchema
>;
export type CommandCenterObservabilityAdapterValidation = z.infer<
  typeof CommandCenterObservabilityAdapterValidationSchema
>;
export type CommandCenterObservabilityAdapterRegistryValidation = z.infer<
  typeof CommandCenterObservabilityAdapterRegistryValidationSchema
>;
export type CommandCenterObservabilityAdapterLookup = z.infer<
  typeof CommandCenterObservabilityAdapterLookupSchema
>;

export const DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY: CommandCenterObservabilitySourceAdapterRegistry =
  CommandCenterObservabilitySourceAdapterRegistrySchema.parse({
    kind: "command_center.observability_source_adapter_registry",
    adapters: COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES.map((category) =>
      createAdapterDescriptor(category),
    ),
    descriptor_only: true,
    read_only: true,
    metadata_only: true,
    redaction_required: true,
  });

export function listCommandCenterObservabilitySourceAdapters(
  registry: CommandCenterObservabilitySourceAdapterRegistry = DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
): CommandCenterObservabilitySourceAdapterDescriptor[] {
  return [
    ...CommandCenterObservabilitySourceAdapterRegistrySchema.parse(registry)
      .adapters,
  ];
}

export function findCommandCenterObservabilitySourceAdapterByCategory(
  categoryInput: unknown,
  registry: CommandCenterObservabilitySourceAdapterRegistry = DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
): CommandCenterObservabilityAdapterLookup {
  const category =
    CommandCenterObservabilityQueryCategorySchema.safeParse(categoryInput);
  if (!category.success) {
    return CommandCenterObservabilityAdapterLookupSchema.parse({
      found: false,
      category: null,
      adapter: null,
      reason: "unknown_category",
      descriptor_only: true,
      source_reads_wired: false,
    });
  }

  const adapter = CommandCenterObservabilitySourceAdapterRegistrySchema.parse(
    registry,
  ).adapters.find((item) => item.category === category.data);

  return CommandCenterObservabilityAdapterLookupSchema.parse({
    found: adapter !== undefined,
    category: category.data,
    adapter: adapter ?? null,
    reason: adapter ? "adapter_valid" : "missing_category",
    descriptor_only: true,
    source_reads_wired: false,
  });
}

export function validateCommandCenterObservabilitySourceAdapterDescriptor(
  input: unknown,
): CommandCenterObservabilityAdapterValidation {
  const parsed =
    CommandCenterObservabilitySourceAdapterDescriptorSchema.safeParse(input);
  const partial = readPartialAdapter(input);
  const reasons = new Set<CommandCenterObservabilityAdapterValidationReason>();

  if (!parsed.success) {
    reasons.add("schema_rejected");
  }
  if (
    partial.read_only === false ||
    partial.metadata_only === false ||
    partial.redaction_required === false ||
    partial.can_mutate === true ||
    partial.can_execute === true
  ) {
    reasons.add("mutating_adapter");
  }
  if (declaresRawPayloadField(input)) {
    reasons.add("raw_payload_field_declared");
  }
  if (
    typeof partial.max_items_default === "number" &&
    typeof partial.max_items_hard_cap === "number" &&
    partial.max_items_default > partial.max_items_hard_cap
  ) {
    reasons.add("hard_cap_exceeded");
  }
  if (
    partial.supports_replay_safe === true &&
    partial.category !== null &&
    !isReplayCompatibleCategory(partial.category)
  ) {
    reasons.add("replay_safe_not_allowed");
  }

  return CommandCenterObservabilityAdapterValidationSchema.parse({
    passed: reasons.size === 0,
    reasons: reasons.size === 0 ? ["adapter_valid"] : [...reasons],
    category: partial.category,
    adapter_id: partial.adapter_id,
    read_only: partial.read_only === true,
    metadata_only: partial.metadata_only === true,
    redaction_required: partial.redaction_required === true,
    descriptor_only: true,
    source_reads_wired: false,
    db_read_performed: false,
    telemetry_read_performed: false,
    live_stream_wired: false,
    can_mutate: false,
    can_execute: false,
    can_collect_new_data: false,
  });
}

export function validateCommandCenterObservabilitySourceAdapterRegistry(
  input: unknown = DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
): CommandCenterObservabilityAdapterRegistryValidation {
  const parsed =
    CommandCenterObservabilitySourceAdapterRegistrySchema.safeParse(input);
  const adapters = readAdapters(input);
  const reasons = new Set<CommandCenterObservabilityAdapterValidationReason>();
  const seen = new Set<CommandCenterObservabilityQueryCategory>();
  const duplicates = new Set<CommandCenterObservabilityQueryCategory>();
  const invalidCategories = new Set<CommandCenterObservabilityQueryCategory>();

  if (!parsed.success) {
    reasons.add("schema_rejected");
  }

  for (const adapter of adapters) {
    const validation =
      validateCommandCenterObservabilitySourceAdapterDescriptor(adapter);
    if (!validation.passed) {
      validation.reasons.forEach((reason) => {
        if (reason !== "adapter_valid") reasons.add(reason);
      });
      if (validation.category !== null)
        invalidCategories.add(validation.category);
    }
    if (validation.category !== null) {
      if (seen.has(validation.category)) {
        duplicates.add(validation.category);
        reasons.add("duplicate_category");
      }
      seen.add(validation.category);
    }
  }

  const missing = COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES.filter(
    (category) => !seen.has(category),
  );
  if (missing.length > 0) {
    reasons.add("missing_category");
  }

  return CommandCenterObservabilityAdapterRegistryValidationSchema.parse({
    passed: reasons.size === 0,
    reasons: reasons.size === 0 ? ["adapter_valid"] : [...reasons],
    adapter_count: adapters.length,
    missing_categories: missing,
    duplicate_categories: [...duplicates],
    invalid_categories: [...invalidCategories],
    descriptor_only: true,
    read_only: true,
    metadata_only: true,
    redaction_required: true,
    source_reads_wired: false,
    db_read_performed: false,
    telemetry_read_performed: false,
    live_stream_wired: false,
    can_mutate: false,
    can_execute: false,
    can_collect_new_data: false,
  });
}

export function resolveCommandCenterObservabilityAdapterMaxItems(input: {
  adapter: CommandCenterObservabilitySourceAdapterDescriptor;
  requested_max_items?: number;
}): number {
  const adapter = CommandCenterObservabilitySourceAdapterDescriptorSchema.parse(
    input.adapter,
  );
  const requested = input.requested_max_items ?? adapter.max_items_default;
  return Math.min(Math.max(1, requested), adapter.max_items_hard_cap);
}

function createAdapterDescriptor(
  category: CommandCenterObservabilityQueryCategory,
): CommandCenterObservabilitySourceAdapterDescriptor {
  return {
    kind: "command_center.observability_source_adapter_descriptor",
    adapter_id: `command-center:${category}:adapter`,
    category,
    source_phase: sourcePhaseForCategory(category),
    read_only: true,
    metadata_only: true,
    redaction_required: true,
    max_items_default: 25,
    max_items_hard_cap: 100,
    allowed_field_classes: allowedFieldClassesForCategory(category),
    forbidden_field_classes: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
    ],
    supports_replay_safe: isReplayCompatibleCategory(category),
    descriptor_only: true,
    source_reads_wired: false,
    db_read_performed: false,
    telemetry_read_performed: false,
    live_stream_wired: false,
    can_mutate: false,
    can_execute: false,
    can_collect_new_data: false,
  };
}

function sourcePhaseForCategory(
  category: CommandCenterObservabilityQueryCategory,
): CommandCenterObservabilitySourcePhase {
  const map: Record<
    CommandCenterObservabilityQueryCategory,
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
    traces: "phase_traces",
    governance_boundaries: "phase_governance",
    runtime_dependencies: "phase_runtime_dependencies",
  };
  return map[category];
}

function allowedFieldClassesForCategory(
  category: CommandCenterObservabilityQueryCategory,
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
  if (category === "costs") return [...common, "cost_bins", "binned_counts"];
  if (category === "routines") {
    return [...common, "schedule_metadata", "routine_ids"];
  }
  if (category === "tool_calls") {
    return [...common, "capability_ids", "provider_ids"];
  }
  if (category === "vision") {
    return [...common, "confidence_bands", "latency_bands"];
  }
  if (category === "runtime_dependencies") {
    return [...common, "capability_ids", "provider_ids"];
  }
  return [...common, "binned_counts", "latency_bands"];
}

function readPartialAdapter(input: unknown): {
  adapter_id: string | null;
  category: CommandCenterObservabilityQueryCategory | null;
  read_only?: unknown;
  metadata_only?: unknown;
  redaction_required?: unknown;
  max_items_default?: unknown;
  max_items_hard_cap?: unknown;
  supports_replay_safe?: unknown;
  can_mutate?: unknown;
  can_execute?: unknown;
} {
  if (!input || typeof input !== "object") {
    return { adapter_id: null, category: null };
  }
  const record = input as Record<string, unknown>;
  const category = CommandCenterObservabilityQueryCategorySchema.safeParse(
    record.category,
  );
  return {
    adapter_id:
      typeof record.adapter_id === "string" ? record.adapter_id : null,
    category: category.success ? category.data : null,
    read_only: record.read_only,
    metadata_only: record.metadata_only,
    redaction_required: record.redaction_required,
    max_items_default: record.max_items_default,
    max_items_hard_cap: record.max_items_hard_cap,
    supports_replay_safe: record.supports_replay_safe,
    can_mutate: record.can_mutate,
    can_execute: record.can_execute,
  };
}

function declaresRawPayloadField(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  if (Array.isArray(input)) {
    return input.some((item) => declaresRawPayloadField(item));
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
    if (declaresRawPayloadField(value)) return true;
  }
  return false;
}

function readAdapters(input: unknown): unknown[] {
  if (!input || typeof input !== "object") return [];
  const adapters = (input as { adapters?: unknown }).adapters;
  return Array.isArray(adapters) ? adapters : [];
}

function isReplayCompatibleCategory(
  category: CommandCenterObservabilityQueryCategory,
): boolean {
  return (
    COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES as readonly string[]
  ).includes(category);
}
