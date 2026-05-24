import { z } from "zod";

import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_PRIVACY_EXECUTABLE_AFFORDANCE_KEYS } from "./privacy-enforcement";
import {
  Phase9FinalCloseoutReportSchema,
  createPhase9FinalCloseoutReport,
  type Phase9FinalCloseoutReport,
  type Phase9SubsectionCloseoutId,
} from "./final-closeout";
import {
  Phase9DisabledFeatureMatrixSummarySchema,
  createDefaultPhase9DisabledFeatureMatrix,
  summarizePhase9DisabledFeatureMatrix,
  type Phase9DisabledFeatureMatrixSummary,
} from "./final-disabled-feature-matrix";

export const PHASE_9_FINAL_VERDICT_GATE_VERDICTS = [
  "pass_with_notes",
  "fail",
] as const;

export const PHASE_9_FINAL_VERDICT_COMPONENT_VERDICTS = [
  "pass",
  "fail",
] as const;

export const PHASE_9_FINAL_VERDICT_GATE_VALIDATION_REASONS = [
  "phase_9_final_verdict_gate_valid",
  "schema_rejected",
  "missing_closeout_report",
  "missing_disabled_feature_summary",
  "unknown_verdict",
  "dependency_failed",
  "verdict_mismatch",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;

export const Phase9FinalVerdictGateVerdictSchema = z.enum(
  PHASE_9_FINAL_VERDICT_GATE_VERDICTS,
);
export const Phase9FinalVerdictComponentVerdictSchema = z.enum(
  PHASE_9_FINAL_VERDICT_COMPONENT_VERDICTS,
);
export const Phase9FinalVerdictGateValidationReasonSchema = z.enum(
  PHASE_9_FINAL_VERDICT_GATE_VALIDATION_REASONS,
);

export const Phase9FinalVerdictGateTestBarSchema = z.strictObject({
  targeted_command_center_tests: z.literal("required_pass"),
  typecheck: z.literal("required_pass"),
  lint: z.literal("required_pass"),
  full_test_suite: z.literal("required_pass"),
  runtime_hooks_exercised: z.literal(false),
  live_data_inspected: z.literal(false),
});

export const Phase9FinalVerdictGateSchema = z.strictObject({
  kind: z.literal("command_center.phase_9_final_verdict_gate"),
  verdict: Phase9FinalVerdictGateVerdictSchema,
  phase: z.literal("phase_9_observability_command_center_ui"),
  closeout_report: Phase9FinalCloseoutReportSchema,
  disabled_feature_summary: Phase9DisabledFeatureMatrixSummarySchema,
  test_bar: Phase9FinalVerdictGateTestBarSchema,
  authority_surface_verdict: Phase9FinalVerdictComponentVerdictSchema,
  privacy_verdict: Phase9FinalVerdictComponentVerdictSchema,
  replay_non_executability_verdict: Phase9FinalVerdictComponentVerdictSchema,
  demo_isolation_verdict: Phase9FinalVerdictComponentVerdictSchema,
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9_final_verdict_gate"),
  metadata_only: z.literal(true),
  render_safe: z.boolean(),
  non_executable: z.literal(true),
  side_effect_free: z.literal(true),
});

export const Phase9FinalVerdictGateValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(Phase9FinalVerdictGateValidationReasonSchema),
  dependency_failed: z.boolean(),
  failed_dependencies: z.array(z.string().trim().min(1).max(180)),
  withheld_fields: z.array(z.string().trim().min(1).max(180)),
  notes: z.array(z.string().trim().min(1).max(180)),
  mutated_input: z.literal(false),
});

export type Phase9FinalVerdictGateVerdict = z.infer<
  typeof Phase9FinalVerdictGateVerdictSchema
>;
export type Phase9FinalVerdictComponentVerdict = z.infer<
  typeof Phase9FinalVerdictComponentVerdictSchema
>;
export type Phase9FinalVerdictGateValidationReason = z.infer<
  typeof Phase9FinalVerdictGateValidationReasonSchema
>;
export type Phase9FinalVerdictGateTestBar = z.infer<
  typeof Phase9FinalVerdictGateTestBarSchema
>;
export type Phase9FinalVerdictGate = z.infer<
  typeof Phase9FinalVerdictGateSchema
>;
export type Phase9FinalVerdictGateValidation = z.infer<
  typeof Phase9FinalVerdictGateValidationSchema
>;

export interface Phase9FinalVerdictGateInput {
  closeoutReport?: unknown;
  disabledFeatureMatrix?: unknown;
  disabledFeatureSummary?: unknown;
}

export function createPhase9FinalVerdictGate(
  input: Phase9FinalVerdictGateInput = {},
): Phase9FinalVerdictGate {
  const closeoutReport =
    input.closeoutReport ?? createPhase9FinalCloseoutReport();
  const disabledFeatureSummary =
    input.disabledFeatureSummary ??
    summarizePhase9DisabledFeatureMatrix(
      input.disabledFeatureMatrix ?? createDefaultPhase9DisabledFeatureMatrix(),
    );
  const parsedCloseout =
    Phase9FinalCloseoutReportSchema.safeParse(closeoutReport);
  const parsedSummary = Phase9DisabledFeatureMatrixSummarySchema.safeParse(
    disabledFeatureSummary,
  );

  const dependencyState =
    parsedCloseout.success && parsedSummary.success
      ? evaluateDependencies(parsedCloseout.data, parsedSummary.data)
      : {
          authority: "fail" as const,
          privacy: "fail" as const,
          replay: "fail" as const,
          demo: "fail" as const,
          pass: false,
          failed: ["invalid_dependency_shape"],
        };

  const verdict = dependencyState.pass ? "pass_with_notes" : "fail";

  return Phase9FinalVerdictGateSchema.parse({
    kind: "command_center.phase_9_final_verdict_gate",
    verdict,
    phase: "phase_9_observability_command_center_ui",
    closeout_report: parsedCloseout.success
      ? parsedCloseout.data
      : createPhase9FinalCloseoutReport(),
    disabled_feature_summary: parsedSummary.success
      ? parsedSummary.data
      : summarizePhase9DisabledFeatureMatrix(),
    test_bar: createDefaultTestBar(),
    authority_surface_verdict: dependencyState.authority,
    privacy_verdict: dependencyState.privacy,
    replay_non_executability_verdict: dependencyState.replay,
    demo_isolation_verdict: dependencyState.demo,
    notes: dependencyState.pass
      ? [
          "phase_9_visible_without_new_authority",
          "final_verdict_requires_recorded_test_bar_pass",
        ]
      : dependencyState.failed.map((item) => `dependency_failed:${item}`),
    generated_from: "phase_9_final_verdict_gate",
    metadata_only: true,
    render_safe: dependencyState.pass,
    non_executable: true,
    side_effect_free: true,
  });
}

export function validatePhase9FinalVerdictGate(
  input: unknown,
): Phase9FinalVerdictGateValidation {
  const parsed = Phase9FinalVerdictGateSchema.safeParse(input);
  const scan = scanVerdictGate(input, [], new WeakSet<object>());
  const reasons = new Set<Phase9FinalVerdictGateValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const verdict = readStringField(input, "verdict");
  const closeoutReport = readField(input, "closeout_report");
  const disabledSummary = readField(input, "disabled_feature_summary");
  const closeoutParsed =
    Phase9FinalCloseoutReportSchema.safeParse(closeoutReport);
  const summaryParsed =
    Phase9DisabledFeatureMatrixSummarySchema.safeParse(disabledSummary);
  const dependencyState =
    closeoutParsed.success && summaryParsed.success
      ? evaluateDependencies(closeoutParsed.data, summaryParsed.data)
      : {
          authority: "fail" as const,
          privacy: "fail" as const,
          replay: "fail" as const,
          demo: "fail" as const,
          pass: false,
          failed: ["invalid_dependency_shape"],
        };

  if (!parsed.success) reasons.add("schema_rejected");
  if (!closeoutParsed.success) reasons.add("missing_closeout_report");
  if (!summaryParsed.success) reasons.add("missing_disabled_feature_summary");
  if (
    verdict !== undefined &&
    !Phase9FinalVerdictGateVerdictSchema.safeParse(verdict).success
  ) {
    reasons.add("unknown_verdict");
  }
  if (!dependencyState.pass) reasons.add("dependency_failed");
  if (verdict === "pass_with_notes" && !dependencyState.pass) {
    reasons.add("verdict_mismatch");
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
  return Phase9FinalVerdictGateValidationSchema.parse({
    passed,
    reasons: passed ? ["phase_9_final_verdict_gate_valid"] : [...reasons],
    dependency_failed: !dependencyState.pass,
    failed_dependencies: dependencyState.failed,
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["phase_9_final_verdict_gate_valid"],
    mutated_input: false,
  });
}

function createDefaultTestBar(): Phase9FinalVerdictGateTestBar {
  return Phase9FinalVerdictGateTestBarSchema.parse({
    targeted_command_center_tests: "required_pass",
    typecheck: "required_pass",
    lint: "required_pass",
    full_test_suite: "required_pass",
    runtime_hooks_exercised: false,
    live_data_inspected: false,
  });
}

function evaluateDependencies(
  closeoutReport: Phase9FinalCloseoutReport,
  disabledFeatureSummary: Phase9DisabledFeatureMatrixSummary,
): {
  authority: Phase9FinalVerdictComponentVerdict;
  privacy: Phase9FinalVerdictComponentVerdict;
  replay: Phase9FinalVerdictComponentVerdict;
  demo: Phase9FinalVerdictComponentVerdict;
  pass: boolean;
  failed: string[];
} {
  const failed: string[] = [];
  const closeoutPass =
    closeoutReport.verdict === "pass" &&
    closeoutReport.aggregate_failed_guard_count === 0 &&
    closeoutReport.failed_subsections.length === 0;
  const disabledPass =
    disabledFeatureSummary.verdict === "pass" &&
    disabledFeatureSummary.enabled_forbidden_features.length === 0;
  const privacyPass = subsectionPassed(
    closeoutReport,
    "phase_9k_privacy_telemetry_audit_scaffold",
  );
  const demoPass = subsectionPassed(
    closeoutReport,
    "phase_9i_demo_portfolio_mode_scaffold",
  );
  const replayPass = subsectionPassed(
    closeoutReport,
    "phase_9f_replay_trace_scaffold",
  );
  const auditPass = subsectionPassed(
    closeoutReport,
    "phase_9e_audit_screen_scaffold",
  );

  if (!closeoutPass) failed.push("final_closeout");
  if (!disabledPass) failed.push("disabled_feature_matrix");
  if (!privacyPass) failed.push("privacy_closeout");
  if (!demoPass) failed.push("demo_mode_closeout");
  if (!replayPass) failed.push("replay_trace_closeout");
  if (!auditPass) failed.push("audit_screen_closeout");

  return {
    authority: closeoutPass && disabledPass ? "pass" : "fail",
    privacy: privacyPass ? "pass" : "fail",
    replay: replayPass && auditPass ? "pass" : "fail",
    demo: demoPass ? "pass" : "fail",
    pass: failed.length === 0,
    failed,
  };
}

function subsectionPassed(
  closeoutReport: Phase9FinalCloseoutReport,
  subsectionId: Phase9SubsectionCloseoutId,
): boolean {
  return closeoutReport.subsection_reports.some(
    (report) =>
      report.subsection_id === subsectionId &&
      report.verdict === "pass" &&
      report.failed_guard_count === 0,
  );
}

interface VerdictGateScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanVerdictGate(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): VerdictGateScanResult {
  const result: VerdictGateScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };
  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("verdict_gate_missing");
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
    const child = scanVerdictGate(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function isForbiddenRawPayloadField(key: string): boolean {
  return (
    [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      "raw_tool_arguments",
      "raw_prompts",
      "raw_model_outputs",
      "source_code",
      "raw_stack_traces",
      "exact_pii",
      "api_keys",
      "tokens",
      "passwords",
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

function readField(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object") return undefined;
  return (input as Record<string, unknown>)[field];
}

function readStringField(input: unknown, field: string): string | undefined {
  const value = readField(input, field);
  return typeof value === "string" ? value : undefined;
}
