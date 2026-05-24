import { z } from "zod";

import { RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS } from "./audit-runtime-dependency";
import {
  COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES,
  COMMAND_CENTER_PRIVACY_EXECUTABLE_AFFORDANCE_KEYS,
} from "./privacy-enforcement";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";

export const REDACTION_COVERAGE_SURFACES = [
  "rest_orb",
  "working_cockpit",
  "audit_timeline",
  "audit_replay",
  "governance_boundary",
  "runtime_dependency",
  "demo_dataset",
  "recruiter_presentation",
  "developer_console",
] as const;

export const REDACTION_COVERAGE_VALIDATOR_IDS = [
  "validateOrbDisplayState",
  "validateWorkingCockpitViewModel",
  "validateAuditTraceTimelineViewModel",
  "validateAuditReplayViewerViewModel",
  "validateGovernanceBoundaryViewerViewModel",
  "validateRuntimeDependencyViewerViewModel",
  "validateSyntheticDemoDataset",
  "validateRecruiterPresentationViewModel",
  "validateDeveloperConsoleViewModel",
] as const;

export const REDACTION_COVERAGE_VALIDATION_REASONS = [
  "redaction_coverage_valid",
  "schema_rejected",
  "unknown_surface",
  "enforcement_boolean_disabled",
  "surface_specific_guard_missing",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;

export const REDACTION_COVERAGE_SUMMARY_VERDICTS = ["pass", "fail"] as const;

export const RedactionCoverageSurfaceSchema = z.enum(
  REDACTION_COVERAGE_SURFACES,
);
export const RedactionCoverageValidatorIdSchema = z.enum(
  REDACTION_COVERAGE_VALIDATOR_IDS,
);
export const RedactionCoverageValidationReasonSchema = z.enum(
  REDACTION_COVERAGE_VALIDATION_REASONS,
);
export const RedactionCoverageSummaryVerdictSchema = z.enum(
  REDACTION_COVERAGE_SUMMARY_VERDICTS,
);

export const RedactionCoverageEntrySchema = z.strictObject({
  kind: z.literal("command_center.redaction_coverage_entry"),
  phase: z.literal("9K2"),
  surface: RedactionCoverageSurfaceSchema,
  validator_id: RedactionCoverageValidatorIdSchema,
  uses_command_center_privacy_policy: z.literal(true),
  metadata_only_required: z.literal(true),
  redaction_required: z.literal(true),
  render_safe_required: z.literal(true),
  non_executable_required: z.literal(true),
  raw_payload_guard: z.literal(true),
  source_code_guard: z.boolean(),
  demo_live_data_guard: z.boolean(),
  recruiter_exposure_guard: z.boolean(),
  dev_only_guard: z.boolean(),
  notes: z.array(z.string().trim().min(1).max(180)),
});

export const RedactionCoverageMatrixSchema = z.strictObject({
  kind: z.literal("command_center.redaction_coverage_matrix"),
  phase: z.literal("9K2"),
  generated_at: z.number().int().nonnegative(),
  entries: z.array(RedactionCoverageEntrySchema),
});

export const RedactionCoverageEntryValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(RedactionCoverageValidationReasonSchema),
  surface: z.union([RedactionCoverageSurfaceSchema, z.literal("unknown")]),
  withheld_fields: z.array(z.string().trim().min(1).max(180)),
  notes: z.array(z.string().trim().min(1).max(180)),
  mutated_input: z.literal(false),
});

export const RedactionCoverageMatrixValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(RedactionCoverageValidationReasonSchema),
  missing_surfaces: z.array(RedactionCoverageSurfaceSchema),
  duplicate_surfaces: z.array(RedactionCoverageSurfaceSchema),
  invalid_surfaces: z.array(RedactionCoverageSurfaceSchema),
  unknown_surface_count: z.number().int().nonnegative(),
  withheld_fields: z.array(z.string().trim().min(1).max(180)),
  notes: z.array(z.string().trim().min(1).max(180)),
  mutated_input: z.literal(false),
});

export const RedactionCoverageSummarySchema = z.strictObject({
  total_surfaces: z.number().int().nonnegative(),
  covered_surfaces: z.array(RedactionCoverageSurfaceSchema),
  uncovered_surfaces: z.array(RedactionCoverageSurfaceSchema),
  verdict: RedactionCoverageSummaryVerdictSchema,
  notes: z.array(z.string().trim().min(1).max(180)),
});

export type RedactionCoverageSurface = z.infer<
  typeof RedactionCoverageSurfaceSchema
>;
export type RedactionCoverageValidatorId = z.infer<
  typeof RedactionCoverageValidatorIdSchema
>;
export type RedactionCoverageValidationReason = z.infer<
  typeof RedactionCoverageValidationReasonSchema
>;
export type RedactionCoverageSummaryVerdict = z.infer<
  typeof RedactionCoverageSummaryVerdictSchema
>;
export type RedactionCoverageEntry = z.infer<
  typeof RedactionCoverageEntrySchema
>;
export type RedactionCoverageMatrix = z.infer<
  typeof RedactionCoverageMatrixSchema
>;
export type RedactionCoverageEntryValidation = z.infer<
  typeof RedactionCoverageEntryValidationSchema
>;
export type RedactionCoverageMatrixValidation = z.infer<
  typeof RedactionCoverageMatrixValidationSchema
>;
export type RedactionCoverageSummary = z.infer<
  typeof RedactionCoverageSummarySchema
>;

export function createDefaultRedactionCoverageMatrix(): RedactionCoverageMatrix {
  return RedactionCoverageMatrixSchema.parse({
    kind: "command_center.redaction_coverage_matrix",
    phase: "9K2",
    generated_at: 0,
    entries: REDACTION_COVERAGE_SURFACES.map((surface) =>
      createRedactionCoverageEntry(surface),
    ),
  });
}

export function validateRedactionCoverageEntry(
  input: unknown,
): RedactionCoverageEntryValidation {
  const parsed = RedactionCoverageEntrySchema.safeParse(input);
  const scan = scanCoverage(input, [], new WeakSet<object>());
  const reasons = new Set<RedactionCoverageValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const surface = readSurface(input);

  if (!parsed.success) reasons.add("schema_rejected");
  if (surface === "unknown") reasons.add("unknown_surface");
  if (hasDisabledCoreCoverage(input)) {
    reasons.add("enforcement_boolean_disabled");
  }
  if (hasMissingSurfaceSpecificGuard(surface, input)) {
    reasons.add("surface_specific_guard_missing");
  }
  if (scan.rawPayloadFields.length > 0) {
    reasons.add("raw_payload_field_present");
  }
  if (scan.executableFields.length > 0) {
    reasons.add("executable_affordance_present");
  }
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return RedactionCoverageEntryValidationSchema.parse({
    passed,
    reasons: passed ? ["redaction_coverage_valid"] : [...reasons],
    surface,
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["redaction_coverage_entry_enforced"],
    mutated_input: false,
  });
}

export function validateRedactionCoverageMatrix(
  input: unknown = createDefaultRedactionCoverageMatrix(),
): RedactionCoverageMatrixValidation {
  const parsed = RedactionCoverageMatrixSchema.safeParse(input);
  const entries = readEntries(input);
  const reasons = new Set<RedactionCoverageValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const seen = new Set<RedactionCoverageSurface>();
  const duplicates = new Set<RedactionCoverageSurface>();
  const invalid = new Set<RedactionCoverageSurface>();
  let unknownSurfaceCount = 0;

  if (!parsed.success) reasons.add("schema_rejected");
  for (const entry of entries) {
    const validation = validateRedactionCoverageEntry(entry);
    if (!validation.passed) {
      for (const reason of validation.reasons) {
        if (reason !== "redaction_coverage_valid") reasons.add(reason);
      }
      for (const field of validation.withheld_fields) {
        withheldFields.add(field);
      }
      for (const note of validation.notes) notes.add(note);
      if (validation.surface === "unknown") {
        unknownSurfaceCount += 1;
      } else {
        invalid.add(validation.surface);
      }
    }
    if (validation.surface !== "unknown") {
      if (seen.has(validation.surface)) duplicates.add(validation.surface);
      seen.add(validation.surface);
    }
  }

  const missing = REDACTION_COVERAGE_SURFACES.filter(
    (surface) => !seen.has(surface),
  );
  if (missing.length > 0) reasons.add("unknown_surface");
  if (duplicates.size > 0) reasons.add("unknown_surface");

  const passed = reasons.size === 0;
  return RedactionCoverageMatrixValidationSchema.parse({
    passed,
    reasons: passed ? ["redaction_coverage_valid"] : [...reasons],
    missing_surfaces: missing,
    duplicate_surfaces: [...duplicates],
    invalid_surfaces: [...invalid],
    unknown_surface_count: unknownSurfaceCount,
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["redaction_coverage_matrix_complete"],
    mutated_input: false,
  });
}

export function summarizeRedactionCoverageMatrix(
  input: unknown = createDefaultRedactionCoverageMatrix(),
): RedactionCoverageSummary {
  const validation = validateRedactionCoverageMatrix(input);
  const entries = readEntries(input);
  const validSurfaces = new Set<RedactionCoverageSurface>();
  for (const entry of entries) {
    const entryValidation = validateRedactionCoverageEntry(entry);
    if (entryValidation.passed && entryValidation.surface !== "unknown") {
      validSurfaces.add(entryValidation.surface);
    }
  }
  const uncovered = REDACTION_COVERAGE_SURFACES.filter(
    (surface) => !validSurfaces.has(surface),
  );

  return RedactionCoverageSummarySchema.parse({
    total_surfaces: REDACTION_COVERAGE_SURFACES.length,
    covered_surfaces: REDACTION_COVERAGE_SURFACES.filter((surface) =>
      validSurfaces.has(surface),
    ),
    uncovered_surfaces: uncovered,
    verdict: validation.passed && uncovered.length === 0 ? "pass" : "fail",
    notes: validation.passed
      ? ["all_command_center_surfaces_have_redaction_coverage"]
      : validation.notes,
  });
}

function createRedactionCoverageEntry(
  surface: RedactionCoverageSurface,
): RedactionCoverageEntry {
  return RedactionCoverageEntrySchema.parse({
    kind: "command_center.redaction_coverage_entry",
    phase: "9K2",
    surface,
    validator_id: VALIDATOR_BY_SURFACE[surface],
    uses_command_center_privacy_policy: true,
    metadata_only_required: true,
    redaction_required: true,
    render_safe_required: true,
    non_executable_required: true,
    raw_payload_guard: true,
    source_code_guard: true,
    demo_live_data_guard: surface === "demo_dataset",
    recruiter_exposure_guard: surface === "recruiter_presentation",
    dev_only_guard: surface === "developer_console",
    notes: [`${surface}_covered_by_privacy_policy`],
  });
}

interface CoverageScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanCoverage(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): CoverageScanResult {
  const result: CoverageScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("coverage_entry_missing");
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
    const child = scanCoverage(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function hasDisabledCoreCoverage(input: unknown): boolean {
  return CORE_COVERAGE_BOOLEAN_FIELDS.some(
    (field) => readBooleanField(input, field) !== true,
  );
}

function hasMissingSurfaceSpecificGuard(
  surface: RedactionCoverageSurface | "unknown",
  input: unknown,
): boolean {
  if (surface === "demo_dataset") {
    return readBooleanField(input, "demo_live_data_guard") !== true;
  }
  if (surface === "recruiter_presentation") {
    return readBooleanField(input, "recruiter_exposure_guard") !== true;
  }
  if (surface === "developer_console") {
    return readBooleanField(input, "dev_only_guard") !== true;
  }
  return false;
}

function readSurface(input: unknown): RedactionCoverageSurface | "unknown" {
  if (!input || typeof input !== "object") return "unknown";
  const parsed = RedactionCoverageSurfaceSchema.safeParse(
    (input as { surface?: unknown }).surface,
  );
  return parsed.success ? parsed.data : "unknown";
}

function readEntries(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return [];
  const entries = (input as { entries?: unknown }).entries;
  return Array.isArray(entries) ? entries : [];
}

function isForbiddenRawPayloadField(key: string): boolean {
  return (
    [
      ...COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES,
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
    ] as readonly string[]
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
    key === "remote_dashboard_allowed" ||
    key === "export_allowed" ||
    key === "debug_actions_allowed"
  ) {
    return value !== false;
  }
  return (
    COMMAND_CENTER_PRIVACY_EXECUTABLE_AFFORDANCE_KEYS as readonly string[]
  ).includes(key);
}

function readBooleanField(input: unknown, field: string): boolean | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "boolean" ? value : undefined;
}

const CORE_COVERAGE_BOOLEAN_FIELDS = [
  "uses_command_center_privacy_policy",
  "metadata_only_required",
  "redaction_required",
  "render_safe_required",
  "non_executable_required",
  "raw_payload_guard",
  "source_code_guard",
] as const;

const VALIDATOR_BY_SURFACE: Record<
  RedactionCoverageSurface,
  RedactionCoverageValidatorId
> = {
  rest_orb: "validateOrbDisplayState",
  working_cockpit: "validateWorkingCockpitViewModel",
  audit_timeline: "validateAuditTraceTimelineViewModel",
  audit_replay: "validateAuditReplayViewerViewModel",
  governance_boundary: "validateGovernanceBoundaryViewerViewModel",
  runtime_dependency: "validateRuntimeDependencyViewerViewModel",
  demo_dataset: "validateSyntheticDemoDataset",
  recruiter_presentation: "validateRecruiterPresentationViewModel",
  developer_console: "validateDeveloperConsoleViewModel",
};
