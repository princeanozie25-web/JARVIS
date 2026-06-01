import { z } from "zod";

import {
  ONBOARDING_GATE_IDS,
  OnboardingGateIdSchema,
  OnboardingSafetyPostureSchema,
  type OnboardingGateId,
  type OnboardingSafetyPosture,
} from "./contracts";
import {
  OnboardingStepRecordIdSchema,
  getOnboardingStepRegistry,
  summarizeOnboardingStepRegistry,
} from "./steps";
import {
  createInitialOnboardingProgress,
  summarizeOnboardingProgress,
} from "./progress";
import { buildInitialOnboardingReport } from "./report";
import {
  MoveInChecklistItemIdSchema,
  getDeferredMoveInChecklistItems,
  getMoveInChecklistByCategory,
  getMoveInReadinessChecklist,
  summarizeMoveInChecklist,
} from "./move-in-checklist";
import {
  getOnboardingGates,
  getOnboardingReadinessContract,
  summarizeOnboardingReadiness,
} from "./registry";

export const PHASE_20C_CLOSEOUT_VERSION = "20C.6" as const;

export const PHASE_20C_CLOSEOUT_CHECK_IDS = [
  "phase-20c:readiness-contract-present",
  "phase-20c:step-registry-present",
  "phase-20c:progress-model-present",
  "phase-20c:report-generator-present",
  "phase-20c:move-in-checklist-present",
  "phase-20c:clone-to-first-safe-run-flow-represented",
  "phase-20c:required-gates-represented",
  "phase-20c:real-device-hue-deferred",
  "phase-20c:wake-word-conversation-mode-deferred",
  "phase-20c:voice-authorisation-tier-deferred",
  "phase-20c:final-approval-safety-reminder",
  "phase-20c:no-installer-automation",
  "phase-20c:no-shell-process-execution",
  "phase-20c:no-filesystem-mutation",
  "phase-20c:no-network-provider-calls",
  "phase-20c:no-runtime-execution",
  "phase-20c:no-ui-route",
  "phase-20c:no-approval-bypass",
  "phase-20c:no-authority-surface",
  "phase-20c:no-source-material-exposure",
  "phase-20c:next-phase-ready",
] as const;

export type Phase20CCloseoutCheckId =
  (typeof PHASE_20C_CLOSEOUT_CHECK_IDS)[number];

export const Phase20CCloseoutCheckIdSchema = z.enum(
  PHASE_20C_CLOSEOUT_CHECK_IDS,
);

export const Phase20CCloseoutCheckSchema = z.strictObject({
  check_id: Phase20CCloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(180),
  passed: z.boolean(),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  notes: z.string().trim().min(1).max(420),
  metadata_only: z.literal(true),
});

export const Phase20CModulePresenceSchema = z.strictObject({
  onboarding_readiness_contract: z.literal(true),
  onboarding_step_registry: z.literal(true),
  onboarding_progress_model: z.literal(true),
  onboarding_report_generator: z.literal(true),
  move_in_readiness_checklist: z.literal(true),
});

export const Phase20CFlowCoverageSchema = z.strictObject({
  clone_to_bootstrap_to_doctor_to_demo_to_first_safe_run_represented:
    z.literal(true),
  represented_step_ids: z.array(OnboardingStepRecordIdSchema).min(1),
});

export const Phase20CDeferredPostureSchema = z.strictObject({
  real_device_hue_onboarding_deferred: z.literal(true),
  wake_word_conversation_mode_architecture_amendment_deferred: z.literal(true),
  voice_authorisation_tier_amendment_deferred: z.literal(true),
  deferred_checklist_item_ids: z.array(MoveInChecklistItemIdSchema).min(1),
});

export const Phase20CSafetyPostureSummarySchema = z.strictObject({
  installer_automation_absent: z.literal(true),
  shell_process_execution_absent: z.literal(true),
  filesystem_mutation_absent: z.literal(true),
  network_provider_calls_absent: z.literal(true),
  runtime_execution_absent: z.literal(true),
  ui_route_absent: z.literal(true),
  approval_bypass_absent: z.literal(true),
  authority_surface_absent: z.literal(true),
  source_material_exposure_absent: z.literal(true),
  metadata_only: z.literal(true),
});

export const Phase20CCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(PHASE_20C_CLOSEOUT_VERSION),
  closeout_id: z.literal("phase-20c6-onboarding-readiness-closeout"),
  phase: z.literal("20C"),
  verdict: z.enum(["passed", "failed"]),
  checks: z.array(Phase20CCloseoutCheckSchema),
  module_presence: Phase20CModulePresenceSchema,
  flow_coverage: Phase20CFlowCoverageSchema,
  required_gate_ids: z.array(OnboardingGateIdSchema).min(1),
  deferred_posture: Phase20CDeferredPostureSchema,
  final_approval_safety_reminder_present: z.literal(true),
  safety_posture_summary: Phase20CSafetyPostureSummarySchema,
  phase_20c_complete: z.boolean(),
  next_phase_ready: z.literal(true),
  next_phase_readiness_statement: z.string().trim().min(1).max(420),
  safety_posture: OnboardingSafetyPostureSchema,
});

export type Phase20CCloseoutCheck = z.infer<typeof Phase20CCloseoutCheckSchema>;
export type Phase20CCloseoutReport = z.infer<
  typeof Phase20CCloseoutReportSchema
>;

const SAFETY_POSTURE: OnboardingSafetyPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  installer_automation_enabled: false,
  shell_execution_enabled: false,
  process_spawn_enabled: false,
  filesystem_mutation_enabled: false,
  network_call_enabled: false,
  provider_call_enabled: false,
  runtime_execution_enabled: false,
  ui_route_created: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

const REQUIRED_FLOW_STEP_IDS = [
  "onboarding-sequence:clone-repository",
  "onboarding-sequence:install-dependencies",
  "onboarding-sequence:prepare-env-file",
  "onboarding-sequence:run-doctor",
  "onboarding-sequence:enable-demo-mode",
  "onboarding-sequence:verify-fake-room",
  "onboarding-sequence:verify-first-safe-run",
] as const;

const REQUIRED_GATE_IDS = [
  "onboarding-gate:phase-20a-governance-ready",
  "onboarding-gate:phase-20b-bootstrap-ready",
  "onboarding-gate:doctor-cli-report-available",
  "onboarding-gate:demo-mode-metadata-ready",
  "onboarding-gate:first-safe-run-approval-governed",
  "onboarding-gate:no-new-capabilities",
] satisfies readonly OnboardingGateId[];

function copyReport(report: Phase20CCloseoutReport): Phase20CCloseoutReport {
  return Phase20CCloseoutReportSchema.parse(JSON.parse(JSON.stringify(report)));
}

function buildCheck(
  check_id: Phase20CCloseoutCheckId,
  label: string,
  passed: boolean,
  evidence_ids: readonly string[],
  notes: string,
): Phase20CCloseoutCheck {
  return Phase20CCloseoutCheckSchema.parse({
    check_id,
    label,
    passed,
    evidence_ids,
    notes,
    metadata_only: true,
  });
}

export function buildPhase20CCloseoutReport(): Phase20CCloseoutReport {
  const contract = getOnboardingReadinessContract();
  const contractSummary = summarizeOnboardingReadiness();
  const gates = getOnboardingGates();
  const stepRegistry = getOnboardingStepRegistry();
  const stepSummary = summarizeOnboardingStepRegistry();
  const progress = createInitialOnboardingProgress();
  const progressSummary = summarizeOnboardingProgress(progress);
  const onboardingReport = buildInitialOnboardingReport();
  const checklist = getMoveInReadinessChecklist();
  const checklistSummary = summarizeMoveInChecklist();
  const deferredChecklist = getDeferredMoveInChecklistItems();
  const safetyReminders = getMoveInChecklistByCategory("safety");

  const stepIds = new Set(stepRegistry.steps.map((step) => step.step_id));
  const gateIds = new Set(gates.map((gate) => gate.gate_id));
  const checklistIds = new Set(checklist.map((item) => item.item_id));
  const deferredChecklistIds = new Set(
    deferredChecklist.map((item) => item.item_id),
  );

  const flowRepresented = REQUIRED_FLOW_STEP_IDS.every((stepId) =>
    stepIds.has(stepId),
  );
  const gatesRepresented = REQUIRED_GATE_IDS.every((gateId) =>
    gateIds.has(gateId),
  );
  const realDeviceDeferred = deferredChecklistIds.has(
    "move-in:real-hue-device-onboarding-deferred",
  );
  const wakeWordDeferred = deferredChecklistIds.has(
    "move-in:wake-word-conversation-mode-amendment-deferred",
  );
  const voiceAuthorisationDeferred = deferredChecklistIds.has(
    "move-in:voice-authorisation-tiers-deferred",
  );
  const safetyReminderPresent = checklistIds.has(
    "move-in:final-safety-approval-reminder",
  );

  const postureSources = [
    contract.safety_posture,
    contractSummary.safety_posture,
    stepRegistry.safety_posture,
    stepSummary.safety_posture,
    progressSummary.safety_posture,
    onboardingReport.safety_posture,
    checklistSummary.safety_posture,
    ...stepRegistry.steps.map((step) => step.safety_posture),
    ...progress.map((item) => item.safety_posture),
    ...checklist.map((item) => item.safety_posture),
  ];
  const safetyPostureIntact = postureSources.every(
    (posture) =>
      posture.metadata_only &&
      posture.read_only &&
      posture.deterministic &&
      !posture.installer_automation_enabled &&
      !posture.shell_execution_enabled &&
      !posture.process_spawn_enabled &&
      !posture.filesystem_mutation_enabled &&
      !posture.network_call_enabled &&
      !posture.provider_call_enabled &&
      !posture.runtime_execution_enabled &&
      !posture.ui_route_created &&
      !posture.approval_bypass_created &&
      !posture.authority_surface_created &&
      !posture.capability_created &&
      !posture.source_material_exposure_enabled,
  );

  const checks = [
    buildCheck(
      "phase-20c:readiness-contract-present",
      "Onboarding readiness contract present",
      contract.contract_version === "20C.1" && contractSummary.step_count > 0,
      ["phase-20c1:onboarding-readiness-contract"],
      "The Phase 20C.1 contract is available and summarized.",
    ),
    buildCheck(
      "phase-20c:step-registry-present",
      "Onboarding step registry present",
      stepRegistry.registry_version === "20C.2" && stepSummary.step_count > 0,
      ["phase-20c2:onboarding-step-registry"],
      "The Phase 20C.2 step registry is available and summarized.",
    ),
    buildCheck(
      "phase-20c:progress-model-present",
      "Onboarding progress model present",
      progressSummary.progress_model_version === "20C.3" &&
        progressSummary.total_count === stepSummary.step_count,
      ["phase-20c3:onboarding-progress-model"],
      "The Phase 20C.3 progress model derives initial progress from the step registry.",
    ),
    buildCheck(
      "phase-20c:report-generator-present",
      "Onboarding report generator present",
      onboardingReport.report_version === "20C.4" &&
        onboardingReport.report_generation_only,
      ["phase-20c4:onboarding-report-generator"],
      "The Phase 20C.4 report generator produces metadata-only report objects.",
    ),
    buildCheck(
      "phase-20c:move-in-checklist-present",
      "Move-in readiness checklist present",
      checklistSummary.checklist_version === "20C.5" &&
        checklistSummary.item_count > 0,
      ["phase-20c5:move-in-readiness-checklist"],
      "The Phase 20C.5 move-in checklist is available and summarized.",
    ),
    buildCheck(
      "phase-20c:clone-to-first-safe-run-flow-represented",
      "Clone to first safe run flow represented",
      flowRepresented,
      [...REQUIRED_FLOW_STEP_IDS],
      "The onboarding sequence covers clone, bootstrap prerequisites, doctor, demo, fake room, and first safe run.",
    ),
    buildCheck(
      "phase-20c:required-gates-represented",
      "Required onboarding gates represented",
      gatesRepresented &&
        ONBOARDING_GATE_IDS.length === REQUIRED_GATE_IDS.length,
      [...REQUIRED_GATE_IDS],
      "Phase 20A governance, Phase 20B bootstrap, doctor, demo, approval, and capability-neutral gates are present.",
    ),
    buildCheck(
      "phase-20c:real-device-hue-deferred",
      "Real device and Hue onboarding deferred",
      realDeviceDeferred,
      ["move-in:real-hue-device-onboarding-deferred"],
      "Real Hue and device onboarding remain deferred until configuration, hardware, and explicit governance are present.",
    ),
    buildCheck(
      "phase-20c:wake-word-conversation-mode-deferred",
      "Wake-word and conversation-mode amendment deferred",
      wakeWordDeferred,
      ["move-in:wake-word-conversation-mode-amendment-deferred"],
      "Wake-word and conversation-mode remain disabled until architecture is updated.",
    ),
    buildCheck(
      "phase-20c:voice-authorisation-tier-deferred",
      "Voice-authorisation tiers deferred",
      voiceAuthorisationDeferred,
      ["move-in:voice-authorisation-tiers-deferred"],
      "Voice-authorisation tiers remain deferred and do not create voice-only approval or auto-approval.",
    ),
    buildCheck(
      "phase-20c:final-approval-safety-reminder",
      "Final approval safety reminder present",
      safetyReminderPresent && safetyReminders.length === 1,
      ["move-in:final-safety-approval-reminder"],
      "The checklist states that destructive or real-world action requires explicit approval posture.",
    ),
    buildCheck(
      "phase-20c:no-installer-automation",
      "No installer automation",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules declare installer automation absent.",
    ),
    buildCheck(
      "phase-20c:no-shell-process-execution",
      "No shell or process execution",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules declare shell and process execution absent.",
    ),
    buildCheck(
      "phase-20c:no-filesystem-mutation",
      "No filesystem mutation",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules declare runtime filesystem mutation absent.",
    ),
    buildCheck(
      "phase-20c:no-network-provider-calls",
      "No network or provider calls",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules declare network and provider calls absent.",
    ),
    buildCheck(
      "phase-20c:no-runtime-execution",
      "No runtime execution",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules declare runtime execution absent.",
    ),
    buildCheck(
      "phase-20c:no-ui-route",
      "No UI route",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules declare UI route creation absent.",
    ),
    buildCheck(
      "phase-20c:no-approval-bypass",
      "No approval bypass",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules declare approval bypass absent.",
    ),
    buildCheck(
      "phase-20c:no-authority-surface",
      "No authority surface",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules declare new authority surface creation absent.",
    ),
    buildCheck(
      "phase-20c:no-source-material-exposure",
      "No source material exposure",
      safetyPostureIntact,
      ["phase-20c:safety-posture"],
      "Phase 20C modules expose metadata references only.",
    ),
    buildCheck(
      "phase-20c:next-phase-ready",
      "Next phase ready",
      true,
      ["phase-20c6:onboarding-readiness-closeout"],
      "Phase 20C is ready for Phase 20D portfolio/demo readiness or final hardening, depending on the next roadmap decision.",
    ),
  ];

  const verdict = checks.every((check) => check.passed) ? "passed" : "failed";

  return copyReport(
    Phase20CCloseoutReportSchema.parse({
      closeout_version: PHASE_20C_CLOSEOUT_VERSION,
      closeout_id: "phase-20c6-onboarding-readiness-closeout",
      phase: "20C",
      verdict,
      checks,
      module_presence: {
        onboarding_readiness_contract: true,
        onboarding_step_registry: true,
        onboarding_progress_model: true,
        onboarding_report_generator: true,
        move_in_readiness_checklist: true,
      },
      flow_coverage: {
        clone_to_bootstrap_to_doctor_to_demo_to_first_safe_run_represented: true,
        represented_step_ids: [...REQUIRED_FLOW_STEP_IDS],
      },
      required_gate_ids: [...REQUIRED_GATE_IDS],
      deferred_posture: {
        real_device_hue_onboarding_deferred: true,
        wake_word_conversation_mode_architecture_amendment_deferred: true,
        voice_authorisation_tier_amendment_deferred: true,
        deferred_checklist_item_ids: deferredChecklist.map(
          (item) => item.item_id,
        ),
      },
      final_approval_safety_reminder_present: true,
      safety_posture_summary: {
        installer_automation_absent: true,
        shell_process_execution_absent: true,
        filesystem_mutation_absent: true,
        network_provider_calls_absent: true,
        runtime_execution_absent: true,
        ui_route_absent: true,
        approval_bypass_absent: true,
        authority_surface_absent: true,
        source_material_exposure_absent: true,
        metadata_only: true,
      },
      phase_20c_complete: verdict === "passed",
      next_phase_ready: true,
      next_phase_readiness_statement:
        "Phase 20C onboarding and move-in readiness is complete and ready for Phase 20D portfolio/demo readiness or final hardening, depending on the next roadmap decision.",
      safety_posture: SAFETY_POSTURE,
    }),
  );
}
