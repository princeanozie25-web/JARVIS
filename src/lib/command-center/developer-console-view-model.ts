import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import { RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS } from "./audit-runtime-dependency";
import {
  DEVELOPER_CONSOLE_SECTION_IDS,
  DeveloperConsoleSectionIdSchema,
  createDefaultDeveloperConsoleDescriptor,
  createDefaultDeveloperConsoleSections,
  validateDeveloperConsoleDescriptor,
  validateDeveloperConsoleSectionRegistry,
  type DeveloperConsoleSectionId,
} from "./developer-console";
import { CommandCenterObservabilityRedactionStatusSchema } from "./observability-contract";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  validateObservabilityPayloadSafety,
} from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const DEVELOPER_CONSOLE_SECTION_STATUS_CLASSES = [
  "unknown",
  "empty",
  "nominal",
  "degraded",
  "blocked",
  "withheld",
] as const;
export const DEVELOPER_CONSOLE_SUMMARY_BINS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const DEVELOPER_CONSOLE_VIEW_MODEL_VALIDATION_REASONS = [
  "developer_console_view_model_valid",
  "schema_rejected",
  "missing_section",
  "duplicate_section",
  "unknown_section",
  "descriptor_flag_violation",
  "interactive_section",
  "raw_payload_field_present",
  "source_code_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;

export const PHASE_9J_DEVELOPER_CONSOLE_CLOSEOUT_GUARDS = [
  "no_non_dev_exposure",
  "no_recruiter_view_exposure",
  "no_demo_presentation_exposure",
  "no_raw_payload_rendering",
  "no_source_code_rendering",
  "no_live_db_read",
  "no_live_telemetry_read",
  "no_remote_access",
  "no_writes",
  "no_exports",
  "no_debug_actions",
  "no_approval_or_execution_affordance",
  "no_run_retry_or_rerun_affordance",
] as const;

export const PHASE_9J_DEVELOPER_CONSOLE_FORBIDDEN_CAPABILITY_FIELDS = [
  "non_dev_exposure_enabled",
  "recruiter_view_exposure_enabled",
  "demo_presentation_exposure_enabled",
  "raw_payload_rendering_enabled",
  "source_code_rendering_enabled",
  "live_db_read_enabled",
  "live_telemetry_read_enabled",
  "remote_access_enabled",
  "writes_enabled",
  "exports_enabled",
  "debug_actions_enabled",
  "approval_or_execution_affordance_enabled",
  "run_retry_or_rerun_affordance_enabled",
] as const;

export const PHASE_9J_DEVELOPER_CONSOLE_CLOSEOUT_VERDICTS = [
  "pass",
  "fail",
] as const;

export const DeveloperConsoleSectionStatusClassSchema = z.enum(
  DEVELOPER_CONSOLE_SECTION_STATUS_CLASSES,
);
export const DeveloperConsoleSummaryBinSchema = z.enum(
  DEVELOPER_CONSOLE_SUMMARY_BINS,
);
export const DeveloperConsoleViewModelValidationReasonSchema = z.enum(
  DEVELOPER_CONSOLE_VIEW_MODEL_VALIDATION_REASONS,
);
export const Phase9JDeveloperConsoleCloseoutGuardSchema = z.enum(
  PHASE_9J_DEVELOPER_CONSOLE_CLOSEOUT_GUARDS,
);
export const Phase9JDeveloperConsoleForbiddenCapabilityFieldSchema = z.enum(
  PHASE_9J_DEVELOPER_CONSOLE_FORBIDDEN_CAPABILITY_FIELDS,
);
export const Phase9JDeveloperConsoleCloseoutVerdictSchema = z.enum(
  PHASE_9J_DEVELOPER_CONSOLE_CLOSEOUT_VERDICTS,
);

export const DeveloperConsoleSectionSummaryBinsSchema = z.strictObject({
  primary: DeveloperConsoleSummaryBinSchema,
  secondary: DeveloperConsoleSummaryBinSchema,
});

export const DeveloperConsoleSectionViewModelSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.developer_console_section_view_model"),
    phase: z.literal("9J2"),
    section_id: DeveloperConsoleSectionIdSchema,
    status_class: DeveloperConsoleSectionStatusClassSchema,
    summary_bins: DeveloperConsoleSectionSummaryBinsSchema,
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    interactive: z.literal(false),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
    non_executable: z.literal(true),
    raw_payloads_included: z.literal(false),
    source_code_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    export_allowed: z.literal(false),
    debug_actions_allowed: z.literal(false),
  });

export const DeveloperConsoleViewModelSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.developer_console_view_model"),
    phase: z.literal("9J2"),
    console_id: z.string().trim().min(1).max(160),
    generated_at: z.number().int().nonnegative(),
    sections: z
      .array(DeveloperConsoleSectionViewModelSchema)
      .length(DEVELOPER_CONSOLE_SECTION_IDS.length),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
    render_safe: z.literal(true),
    non_executable: z.literal(true),
    dev_only: z.literal(true),
    hidden_in_recruiter_view: z.literal(true),
    hidden_in_demo_presentation: z.literal(true),
    remote_access_allowed: z.literal(false),
    writes_allowed: z.literal(false),
    export_allowed: z.literal(false),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    raw_payloads_included: z.literal(false),
    source_code_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
    interactive: z.literal(false),
    debug_actions_allowed: z.literal(false),
    live_db_reads_allowed: z.literal(false),
    telemetry_reads_allowed: z.literal(false),
    source_code_rendering_allowed: z.literal(false),
  });

export const DeveloperConsoleViewModelValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(DeveloperConsoleViewModelValidationReasonSchema),
    missing_section_ids: z.array(DeveloperConsoleSectionIdSchema),
    duplicate_section_ids: z.array(DeveloperConsoleSectionIdSchema),
    invalid_section_ids: z.array(DeveloperConsoleSectionIdSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    redaction_required: z.boolean(),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    dev_only: z.boolean(),
    hidden_in_recruiter_view: z.boolean(),
    hidden_in_demo_presentation: z.boolean(),
    remote_access_allowed: z.boolean(),
    writes_allowed: z.boolean(),
    export_allowed: z.boolean(),
    mutated_input: z.literal(false),
  });

export const Phase9JDeveloperConsoleGuardStateSchema = z.strictObject({
  non_dev_exposure_enabled: z.literal(false),
  recruiter_view_exposure_enabled: z.literal(false),
  demo_presentation_exposure_enabled: z.literal(false),
  raw_payload_rendering_enabled: z.literal(false),
  source_code_rendering_enabled: z.literal(false),
  live_db_read_enabled: z.literal(false),
  live_telemetry_read_enabled: z.literal(false),
  remote_access_enabled: z.literal(false),
  writes_enabled: z.literal(false),
  exports_enabled: z.literal(false),
  debug_actions_enabled: z.literal(false),
  approval_or_execution_affordance_enabled: z.literal(false),
  run_retry_or_rerun_affordance_enabled: z.literal(false),
});

export const Phase9JDeveloperConsoleCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9j_developer_console_closeout_report"),
  verdict: Phase9JDeveloperConsoleCloseoutVerdictSchema,
  checked_guards: z.array(Phase9JDeveloperConsoleCloseoutGuardSchema),
  failed_guards: z.array(Phase9JDeveloperConsoleCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal(
    "phase_9j_developer_observability_console_scaffold",
  ),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.boolean(),
  non_executable: z.literal(true),
  dev_only: z.literal(true),
  hidden_in_recruiter_view: z.literal(true),
  hidden_in_demo_presentation: z.literal(true),
  remote_access_allowed: z.literal(false),
  writes_allowed: z.literal(false),
  export_allowed: z.literal(false),
  debug_actions_allowed: z.literal(false),
  live_db_reads_allowed: z.literal(false),
  telemetry_reads_allowed: z.literal(false),
  source_code_rendering_allowed: z.literal(false),
  authority_surface: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  routine_scheduled: z.literal(false),
  routine_triggered: z.literal(false),
  memory_written: z.literal(false),
  project_written: z.literal(false),
  device_action_triggered: z.literal(false),
  cloud_fallback_triggered: z.literal(false),
  db_write_performed: z.literal(false),
  network_called: z.literal(false),
  audio_capture_started: z.literal(false),
  video_capture_started: z.literal(false),
});

export type DeveloperConsoleSectionStatusClass = z.infer<
  typeof DeveloperConsoleSectionStatusClassSchema
>;
export type DeveloperConsoleSummaryBin = z.infer<
  typeof DeveloperConsoleSummaryBinSchema
>;
export type DeveloperConsoleViewModelValidationReason = z.infer<
  typeof DeveloperConsoleViewModelValidationReasonSchema
>;
export type DeveloperConsoleSectionSummaryBins = z.infer<
  typeof DeveloperConsoleSectionSummaryBinsSchema
>;
export type DeveloperConsoleSectionViewModel = z.infer<
  typeof DeveloperConsoleSectionViewModelSchema
>;
export type DeveloperConsoleViewModel = z.infer<
  typeof DeveloperConsoleViewModelSchema
>;
export type DeveloperConsoleViewModelValidation = z.infer<
  typeof DeveloperConsoleViewModelValidationSchema
>;
export type Phase9JDeveloperConsoleCloseoutGuard = z.infer<
  typeof Phase9JDeveloperConsoleCloseoutGuardSchema
>;
export type Phase9JDeveloperConsoleForbiddenCapabilityField = z.infer<
  typeof Phase9JDeveloperConsoleForbiddenCapabilityFieldSchema
>;
export type Phase9JDeveloperConsoleCloseoutVerdict = z.infer<
  typeof Phase9JDeveloperConsoleCloseoutVerdictSchema
>;
export type Phase9JDeveloperConsoleGuardState = z.infer<
  typeof Phase9JDeveloperConsoleGuardStateSchema
>;
export type Phase9JDeveloperConsoleCloseoutReport = z.infer<
  typeof Phase9JDeveloperConsoleCloseoutReportSchema
>;

export interface Phase9JDeveloperConsoleCloseoutInput {
  descriptor?: unknown;
  sections?: unknown;
  viewModel?: unknown;
  unsafeMetadata?: unknown;
  guardState?: unknown;
}

export const DEFAULT_PHASE_9J_DEVELOPER_CONSOLE_GUARD_STATE: Phase9JDeveloperConsoleGuardState =
  Phase9JDeveloperConsoleGuardStateSchema.parse({
    non_dev_exposure_enabled: false,
    recruiter_view_exposure_enabled: false,
    demo_presentation_exposure_enabled: false,
    raw_payload_rendering_enabled: false,
    source_code_rendering_enabled: false,
    live_db_read_enabled: false,
    live_telemetry_read_enabled: false,
    remote_access_enabled: false,
    writes_enabled: false,
    exports_enabled: false,
    debug_actions_enabled: false,
    approval_or_execution_affordance_enabled: false,
    run_retry_or_rerun_affordance_enabled: false,
  });

export function createDefaultDeveloperConsoleViewModel(): DeveloperConsoleViewModel {
  const descriptor = createDefaultDeveloperConsoleDescriptor();
  return DeveloperConsoleViewModelSchema.parse({
    kind: "command_center.developer_console_view_model",
    phase: "9J2",
    console_id: descriptor.console_id,
    generated_at: 0,
    sections: createDefaultDeveloperConsoleSections().map((section) =>
      createSectionViewModel(section.section_id),
    ),
    redaction_status: "metadata_only",
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    non_executable: true,
    dev_only: true,
    hidden_in_recruiter_view: descriptor.hidden_in_recruiter_view,
    hidden_in_demo_presentation: descriptor.hidden_in_demo_presentation,
    remote_access_allowed: false,
    writes_allowed: false,
    export_allowed: false,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
    ],
    truncated: false,
    raw_payloads_included: false,
    source_code_included: false,
    exact_pii_included: false,
    authority_surface: false,
    interactive: false,
    debug_actions_allowed: false,
    live_db_reads_allowed: false,
    telemetry_reads_allowed: false,
    source_code_rendering_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateDeveloperConsoleViewModel(
  input: unknown,
): DeveloperConsoleViewModelValidation {
  const parsed = DeveloperConsoleViewModelSchema.safeParse(input);
  const scan = scanDeveloperConsoleViewModel(input, [], new WeakSet<object>());
  const reasons = new Set<DeveloperConsoleViewModelValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const sections = readSections(input);
  const sectionInventory = sectionInventoryFor(sections);

  if (!parsed.success) reasons.add("schema_rejected");
  if (sectionInventory.missing.length > 0) reasons.add("missing_section");
  if (sectionInventory.duplicates.length > 0) reasons.add("duplicate_section");
  if (sectionInventory.unknown) reasons.add("unknown_section");
  if (hasDescriptorFlagViolation(input))
    reasons.add("descriptor_flag_violation");
  if (hasInteractiveSection(input)) reasons.add("interactive_section");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.sourceCodeFields.length > 0)
    reasons.add("source_code_field_present");
  if (scan.executableFields.length > 0)
    reasons.add("executable_affordance_present");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.sourceCodeFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return DeveloperConsoleViewModelValidationSchema.parse({
    passed,
    reasons: passed ? ["developer_console_view_model_valid"] : [...reasons],
    missing_section_ids: sectionInventory.missing,
    duplicate_section_ids: sectionInventory.duplicates,
    invalid_section_ids: sectionInventory.invalid,
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["developer_console_view_model_safe"],
    metadata_only: true,
    redaction_required: readBooleanField(input, "redaction_required") === true,
    render_safe: passed,
    non_executable: passed,
    dev_only: readBooleanField(input, "dev_only") === true,
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

export function deriveDeveloperConsoleViewModelFromSafeMetadata(
  input: unknown,
): DeveloperConsoleViewModel {
  if (!validateObservabilityPayloadSafety(input).passed) {
    return createDefaultDeveloperConsoleViewModel();
  }
  const scan = scanDeveloperConsoleViewModel(input, [], new WeakSet<object>());
  if (
    scan.sourceCodeFields.length > 0 ||
    scan.executableFields.length > 0 ||
    scan.nonSerializable ||
    scan.unsafeShape
  ) {
    return createDefaultDeveloperConsoleViewModel();
  }
  const metadata = readMetadataSummaries(input);
  const defaultViewModel = createDefaultDeveloperConsoleViewModel();
  return DeveloperConsoleViewModelSchema.parse({
    ...defaultViewModel,
    generated_at: readGeneratedAt(input),
    sections: defaultViewModel.sections.map((section) => {
      const summary = metadata.get(section.section_id);
      if (!summary) return section;
      return createSectionViewModel(section.section_id, {
        status_class: normalizeStatusClass(summary.status_class),
        summary_bins: {
          primary: normalizeSummaryBin(summary.primary_bin),
          secondary: normalizeSummaryBin(summary.secondary_bin),
        },
        redaction_status: "metadata_only",
        truncated: summary.truncated === true,
        withheld_fields: Array.isArray(summary.withheld_fields)
          ? summary.withheld_fields.filter(
              (field): field is string => typeof field === "string",
            )
          : section.withheld_fields,
      });
    }),
  });
}

export function createPhase9JDeveloperConsoleCloseoutReport(
  input: Phase9JDeveloperConsoleCloseoutInput = {},
): Phase9JDeveloperConsoleCloseoutReport {
  const failedGuards = new Set<Phase9JDeveloperConsoleCloseoutGuard>();
  const notes = new Set<string>();
  const descriptor =
    input.descriptor ?? createDefaultDeveloperConsoleDescriptor();
  const sections = input.sections ?? createDefaultDeveloperConsoleSections();
  const viewModel = input.viewModel ?? createDefaultDeveloperConsoleViewModel();
  const unsafeMetadata = input.unsafeMetadata ?? {
    raw_prompt: "withheld",
    source_code: "blocked",
  };

  evaluateDescriptor(descriptor, failedGuards, notes);
  evaluateSections(sections, failedGuards, notes);
  evaluateViewModel(viewModel, failedGuards, notes);
  evaluateUnsafeMetadataFailClosed(unsafeMetadata, failedGuards, notes);
  evaluateGuardState(
    input.guardState ?? DEFAULT_PHASE_9J_DEVELOPER_CONSOLE_GUARD_STATE,
    failedGuards,
    notes,
  );

  if (failedGuards.size === 0) {
    notes.add("phase_9j_developer_console_scaffold_is_metadata_only_dev_only");
  }

  return Phase9JDeveloperConsoleCloseoutReportSchema.parse({
    kind: "command_center.phase_9j_developer_console_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9J_DEVELOPER_CONSOLE_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9j_developer_observability_console_scaffold",
    metadata_only: true,
    redaction_required: true,
    render_safe: failedGuards.size === 0,
    non_executable: true,
    dev_only: true,
    hidden_in_recruiter_view: true,
    hidden_in_demo_presentation: true,
    remote_access_allowed: false,
    writes_allowed: false,
    export_allowed: false,
    debug_actions_allowed: false,
    live_db_reads_allowed: false,
    telemetry_reads_allowed: false,
    source_code_rendering_allowed: false,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function createSectionViewModel(
  sectionId: DeveloperConsoleSectionId,
  input: Partial<DeveloperConsoleSectionViewModel> = {},
): DeveloperConsoleSectionViewModel {
  return DeveloperConsoleSectionViewModelSchema.parse({
    kind: "command_center.developer_console_section_view_model",
    phase: "9J2",
    section_id: sectionId,
    status_class: "empty",
    summary_bins: {
      primary: "none",
      secondary: "none",
    },
    redaction_status: "metadata_only",
    render_safe: true,
    interactive: false,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
    ],
    truncated: false,
    metadata_only: true,
    redaction_required: true,
    non_executable: true,
    raw_payloads_included: false,
    source_code_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    export_allowed: false,
    debug_actions_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
    ...input,
  });
}

function evaluateDescriptor(
  descriptor: unknown,
  failedGuards: Set<Phase9JDeveloperConsoleCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateDeveloperConsoleDescriptor(descriptor);
  if (!validation.passed) {
    notes.add("developer_console_descriptor_validation_failed");
    if (!validation.enabled_in_dev_only)
      failedGuards.add("no_non_dev_exposure");
    if (!validation.hidden_in_recruiter_view)
      failedGuards.add("no_recruiter_view_exposure");
    if (!validation.hidden_in_demo_presentation)
      failedGuards.add("no_demo_presentation_exposure");
    if (validation.remote_access_allowed) failedGuards.add("no_remote_access");
    if (validation.writes_allowed) failedGuards.add("no_writes");
    if (validation.export_allowed) failedGuards.add("no_exports");
    for (const reason of validation.reasons) {
      mapCommonReasonToGuards(reason, failedGuards);
    }
  }
}

function evaluateSections(
  sections: unknown,
  failedGuards: Set<Phase9JDeveloperConsoleCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateDeveloperConsoleSectionRegistry(sections);
  if (!validation.passed) {
    notes.add("developer_console_section_registry_validation_failed");
    for (const reason of validation.reasons) {
      if (reason === "interactive_section")
        failedGuards.add("no_debug_actions");
      if (reason === "raw_payload_field_declared")
        failedGuards.add("no_raw_payload_rendering");
      if (reason === "mutating_affordance_declared") {
        failedGuards.add("no_approval_or_execution_affordance");
        failedGuards.add("no_run_retry_or_rerun_affordance");
        failedGuards.add("no_exports");
        failedGuards.add("no_debug_actions");
      }
    }
  }
}

function evaluateViewModel(
  viewModel: unknown,
  failedGuards: Set<Phase9JDeveloperConsoleCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateDeveloperConsoleViewModel(viewModel);
  if (!validation.passed) {
    notes.add("developer_console_view_model_validation_failed");
    if (!validation.dev_only) failedGuards.add("no_non_dev_exposure");
    if (!validation.hidden_in_recruiter_view)
      failedGuards.add("no_recruiter_view_exposure");
    if (!validation.hidden_in_demo_presentation)
      failedGuards.add("no_demo_presentation_exposure");
    if (validation.remote_access_allowed) failedGuards.add("no_remote_access");
    if (validation.writes_allowed) failedGuards.add("no_writes");
    if (validation.export_allowed) failedGuards.add("no_exports");
    for (const reason of validation.reasons) {
      mapCommonReasonToGuards(reason, failedGuards);
    }
  }
}

function evaluateUnsafeMetadataFailClosed(
  unsafeMetadata: unknown,
  failedGuards: Set<Phase9JDeveloperConsoleCloseoutGuard>,
  notes: Set<string>,
): void {
  const derived =
    deriveDeveloperConsoleViewModelFromSafeMetadata(unsafeMetadata);
  if (derived !== createDefaultDeveloperConsoleViewModel()) {
    if (
      JSON.stringify(derived) !==
      JSON.stringify(createDefaultDeveloperConsoleViewModel())
    ) {
      failedGuards.add("no_raw_payload_rendering");
      failedGuards.add("no_source_code_rendering");
      notes.add("unsafe_console_metadata_did_not_fall_back");
    }
  }
}

function evaluateGuardState(
  guardState: unknown,
  failedGuards: Set<Phase9JDeveloperConsoleCloseoutGuard>,
  notes: Set<string>,
): void {
  if (Phase9JDeveloperConsoleGuardStateSchema.safeParse(guardState).success)
    return;
  if (!guardState || typeof guardState !== "object") {
    for (const [, guard] of CAPABILITY_FIELD_TO_GUARD) failedGuards.add(guard);
    notes.add("developer_console_guard_state_invalid");
    return;
  }
  const record = guardState as Partial<
    Record<Phase9JDeveloperConsoleForbiddenCapabilityField, unknown>
  >;
  for (const [field, guard] of CAPABILITY_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failedGuards.add(guard);
      notes.add(`forbidden_developer_console_capability_enabled:${field}`);
    }
  }
}

function mapCommonReasonToGuards(
  reason: string,
  failedGuards: Set<Phase9JDeveloperConsoleCloseoutGuard>,
): void {
  if (reason === "raw_payload_field_present") {
    failedGuards.add("no_raw_payload_rendering");
  }
  if (reason === "source_code_field_present") {
    failedGuards.add("no_source_code_rendering");
  }
  if (reason === "executable_affordance_present") {
    failedGuards.add("no_approval_or_execution_affordance");
    failedGuards.add("no_run_retry_or_rerun_affordance");
  }
}

interface ConsoleViewModelScanResult {
  rawPayloadFields: string[];
  sourceCodeFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanDeveloperConsoleViewModel(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): ConsoleViewModelScanResult {
  const result: ConsoleViewModelScanResult = {
    rawPayloadFields: [],
    sourceCodeFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };
  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("developer_console_vm_missing");
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
    if (isForbiddenSourceCodeField(key)) {
      result.sourceCodeFields.push([...path, key].join("."));
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanDeveloperConsoleViewModel(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.sourceCodeFields.push(...child.sourceCodeFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function hasDescriptorFlagViolation(input: unknown): boolean {
  return (
    readBooleanField(input, "metadata_only") !== true ||
    readBooleanField(input, "redaction_required") !== true ||
    readBooleanField(input, "render_safe") !== true ||
    readBooleanField(input, "non_executable") !== true ||
    readBooleanField(input, "dev_only") !== true ||
    readBooleanField(input, "hidden_in_recruiter_view") !== true ||
    readBooleanField(input, "hidden_in_demo_presentation") !== true ||
    readBooleanField(input, "remote_access_allowed") !== false ||
    readBooleanField(input, "writes_allowed") !== false ||
    readBooleanField(input, "export_allowed") !== false
  );
}

function hasInteractiveSection(input: unknown): boolean {
  return readSections(input).some((section) => {
    if (!section || typeof section !== "object") return false;
    return (section as { interactive?: unknown }).interactive !== false;
  });
}

function sectionInventoryFor(sections: unknown[]): {
  missing: DeveloperConsoleSectionId[];
  duplicates: DeveloperConsoleSectionId[];
  invalid: DeveloperConsoleSectionId[];
  unknown: boolean;
} {
  const seen = new Set<DeveloperConsoleSectionId>();
  const duplicates = new Set<DeveloperConsoleSectionId>();
  const invalid = new Set<DeveloperConsoleSectionId>();
  let unknown = false;
  for (const section of sections) {
    if (!section || typeof section !== "object") {
      unknown = true;
      continue;
    }
    const parsed = DeveloperConsoleSectionIdSchema.safeParse(
      (section as { section_id?: unknown }).section_id,
    );
    if (!parsed.success) {
      unknown = true;
      continue;
    }
    if (!DeveloperConsoleSectionViewModelSchema.safeParse(section).success) {
      invalid.add(parsed.data);
    }
    if (seen.has(parsed.data)) duplicates.add(parsed.data);
    seen.add(parsed.data);
  }
  return {
    missing: DEVELOPER_CONSOLE_SECTION_IDS.filter(
      (sectionId) => !seen.has(sectionId),
    ),
    duplicates: [...duplicates],
    invalid: [...invalid],
    unknown,
  };
}

function readSections(input: unknown): unknown[] {
  if (!input || typeof input !== "object") return [];
  const sections = (input as { sections?: unknown }).sections;
  return Array.isArray(sections) ? sections : [];
}

function readMetadataSummaries(
  input: unknown,
): Map<DeveloperConsoleSectionId, Record<string, unknown>> {
  const source =
    input && typeof input === "object"
      ? ((input as { sections?: unknown }).sections ?? input)
      : undefined;
  const entries: unknown[] = Array.isArray(source)
    ? source
    : source && typeof source === "object"
      ? Object.entries(source).map(([section_id, value]) => ({
          section_id,
          ...(value && typeof value === "object" ? value : {}),
        }))
      : [];
  const result = new Map<DeveloperConsoleSectionId, Record<string, unknown>>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const sectionId = DeveloperConsoleSectionIdSchema.safeParse(
      record.section_id,
    );
    if (!sectionId.success) continue;
    result.set(sectionId.data, record);
  }
  return result;
}

function normalizeStatusClass(
  input: unknown,
): DeveloperConsoleSectionStatusClass {
  if (
    typeof input === "string" &&
    (DEVELOPER_CONSOLE_SECTION_STATUS_CLASSES as readonly string[]).includes(
      input,
    )
  ) {
    return input as DeveloperConsoleSectionStatusClass;
  }
  return "unknown";
}

function normalizeSummaryBin(input: unknown): DeveloperConsoleSummaryBin {
  if (
    typeof input === "string" &&
    (DEVELOPER_CONSOLE_SUMMARY_BINS as readonly string[]).includes(input)
  ) {
    return input as DeveloperConsoleSummaryBin;
  }
  return "unknown";
}

function readGeneratedAt(input: unknown): number {
  if (!input || typeof input !== "object") return 0;
  const value = (input as { generated_at?: unknown }).generated_at;
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : 0;
}

function isForbiddenRawPayloadField(key: string): boolean {
  return (
    COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
  ).includes(key);
}

function isForbiddenSourceCodeField(key: string): boolean {
  return (
    RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS as readonly string[]
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
    key === "source_code_rendering_allowed"
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

const CAPABILITY_FIELD_TO_GUARD: ReadonlyArray<
  [
    Phase9JDeveloperConsoleForbiddenCapabilityField,
    Phase9JDeveloperConsoleCloseoutGuard,
  ]
> = [
  ["non_dev_exposure_enabled", "no_non_dev_exposure"],
  ["recruiter_view_exposure_enabled", "no_recruiter_view_exposure"],
  ["demo_presentation_exposure_enabled", "no_demo_presentation_exposure"],
  ["raw_payload_rendering_enabled", "no_raw_payload_rendering"],
  ["source_code_rendering_enabled", "no_source_code_rendering"],
  ["live_db_read_enabled", "no_live_db_read"],
  ["live_telemetry_read_enabled", "no_live_telemetry_read"],
  ["remote_access_enabled", "no_remote_access"],
  ["writes_enabled", "no_writes"],
  ["exports_enabled", "no_exports"],
  ["debug_actions_enabled", "no_debug_actions"],
  [
    "approval_or_execution_affordance_enabled",
    "no_approval_or_execution_affordance",
  ],
  ["run_retry_or_rerun_affordance_enabled", "no_run_retry_or_rerun_affordance"],
];
