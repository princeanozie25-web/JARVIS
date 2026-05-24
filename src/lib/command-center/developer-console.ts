import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS,
  CommandCenterObservabilityQueryCategorySchema,
  type CommandCenterObservabilityQueryCategory,
} from "./observability-contract";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  CommandCenterObservabilityAllowedMetadataFieldClassSchema,
  type CommandCenterObservabilityAllowedMetadataFieldClass,
} from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const DEVELOPER_CONSOLE_SECTION_IDS = [
  "observability_queries",
  "adapter_registry",
  "redaction_guard_status",
  "closeout_reports",
  "disabled_feature_guards",
  "projection_health",
  "synthetic_dataset_health",
] as const;

export const DEVELOPER_CONSOLE_FORBIDDEN_AFFORDANCES = [
  ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS,
  "debug_action",
  "on_debug",
  "inspect_source",
  "render_source_code",
  "open_remote_dashboard",
  "export",
  "export_json",
  "export_unredacted_payload",
  "write",
  "write_file",
  "patch",
  "mutate_registry",
] as const;

export const DEVELOPER_CONSOLE_DESCRIPTOR_VALIDATION_REASONS = [
  "developer_console_descriptor_valid",
  "schema_rejected",
  "non_dev_exposure",
  "recruiter_view_visible",
  "demo_presentation_visible",
  "metadata_or_redaction_bypassed",
  "remote_access_enabled",
  "writes_enabled",
  "export_enabled",
  "render_not_safe",
  "not_non_executable",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;

export const DEVELOPER_CONSOLE_SECTION_VALIDATION_REASONS = [
  "developer_console_section_valid",
  "schema_rejected",
  "unknown_section",
  "duplicate_section",
  "missing_section",
  "interactive_section",
  "metadata_or_redaction_bypassed",
  "raw_payload_field_declared",
  "mutating_affordance_declared",
  "priority_order_not_deterministic",
] as const;

export const DeveloperConsoleSectionIdSchema = z.enum(
  DEVELOPER_CONSOLE_SECTION_IDS,
);
export const DeveloperConsoleForbiddenAffordanceSchema = z.enum(
  DEVELOPER_CONSOLE_FORBIDDEN_AFFORDANCES,
);
export const DeveloperConsoleDescriptorValidationReasonSchema = z.enum(
  DEVELOPER_CONSOLE_DESCRIPTOR_VALIDATION_REASONS,
);
export const DeveloperConsoleSectionValidationReasonSchema = z.enum(
  DEVELOPER_CONSOLE_SECTION_VALIDATION_REASONS,
);

export const DeveloperConsoleDescriptorSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.developer_console_descriptor"),
    phase: z.literal("9J1"),
    console_id: z.string().trim().min(1).max(160),
    enabled_in_dev_only: z.literal(true),
    hidden_in_recruiter_view: z.literal(true),
    hidden_in_demo_presentation: z.literal(true),
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
    render_safe: z.literal(true),
    non_executable: z.literal(true),
    remote_access_allowed: z.literal(false),
    writes_allowed: z.literal(false),
    export_allowed: z.literal(false),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    interactive: z.literal(false),
    debug_actions_allowed: z.literal(false),
    live_db_reads_allowed: z.literal(false),
    telemetry_reads_allowed: z.literal(false),
    source_code_rendering_allowed: z.literal(false),
  });

export const DeveloperConsoleSectionDescriptorSchema = z.strictObject({
  kind: z.literal("command_center.developer_console_section_descriptor"),
  phase: z.literal("9J1"),
  section_id: DeveloperConsoleSectionIdSchema,
  source_category: CommandCenterObservabilityQueryCategorySchema.optional(),
  display_priority: z
    .number()
    .int()
    .min(1)
    .max(DEVELOPER_CONSOLE_SECTION_IDS.length),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.literal(true),
  interactive: z.literal(false),
  allowed_field_classes: z.array(
    CommandCenterObservabilityAllowedMetadataFieldClassSchema,
  ),
  forbidden_affordances: z.array(DeveloperConsoleForbiddenAffordanceSchema),
  raw_payload_fields_allowed: z.literal(false),
  mutating_affordances_allowed: z.literal(false),
  export_allowed: z.literal(false),
  debug_actions_allowed: z.literal(false),
  source_reads_wired: z.literal(false),
  db_access_wired: z.literal(false),
  telemetry_access_wired: z.literal(false),
  live_stream_wired: z.literal(false),
});

export const DeveloperConsoleSectionRegistrySchema = z.strictObject({
  kind: z.literal("command_center.developer_console_section_registry"),
  phase: z.literal("9J1"),
  sections: z.array(DeveloperConsoleSectionDescriptorSchema),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.literal(true),
  interactive: z.literal(false),
  descriptor_only: z.literal(true),
});

export const DeveloperConsoleDescriptorValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(DeveloperConsoleDescriptorValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    redaction_required: z.boolean(),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    enabled_in_dev_only: z.boolean(),
    hidden_in_recruiter_view: z.boolean(),
    hidden_in_demo_presentation: z.boolean(),
    remote_access_allowed: z.boolean(),
    writes_allowed: z.boolean(),
    export_allowed: z.boolean(),
    mutated_input: z.literal(false),
  });

export const DeveloperConsoleSectionValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(DeveloperConsoleSectionValidationReasonSchema),
  section_id: DeveloperConsoleSectionIdSchema.nullable(),
  metadata_only: z.boolean(),
  redaction_required: z.boolean(),
  render_safe: z.boolean(),
  interactive: z.boolean(),
  descriptor_only: z.literal(true),
  source_reads_wired: z.literal(false),
  db_access_wired: z.literal(false),
  telemetry_access_wired: z.literal(false),
  live_stream_wired: z.literal(false),
});

export const DeveloperConsoleSectionRegistryValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(DeveloperConsoleSectionValidationReasonSchema),
  section_count: z.number().int().nonnegative(),
  missing_section_ids: z.array(DeveloperConsoleSectionIdSchema),
  duplicate_section_ids: z.array(DeveloperConsoleSectionIdSchema),
  invalid_section_ids: z.array(DeveloperConsoleSectionIdSchema),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.literal(true),
  interactive: z.literal(false),
  descriptor_only: z.literal(true),
});

export type DeveloperConsoleSectionId = z.infer<
  typeof DeveloperConsoleSectionIdSchema
>;
export type DeveloperConsoleForbiddenAffordance = z.infer<
  typeof DeveloperConsoleForbiddenAffordanceSchema
>;
export type DeveloperConsoleDescriptorValidationReason = z.infer<
  typeof DeveloperConsoleDescriptorValidationReasonSchema
>;
export type DeveloperConsoleSectionValidationReason = z.infer<
  typeof DeveloperConsoleSectionValidationReasonSchema
>;
export type DeveloperConsoleDescriptor = z.infer<
  typeof DeveloperConsoleDescriptorSchema
>;
export type DeveloperConsoleSectionDescriptor = z.infer<
  typeof DeveloperConsoleSectionDescriptorSchema
>;
export type DeveloperConsoleSectionRegistry = z.infer<
  typeof DeveloperConsoleSectionRegistrySchema
>;
export type DeveloperConsoleDescriptorValidation = z.infer<
  typeof DeveloperConsoleDescriptorValidationSchema
>;
export type DeveloperConsoleSectionValidation = z.infer<
  typeof DeveloperConsoleSectionValidationSchema
>;
export type DeveloperConsoleSectionRegistryValidation = z.infer<
  typeof DeveloperConsoleSectionRegistryValidationSchema
>;

export function createDefaultDeveloperConsoleDescriptor(): DeveloperConsoleDescriptor {
  return DeveloperConsoleDescriptorSchema.parse({
    kind: "command_center.developer_console_descriptor",
    phase: "9J1",
    console_id: "developer_console:metadata_only",
    enabled_in_dev_only: true,
    hidden_in_recruiter_view: true,
    hidden_in_demo_presentation: true,
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    non_executable: true,
    remote_access_allowed: false,
    writes_allowed: false,
    export_allowed: false,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
    ],
    truncated: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    interactive: false,
    debug_actions_allowed: false,
    live_db_reads_allowed: false,
    telemetry_reads_allowed: false,
    source_code_rendering_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function createDefaultDeveloperConsoleSections(): DeveloperConsoleSectionDescriptor[] {
  return DEVELOPER_CONSOLE_SECTION_IDS.map((sectionId, index) =>
    createDeveloperConsoleSectionDescriptor(sectionId, index + 1),
  );
}

export function validateDeveloperConsoleDescriptor(
  input: unknown,
): DeveloperConsoleDescriptorValidation {
  const parsed = DeveloperConsoleDescriptorSchema.safeParse(input);
  const scan = scanConsoleDescriptor(input, [], new WeakSet<object>());
  const reasons = new Set<DeveloperConsoleDescriptorValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (readBooleanField(input, "enabled_in_dev_only") !== true)
    reasons.add("non_dev_exposure");
  if (readBooleanField(input, "hidden_in_recruiter_view") !== true)
    reasons.add("recruiter_view_visible");
  if (readBooleanField(input, "hidden_in_demo_presentation") !== true)
    reasons.add("demo_presentation_visible");
  if (
    readBooleanField(input, "metadata_only") !== true ||
    readBooleanField(input, "redaction_required") !== true
  ) {
    reasons.add("metadata_or_redaction_bypassed");
  }
  if (readBooleanField(input, "remote_access_allowed") !== false)
    reasons.add("remote_access_enabled");
  if (readBooleanField(input, "writes_allowed") !== false)
    reasons.add("writes_enabled");
  if (readBooleanField(input, "export_allowed") !== false)
    reasons.add("export_enabled");
  if (readBooleanField(input, "render_safe") !== true)
    reasons.add("render_not_safe");
  if (readBooleanField(input, "non_executable") !== true)
    reasons.add("not_non_executable");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.executableFields.length > 0)
    reasons.add("executable_affordance_present");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return DeveloperConsoleDescriptorValidationSchema.parse({
    passed,
    reasons: passed ? ["developer_console_descriptor_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["developer_console_dev_only"],
    metadata_only: true,
    redaction_required: readBooleanField(input, "redaction_required") === true,
    render_safe: passed,
    non_executable: passed,
    enabled_in_dev_only:
      readBooleanField(input, "enabled_in_dev_only") === true,
    hidden_in_recruiter_view:
      readBooleanField(input, "hidden_in_recruiter_view") === true,
    hidden_in_demo_presentation:
      readBooleanField(input, "hidden_in_demo_presentation") === true,
    remote_access_allowed:
      readBooleanField(input, "remote_access_allowed") === true,
    writes_allowed: readBooleanField(input, "writes_allowed") === true,
    export_allowed: readBooleanField(input, "export_allowed") === true,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateDeveloperConsoleSectionDescriptor(
  input: unknown,
): DeveloperConsoleSectionValidation {
  const parsed = DeveloperConsoleSectionDescriptorSchema.safeParse(input);
  const partial = readPartialSection(input);
  const reasons = new Set<DeveloperConsoleSectionValidationReason>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (partial.section_id === null) reasons.add("unknown_section");
  if (partial.interactive !== false) reasons.add("interactive_section");
  if (
    partial.metadata_only !== true ||
    partial.redaction_required !== true ||
    partial.render_safe !== true
  ) {
    reasons.add("metadata_or_redaction_bypassed");
  }
  if (declaresRawPayloadFieldClass(input)) {
    reasons.add("raw_payload_field_declared");
  }
  if (declaresMutatingAffordance(input)) {
    reasons.add("mutating_affordance_declared");
  }

  return DeveloperConsoleSectionValidationSchema.parse({
    passed: reasons.size === 0,
    reasons:
      reasons.size === 0 ? ["developer_console_section_valid"] : [...reasons],
    section_id: partial.section_id,
    metadata_only: partial.metadata_only === true,
    redaction_required: partial.redaction_required === true,
    render_safe: partial.render_safe === true,
    interactive: partial.interactive === true,
    descriptor_only: true,
    source_reads_wired: false,
    db_access_wired: false,
    telemetry_access_wired: false,
    live_stream_wired: false,
  });
}

export function validateDeveloperConsoleSectionRegistry(
  input: unknown = createDefaultDeveloperConsoleSections(),
): DeveloperConsoleSectionRegistryValidation {
  const sections = readSections(input);
  const parsed = Array.isArray(input)
    ? z.array(DeveloperConsoleSectionDescriptorSchema).safeParse(input)
    : DeveloperConsoleSectionRegistrySchema.safeParse(input);
  const reasons = new Set<DeveloperConsoleSectionValidationReason>();
  const seen = new Set<DeveloperConsoleSectionId>();
  const duplicates = new Set<DeveloperConsoleSectionId>();
  const invalid = new Set<DeveloperConsoleSectionId>();

  if (!parsed.success) reasons.add("schema_rejected");
  for (const section of sections) {
    const validation = validateDeveloperConsoleSectionDescriptor(section);
    if (!validation.passed) {
      validation.reasons.forEach((reason) => {
        if (reason !== "developer_console_section_valid") reasons.add(reason);
      });
      if (validation.section_id !== null) invalid.add(validation.section_id);
    }
    if (validation.section_id !== null) {
      if (seen.has(validation.section_id)) {
        duplicates.add(validation.section_id);
        reasons.add("duplicate_section");
      }
      seen.add(validation.section_id);
    }
  }
  const missing = DEVELOPER_CONSOLE_SECTION_IDS.filter(
    (sectionId) => !seen.has(sectionId),
  );
  if (missing.length > 0) reasons.add("missing_section");
  if (!hasDeterministicSectionOrder(sections)) {
    reasons.add("priority_order_not_deterministic");
  }

  return DeveloperConsoleSectionRegistryValidationSchema.parse({
    passed: reasons.size === 0,
    reasons:
      reasons.size === 0 ? ["developer_console_section_valid"] : [...reasons],
    section_count: sections.length,
    missing_section_ids: missing,
    duplicate_section_ids: [...duplicates],
    invalid_section_ids: [...invalid],
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    interactive: false,
    descriptor_only: true,
  });
}

function createDeveloperConsoleSectionDescriptor(
  sectionId: DeveloperConsoleSectionId,
  displayPriority: number,
): DeveloperConsoleSectionDescriptor {
  return DeveloperConsoleSectionDescriptorSchema.parse({
    kind: "command_center.developer_console_section_descriptor",
    phase: "9J1",
    section_id: sectionId,
    source_category: sourceCategoryForSection(sectionId),
    display_priority: displayPriority,
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    interactive: false,
    allowed_field_classes: allowedFieldClassesForSection(sectionId),
    forbidden_affordances: [...DEVELOPER_CONSOLE_FORBIDDEN_AFFORDANCES],
    raw_payload_fields_allowed: false,
    mutating_affordances_allowed: false,
    export_allowed: false,
    debug_actions_allowed: false,
    source_reads_wired: false,
    db_access_wired: false,
    telemetry_access_wired: false,
    live_stream_wired: false,
  });
}

function sourceCategoryForSection(
  sectionId: DeveloperConsoleSectionId,
): CommandCenterObservabilityQueryCategory | undefined {
  const map: Partial<
    Record<DeveloperConsoleSectionId, CommandCenterObservabilityQueryCategory>
  > = {
    observability_queries: "traces",
    adapter_registry: "runtime_dependencies",
    redaction_guard_status: "safety",
    projection_health: "runtime_dependencies",
    synthetic_dataset_health: "suggestions",
  };
  return map[sectionId];
}

function allowedFieldClassesForSection(
  sectionId: DeveloperConsoleSectionId,
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
  if (sectionId === "adapter_registry") return [...common, "capability_ids"];
  if (sectionId === "projection_health") {
    return [...common, "binned_counts", "latency_bands"];
  }
  if (sectionId === "synthetic_dataset_health") {
    return [...common, "confidence_bands"];
  }
  return [...common, "binned_counts"];
}

interface ConsoleDescriptorScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanConsoleDescriptor(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): ConsoleDescriptorScanResult {
  const result: ConsoleDescriptorScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };
  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("developer_console_missing");
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
    if (isForbiddenRawPayloadField(key)) {
      result.rawPayloadFields.push([...path, key].join("."));
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanConsoleDescriptor(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function readPartialSection(input: unknown): {
  section_id: DeveloperConsoleSectionId | null;
  metadata_only?: unknown;
  redaction_required?: unknown;
  render_safe?: unknown;
  interactive?: unknown;
} {
  if (!input || typeof input !== "object") return { section_id: null };
  const record = input as Record<string, unknown>;
  const sectionId = DeveloperConsoleSectionIdSchema.safeParse(
    record.section_id,
  );
  return {
    section_id: sectionId.success ? sectionId.data : null,
    metadata_only: record.metadata_only,
    redaction_required: record.redaction_required,
    render_safe: record.render_safe,
    interactive: record.interactive,
  };
}

function readSections(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return [];
  const sections = (input as { sections?: unknown }).sections;
  return Array.isArray(sections) ? sections : [];
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

function declaresMutatingAffordance(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  if (Array.isArray(input)) return input.some(declaresMutatingAffordance);
  for (const [key, value] of Object.entries(input)) {
    if (key === "forbidden_affordances") {
      if (!hasAllForbiddenAffordances(value)) return true;
      continue;
    }
    if (isExecutableAffordanceKey(key, value)) return true;
    if (declaresMutatingAffordance(value)) return true;
  }
  return false;
}

function hasAllForbiddenAffordances(input: unknown): boolean {
  if (!Array.isArray(input)) return false;
  return DEVELOPER_CONSOLE_FORBIDDEN_AFFORDANCES.every((affordance) =>
    input.includes(affordance),
  );
}

function hasDeterministicSectionOrder(sections: unknown[]): boolean {
  const parsedSections = sections
    .map((section) =>
      DeveloperConsoleSectionDescriptorSchema.safeParse(section),
    )
    .filter((result) => result.success)
    .map((result) => result.data);
  if (parsedSections.length !== sections.length) return false;
  return parsedSections.every(
    (section, index) =>
      section.display_priority === index + 1 &&
      section.section_id === DEVELOPER_CONSOLE_SECTION_IDS[index],
  );
}

function isForbiddenRawPayloadField(key: string): boolean {
  return (
    COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
  ).includes(key);
}

function isExecutableAffordanceKey(key: string, value: unknown): boolean {
  if (
    key === "run_affordance_allowed" ||
    key === "retry_affordance_allowed" ||
    key === "approve_affordance_allowed" ||
    key === "execute_affordance_allowed" ||
    key === "mutate_affordance_allowed" ||
    key === "graph_execution_allowed" ||
    key === "remote_access_allowed" ||
    key === "writes_allowed" ||
    key === "export_allowed" ||
    key === "debug_actions_allowed" ||
    key === "live_db_reads_allowed" ||
    key === "telemetry_reads_allowed" ||
    key === "source_code_rendering_allowed" ||
    key === "raw_payload_fields_allowed" ||
    key === "mutating_affordances_allowed" ||
    key === "source_reads_wired" ||
    key === "db_access_wired" ||
    key === "telemetry_access_wired" ||
    key === "live_stream_wired"
  ) {
    return value !== false;
  }
  return (
    [
      ...AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
      ...COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
      "approve_button",
      "retry_button",
      "run_button",
      "execute_button",
      "mutate_button",
      "graph_execute",
      "debug_action",
      "on_debug",
      "export",
      "export_json",
      "write",
      "write_file",
      "patch",
    ] as readonly string[]
  ).includes(key);
}

function readBooleanField(input: unknown, field: string): boolean | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "boolean" ? value : undefined;
}
