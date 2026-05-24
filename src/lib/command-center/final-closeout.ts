import { z } from "zod";

import { createPhase9EAuditScreenCloseoutReport } from "./audit-closeout";
import { createPhase9JDeveloperConsoleCloseoutReport } from "./developer-console-view-model";
import { createPhase9GGovernanceBoundaryCloseoutReport } from "./governance-observed-overlay";
import { createPhase9ACommandCenterCloseoutReport } from "./idle-policy";
import { createPhase9BObservabilityCloseoutReport } from "./observability-closeout";
import { createPhase9KPrivacyTelemetryCloseoutReport } from "./privacy-closeout";
import { createPhase9IDemoModeCloseoutReport } from "./recruiter-presentation";
import { createPhase9FReplayTraceCloseoutReport } from "./replay-trace-closeout";
import { createPhase9CRestScreenCloseoutReport } from "./rest-scene";
import { createPhase9HRuntimeDependencyCloseoutReport } from "./runtime-dependency-observed-overlay";
import { createPhase9DWorkingCockpitCloseoutReport } from "./working-cockpit-refresh";

export const PHASE_9_SUBSECTION_CLOSEOUT_IDS = [
  "phase_9a_command_center_scaffold",
  "phase_9b_read_only_observability_scaffold",
  "phase_9c_rest_screen_scaffold",
  "phase_9d_working_cockpit_scaffold",
  "phase_9e_audit_screen_scaffold",
  "phase_9f_replay_trace_scaffold",
  "phase_9g_governance_boundary_visualizer_scaffold",
  "phase_9h_runtime_dependency_visualizer_scaffold",
  "phase_9i_demo_portfolio_mode_scaffold",
  "phase_9j_developer_observability_console_scaffold",
  "phase_9k_privacy_telemetry_audit_scaffold",
] as const;

export const PHASE_9_FINAL_CLOSEOUT_VERDICTS = ["pass", "fail"] as const;

export const PHASE_9_FINAL_CLOSEOUT_VALIDATION_REASONS = [
  "phase_9_final_closeout_valid",
  "schema_rejected",
  "missing_subsection",
  "duplicate_subsection",
  "unknown_subsection",
  "non_serializable_value",
  "unsafe_payload_shape",
  "verdict_mismatch",
] as const;

export const Phase9SubsectionCloseoutIdSchema = z.enum(
  PHASE_9_SUBSECTION_CLOSEOUT_IDS,
);
export const Phase9FinalCloseoutVerdictSchema = z.enum(
  PHASE_9_FINAL_CLOSEOUT_VERDICTS,
);
export const Phase9FinalCloseoutValidationReasonSchema = z.enum(
  PHASE_9_FINAL_CLOSEOUT_VALIDATION_REASONS,
);

export const Phase9SubsectionCloseoutReportSchema = z.strictObject({
  subsection_id: Phase9SubsectionCloseoutIdSchema,
  generated_from: Phase9SubsectionCloseoutIdSchema,
  verdict: Phase9FinalCloseoutVerdictSchema,
  checked_guards: z.array(z.string().trim().min(1).max(180)),
  failed_guards: z.array(z.string().trim().min(1).max(180)),
  guard_count: z.number().int().nonnegative(),
  failed_guard_count: z.number().int().nonnegative(),
  notes: z.array(z.string().trim().min(1).max(180)),
});

export const Phase9FinalCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9_final_closeout_report"),
  verdict: Phase9FinalCloseoutVerdictSchema,
  subsection_reports: z.array(Phase9SubsectionCloseoutReportSchema),
  checked_subsections: z.array(Phase9SubsectionCloseoutIdSchema),
  failed_subsections: z.array(Phase9SubsectionCloseoutIdSchema),
  aggregate_guard_count: z.number().int().nonnegative(),
  aggregate_failed_guard_count: z.number().int().nonnegative(),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9_observability_command_center_scaffold"),
  metadata_only: z.literal(true),
  render_safe: z.boolean(),
  non_executable: z.literal(true),
  side_effect_free: z.literal(true),
});

export const Phase9FinalCloseoutValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(Phase9FinalCloseoutValidationReasonSchema),
  missing_subsections: z.array(Phase9SubsectionCloseoutIdSchema),
  duplicate_subsections: z.array(Phase9SubsectionCloseoutIdSchema),
  unknown_subsection_count: z.number().int().nonnegative(),
  failed_subsections: z.array(Phase9SubsectionCloseoutIdSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  mutated_input: z.literal(false),
});

export type Phase9SubsectionCloseoutId = z.infer<
  typeof Phase9SubsectionCloseoutIdSchema
>;
export type Phase9FinalCloseoutVerdict = z.infer<
  typeof Phase9FinalCloseoutVerdictSchema
>;
export type Phase9FinalCloseoutValidationReason = z.infer<
  typeof Phase9FinalCloseoutValidationReasonSchema
>;
export type Phase9SubsectionCloseoutReport = z.infer<
  typeof Phase9SubsectionCloseoutReportSchema
>;
export type Phase9FinalCloseoutReport = z.infer<
  typeof Phase9FinalCloseoutReportSchema
>;
export type Phase9FinalCloseoutValidation = z.infer<
  typeof Phase9FinalCloseoutValidationSchema
>;

export interface Phase9FinalCloseoutInput {
  subsectionReports?: unknown[];
}

export function createPhase9FinalCloseoutReport(
  input: Phase9FinalCloseoutInput = {},
): Phase9FinalCloseoutReport {
  const rawReports =
    input.subsectionReports ?? createDefaultSubsectionReports();
  const subsectionReports = normalizeSubsectionReports(rawReports);
  const failedSubsections = subsectionReports
    .filter((report) => report.verdict === "fail")
    .map((report) => report.subsection_id);
  const aggregateGuardCount = subsectionReports.reduce(
    (total, report) => total + report.guard_count,
    0,
  );
  const aggregateFailedGuardCount = subsectionReports.reduce(
    (total, report) => total + report.failed_guard_count,
    0,
  );
  const notes = collectFinalNotes(subsectionReports, failedSubsections);

  return Phase9FinalCloseoutReportSchema.parse({
    kind: "command_center.phase_9_final_closeout_report",
    verdict: failedSubsections.length === 0 ? "pass" : "fail",
    subsection_reports: subsectionReports,
    checked_subsections: [...PHASE_9_SUBSECTION_CLOSEOUT_IDS],
    failed_subsections: failedSubsections,
    aggregate_guard_count: aggregateGuardCount,
    aggregate_failed_guard_count: aggregateFailedGuardCount,
    notes,
    generated_from: "phase_9_observability_command_center_scaffold",
    metadata_only: true,
    render_safe: failedSubsections.length === 0,
    non_executable: true,
    side_effect_free: true,
  });
}

export function validatePhase9FinalCloseoutReport(
  input: unknown,
): Phase9FinalCloseoutValidation {
  const parsed = Phase9FinalCloseoutReportSchema.safeParse(input);
  const scan = scanFinalCloseout(input, [], new WeakSet<object>());
  const subsectionReports = readSubsectionReports(input);
  const reasons = new Set<Phase9FinalCloseoutValidationReason>();
  const notes = new Set<string>();
  const inventory = subsectionInventoryFor(subsectionReports);
  const failedSubsections = readFailedSubsections(subsectionReports);

  if (!parsed.success) reasons.add("schema_rejected");
  if (inventory.missing.length > 0) reasons.add("missing_subsection");
  if (inventory.duplicates.length > 0) reasons.add("duplicate_subsection");
  if (inventory.unknownCount > 0) reasons.add("unknown_subsection");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasVerdictMismatch(input, failedSubsections)) {
    reasons.add("verdict_mismatch");
  }
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return Phase9FinalCloseoutValidationSchema.parse({
    passed,
    reasons: passed ? ["phase_9_final_closeout_valid"] : [...reasons],
    missing_subsections: inventory.missing,
    duplicate_subsections: inventory.duplicates,
    unknown_subsection_count: inventory.unknownCount,
    failed_subsections: failedSubsections,
    notes:
      notes.size > 0 ? [...notes] : ["phase_9_final_closeout_report_valid"],
    mutated_input: false,
  });
}

function createDefaultSubsectionReports(): unknown[] {
  return [
    createPhase9ACommandCenterCloseoutReport(),
    createPhase9BObservabilityCloseoutReport(),
    createPhase9CRestScreenCloseoutReport(),
    createPhase9DWorkingCockpitCloseoutReport(),
    createPhase9EAuditScreenCloseoutReport(),
    createPhase9FReplayTraceCloseoutReport(),
    createPhase9GGovernanceBoundaryCloseoutReport(),
    createPhase9HRuntimeDependencyCloseoutReport(),
    createPhase9IDemoModeCloseoutReport(),
    createPhase9JDeveloperConsoleCloseoutReport(),
    createPhase9KPrivacyTelemetryCloseoutReport(),
  ];
}

function normalizeSubsectionReports(
  rawReports: unknown[],
): Phase9SubsectionCloseoutReport[] {
  return rawReports
    .map(normalizeSubsectionReport)
    .filter(
      (report): report is Phase9SubsectionCloseoutReport => report !== null,
    )
    .sort(
      (left, right) =>
        PHASE_9_SUBSECTION_CLOSEOUT_IDS.indexOf(left.subsection_id) -
        PHASE_9_SUBSECTION_CLOSEOUT_IDS.indexOf(right.subsection_id),
    );
}

function normalizeSubsectionReport(
  rawReport: unknown,
): Phase9SubsectionCloseoutReport | null {
  if (!rawReport || typeof rawReport !== "object") return null;
  const record = rawReport as Record<string, unknown>;
  const subsection = Phase9SubsectionCloseoutIdSchema.safeParse(
    record.generated_from,
  );
  if (!subsection.success) return null;
  const checkedGuards = readStringArray(record.checked_guards);
  const failedGuards = readStringArray(record.failed_guards);
  const verdict = record.verdict === "fail" ? "fail" : "pass";

  return Phase9SubsectionCloseoutReportSchema.parse({
    subsection_id: subsection.data,
    generated_from: subsection.data,
    verdict,
    checked_guards: checkedGuards,
    failed_guards: failedGuards,
    guard_count: checkedGuards.length,
    failed_guard_count: failedGuards.length,
    notes: readStringArray(record.notes),
  });
}

function collectFinalNotes(
  subsectionReports: Phase9SubsectionCloseoutReport[],
  failedSubsections: Phase9SubsectionCloseoutId[],
): string[] {
  if (failedSubsections.length === 0) {
    return ["phase_9_observability_command_center_scaffold_closed"];
  }
  return subsectionReports
    .filter((report) => report.verdict === "fail")
    .map((report) => `subsection_failed:${report.subsection_id}`);
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === "string");
}

function readSubsectionReports(input: unknown): unknown[] {
  if (!input || typeof input !== "object") return [];
  const reports = (input as { subsection_reports?: unknown })
    .subsection_reports;
  return Array.isArray(reports) ? reports : [];
}

function subsectionInventoryFor(reports: unknown[]): {
  missing: Phase9SubsectionCloseoutId[];
  duplicates: Phase9SubsectionCloseoutId[];
  unknownCount: number;
} {
  const seen = new Set<Phase9SubsectionCloseoutId>();
  const duplicates = new Set<Phase9SubsectionCloseoutId>();
  let unknownCount = 0;
  for (const report of reports) {
    if (!report || typeof report !== "object") {
      unknownCount += 1;
      continue;
    }
    const parsed = Phase9SubsectionCloseoutIdSchema.safeParse(
      (report as { generated_from?: unknown }).generated_from,
    );
    if (!parsed.success) {
      unknownCount += 1;
      continue;
    }
    if (seen.has(parsed.data)) duplicates.add(parsed.data);
    seen.add(parsed.data);
  }
  return {
    missing: PHASE_9_SUBSECTION_CLOSEOUT_IDS.filter(
      (subsection) => !seen.has(subsection),
    ),
    duplicates: [...duplicates],
    unknownCount,
  };
}

function readFailedSubsections(
  reports: unknown[],
): Phase9SubsectionCloseoutId[] {
  return reports
    .filter(
      (report): report is { generated_from: unknown; verdict: unknown } =>
        !!report && typeof report === "object",
    )
    .filter((report) => report.verdict === "fail")
    .map((report) =>
      Phase9SubsectionCloseoutIdSchema.safeParse(report.generated_from),
    )
    .filter((result) => result.success)
    .map((result) => result.data);
}

function hasVerdictMismatch(
  input: unknown,
  failedSubsections: Phase9SubsectionCloseoutId[],
): boolean {
  if (!input || typeof input !== "object") return false;
  const verdict = (input as { verdict?: unknown }).verdict;
  return verdict === "pass" && failedSubsections.length > 0;
}

interface FinalCloseoutScanResult {
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanFinalCloseout(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): FinalCloseoutScanResult {
  const result: FinalCloseoutScanResult = {
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };
  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("final_closeout_missing");
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
    const child = scanFinalCloseout(value, [...path, key], seen);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}
