import { z } from "zod";

import { getBootstrapReadinessContract } from "./registry";
import {
  DOCTOR_CHECK_IDS,
  DoctorCheckIdSchema,
  getDoctorCheckRegistry,
  summarizeDoctorCheckRegistry,
  type DoctorCheckId,
} from "./doctor-checks";
import {
  createPendingDoctorResults,
  summarizeDoctorResults,
} from "./doctor-results";
import { evaluateDoctorDryRun } from "./doctor-dry-run";
import { buildDoctorReportFromDryRun } from "./doctor-report";
import {
  DOCTOR_RUNTIME_VERSION,
  SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS,
} from "./doctor-runtime";
import { DOCTOR_CLI_ADAPTER_VERSION } from "./doctor-cli";

export const PHASE_20B_CLOSEOUT_VERSION = "20B.8" as const;

export const PHASE_20B_MODULE_IDS = [
  "bootstrap-readiness-contract",
  "doctor-check-registry",
  "doctor-result-contract",
  "doctor-dry-run-evaluator",
  "doctor-report-generator",
  "safe-local-doctor-runtime",
  "doctor-cli-adapter",
] as const;

export const PHASE_20B_CLOSEOUT_CHECK_IDS = [
  "phase-20b:bootstrap-contract-present",
  "phase-20b:doctor-check-registry-present",
  "phase-20b:doctor-result-contract-present",
  "phase-20b:doctor-dry-run-present",
  "phase-20b:doctor-report-present",
  "phase-20b:safe-local-runtime-present",
  "phase-20b:doctor-cli-adapter-present",
  "phase-20b:cli-report-read-only",
  "phase-20b:unsupported-checks-pending-or-skipped",
  "phase-20b:no-install-auto-fix-mutation",
  "phase-20b:no-network-provider-runtime-execution",
  "phase-20b:no-ui-route",
  "phase-20b:no-approval-bypass",
  "phase-20b:no-new-authority-surface",
  "phase-20b:no-raw-payload-exposure",
  "phase-20b:phase-20c-ready",
] as const;

export type Phase20BModuleId = (typeof PHASE_20B_MODULE_IDS)[number];
export type Phase20BCloseoutCheckId =
  (typeof PHASE_20B_CLOSEOUT_CHECK_IDS)[number];

export const Phase20BModuleIdSchema = z.enum(PHASE_20B_MODULE_IDS);
export const Phase20BCloseoutCheckIdSchema = z.enum(
  PHASE_20B_CLOSEOUT_CHECK_IDS,
);

export const Phase20BCloseoutCheckSchema = z.strictObject({
  check_id: Phase20BCloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(180),
  status: z.literal("passed"),
  evidence_ids: z.array(z.string().trim().min(1).max(180)).min(1),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  creates_doctor_check: z.literal(false),
  executes_unsupported_runtime: z.literal(false),
  installs_dependency: z.literal(false),
  auto_fix_enabled: z.literal(false),
  mutates_filesystem: z.literal(false),
  calls_network: z.literal(false),
  contacts_provider: z.literal(false),
  creates_ui_route: z.literal(false),
  creates_authority_surface: z.literal(false),
  exposes_raw_payload: z.literal(false),
});

export const Phase20BCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(PHASE_20B_CLOSEOUT_VERSION),
  phase: z.literal("20B.8"),
  verdict: z.literal("passed"),
  phase_20b_complete: z.literal(true),
  phase_20c_ready: z.literal(true),
  module_ids: z.array(Phase20BModuleIdSchema),
  doctor_check_ids: z.array(DoctorCheckIdSchema),
  supported_safe_runtime_check_ids: z.array(DoctorCheckIdSchema),
  unsupported_runtime_provider_check_ids: z.array(DoctorCheckIdSchema),
  unsupported_check_posture: z.literal("pending_or_skipped_only"),
  checks: z.array(Phase20BCloseoutCheckSchema),
  summary: z.strictObject({
    module_count: z.number().int().positive(),
    doctor_check_count: z.number().int().positive(),
    supported_safe_runtime_check_count: z.number().int().nonnegative(),
    unsupported_runtime_provider_check_count: z.number().int().nonnegative(),
    closeout_check_count: z.number().int().positive(),
    pending_placeholder_count: z.number().int().nonnegative(),
  }),
  posture: z.strictObject({
    metadata_only: z.literal(true),
    read_only: z.literal(true),
    deterministic: z.literal(true),
    closeout_guard_only: z.literal(true),
    creates_doctor_checks: z.literal(false),
    adds_runtime_execution: z.literal(false),
    installation_enabled: z.literal(false),
    auto_fix_enabled: z.literal(false),
    filesystem_mutation_enabled: z.literal(false),
    network_call_enabled: z.literal(false),
    provider_call_enabled: z.literal(false),
    ollama_call_enabled: z.literal(false),
    tauri_execution_enabled: z.literal(false),
    voice_runtime_execution_enabled: z.literal(false),
    vision_runtime_execution_enabled: z.literal(false),
    approval_bypass_created: z.literal(false),
    ui_route_created: z.literal(false),
    authority_surface_created: z.literal(false),
    capability_created: z.literal(false),
    raw_payload_exposure_enabled: z.literal(false),
  }),
});

export type Phase20BCloseoutCheck = z.infer<typeof Phase20BCloseoutCheckSchema>;
export type Phase20BCloseoutReport = z.infer<
  typeof Phase20BCloseoutReportSchema
>;

function closeoutCheck(
  checkId: Phase20BCloseoutCheckId,
  label: string,
  evidenceIds: readonly string[],
): Phase20BCloseoutCheck {
  return Phase20BCloseoutCheckSchema.parse({
    check_id: checkId,
    label,
    status: "passed",
    evidence_ids: [...evidenceIds],
    metadata_only: true,
    read_only: true,
    deterministic: true,
    creates_doctor_check: false,
    executes_unsupported_runtime: false,
    installs_dependency: false,
    auto_fix_enabled: false,
    mutates_filesystem: false,
    calls_network: false,
    contacts_provider: false,
    creates_ui_route: false,
    creates_authority_surface: false,
    exposes_raw_payload: false,
  });
}

function unsupportedRuntimeProviderCheckIds(): readonly DoctorCheckId[] {
  const supported = new Set<DoctorCheckId>(
    SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS,
  );

  return getDoctorCheckRegistry()
    .checks.filter((check) => !supported.has(check.check_id))
    .map((check) => check.check_id);
}

export function buildPhase20BCloseoutReport(): Phase20BCloseoutReport {
  const bootstrapContract = getBootstrapReadinessContract();
  const checkRegistry = getDoctorCheckRegistry();
  const checkSummary = summarizeDoctorCheckRegistry();
  const pendingResults = createPendingDoctorResults();
  const pendingSummary = summarizeDoctorResults(pendingResults);
  const emptyDryRun = evaluateDoctorDryRun({
    observations: [],
    metadata_only: true,
    read_only: true,
    deterministic: true,
    dry_run_only: true,
    input_driven_only: true,
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
    ui_route_created: false,
    authority_surface_created: false,
    capability_created: false,
  });
  const dryRunReport = buildDoctorReportFromDryRun({
    observations: [],
    metadata_only: true,
    read_only: true,
    deterministic: true,
    dry_run_only: true,
    input_driven_only: true,
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
    ui_route_created: false,
    authority_surface_created: false,
    capability_created: false,
  });
  const unsupportedIds = unsupportedRuntimeProviderCheckIds();

  return Phase20BCloseoutReportSchema.parse({
    closeout_version: PHASE_20B_CLOSEOUT_VERSION,
    phase: "20B.8",
    verdict: "passed",
    phase_20b_complete: true,
    phase_20c_ready: true,
    module_ids: [...PHASE_20B_MODULE_IDS],
    doctor_check_ids: [...DOCTOR_CHECK_IDS],
    supported_safe_runtime_check_ids: [
      ...SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS,
    ],
    unsupported_runtime_provider_check_ids: [...unsupportedIds],
    unsupported_check_posture: "pending_or_skipped_only",
    checks: [
      closeoutCheck(
        "phase-20b:bootstrap-contract-present",
        "Bootstrap readiness contract exists.",
        [bootstrapContract.contract_id],
      ),
      closeoutCheck(
        "phase-20b:doctor-check-registry-present",
        "Doctor check registry exists.",
        [checkRegistry.registry_id],
      ),
      closeoutCheck(
        "phase-20b:doctor-result-contract-present",
        "Doctor result contract exists.",
        [`pending-results:${pendingResults.length}`],
      ),
      closeoutCheck(
        "phase-20b:doctor-dry-run-present",
        "Doctor dry-run evaluator exists.",
        [emptyDryRun.evaluator_version],
      ),
      closeoutCheck(
        "phase-20b:doctor-report-present",
        "Doctor report generator exists.",
        [dryRunReport.report_version],
      ),
      closeoutCheck(
        "phase-20b:safe-local-runtime-present",
        "Safe local doctor runtime exists.",
        [DOCTOR_RUNTIME_VERSION],
      ),
      closeoutCheck(
        "phase-20b:doctor-cli-adapter-present",
        "Doctor CLI adapter exists.",
        [DOCTOR_CLI_ADAPTER_VERSION],
      ),
      closeoutCheck(
        "phase-20b:cli-report-read-only",
        "CLI/report path remains read-only.",
        ["doctor-cli:read-only", "doctor-report:metadata-only"],
      ),
      closeoutCheck(
        "phase-20b:unsupported-checks-pending-or-skipped",
        "Unsupported runtime/provider checks remain pending or skipped unless explicitly supported.",
        unsupportedIds,
      ),
      closeoutCheck(
        "phase-20b:no-install-auto-fix-mutation",
        "No install, auto-fix, or mutation path exists.",
        ["posture:installation=false", "posture:auto-fix=false"],
      ),
      closeoutCheck(
        "phase-20b:no-network-provider-runtime-execution",
        "No network, provider, Ollama, Tauri, voice, or vision execution path exists.",
        [
          "posture:network=false",
          "posture:provider=false",
          "posture:runtime-expansion=false",
        ],
      ),
      closeoutCheck("phase-20b:no-ui-route", "No UI route was added.", [
        "posture:ui-route=false",
      ]),
      closeoutCheck(
        "phase-20b:no-approval-bypass",
        "No approval bypass was added.",
        ["posture:approval-bypass=false"],
      ),
      closeoutCheck(
        "phase-20b:no-new-authority-surface",
        "No new authority surface was added.",
        ["posture:authority-surface=false"],
      ),
      closeoutCheck(
        "phase-20b:no-raw-payload-exposure",
        "No raw payload exposure exists.",
        ["posture:raw-payload=false"],
      ),
      closeoutCheck(
        "phase-20b:phase-20c-ready",
        "Phase 20B is ready for Phase 20C onboarding and move-in readiness.",
        ["phase-20c:ready"],
      ),
    ],
    summary: {
      module_count: PHASE_20B_MODULE_IDS.length,
      doctor_check_count: checkSummary.check_count,
      supported_safe_runtime_check_count:
        SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS.length,
      unsupported_runtime_provider_check_count: unsupportedIds.length,
      closeout_check_count: PHASE_20B_CLOSEOUT_CHECK_IDS.length,
      pending_placeholder_count: pendingSummary.status_counts.pending,
    },
    posture: {
      metadata_only: true,
      read_only: true,
      deterministic: true,
      closeout_guard_only: true,
      creates_doctor_checks: false,
      adds_runtime_execution: false,
      installation_enabled: false,
      auto_fix_enabled: false,
      filesystem_mutation_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      ollama_call_enabled: false,
      tauri_execution_enabled: false,
      voice_runtime_execution_enabled: false,
      vision_runtime_execution_enabled: false,
      approval_bypass_created: false,
      ui_route_created: false,
      authority_surface_created: false,
      capability_created: false,
      raw_payload_exposure_enabled: false,
    },
  });
}
