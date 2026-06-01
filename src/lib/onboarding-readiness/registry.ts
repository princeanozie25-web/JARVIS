import {
  ONBOARDING_READINESS_CATEGORIES,
  ONBOARDING_READINESS_CONTRACT_VERSION,
  OnboardingDeferredItemSchema,
  OnboardingGateSchema,
  OnboardingReadinessContractSchema,
  OnboardingReadinessSummarySchema,
  OnboardingStepSchema,
  type OnboardingDeferredItem,
  type OnboardingGate,
  type OnboardingReadinessCategory,
  type OnboardingReadinessContract,
  type OnboardingReadinessSummary,
  type OnboardingSafetyPosture,
  type OnboardingStep,
} from "./contracts";
import { buildPhase20BCloseoutReport } from "../bootstrap-readiness";
import { buildPhase20ACloseoutReport } from "../final-system-status";

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

const PHASE_20A_EVIDENCE = "phase-20a-final-readiness-layer-closeout";
const PHASE_20B_EVIDENCE = "phase-20b-bootstrap-readiness-closeout";

const GATES = [
  {
    gate_id: "onboarding-gate:phase-20a-governance-ready",
    label: "Phase 20A governance ready",
    description:
      "Final governance, authority, disabled-feature, and readiness layers are complete before onboarding guidance begins.",
    evidence_ids: [PHASE_20A_EVIDENCE],
    satisfied_by_contract: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    gate_id: "onboarding-gate:phase-20b-bootstrap-ready",
    label: "Phase 20B bootstrap ready",
    description:
      "Bootstrap readiness, doctor contracts, safe local runtime, CLI adapter, and closeout are complete before move-in guidance.",
    evidence_ids: [PHASE_20B_EVIDENCE],
    satisfied_by_contract: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    gate_id: "onboarding-gate:doctor-cli-report-available",
    label: "Doctor CLI report available",
    description:
      "The safe local doctor CLI can produce deterministic text or JSON reports, but this contract does not run it.",
    evidence_ids: ["phase-20b7:doctor-cli-adapter"],
    satisfied_by_contract: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    gate_id: "onboarding-gate:demo-mode-metadata-ready",
    label: "Demo mode metadata ready",
    description:
      "Demo readiness is described as metadata only; no UI route or demo runtime is created here.",
    evidence_ids: [
      "phase-12:command-center-ui",
      "phase-20a2:final-readiness-report",
    ],
    satisfied_by_contract: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    gate_id: "onboarding-gate:first-safe-run-approval-governed",
    label: "First safe run approval governed",
    description:
      "Any future real action remains approval-gated and cannot bypass Phase 18 governance.",
    evidence_ids: ["phase-18:approval-gated-execution-layer"],
    satisfied_by_contract: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    gate_id: "onboarding-gate:no-new-capabilities",
    label: "No new capabilities",
    description:
      "Phase 20C.1 defines onboarding readiness only and adds no installer, runtime, provider, UI, device, or authority capability.",
    evidence_ids: ["phase-20c1:onboarding-readiness-contract"],
    satisfied_by_contract: true,
    safety_posture: SAFETY_POSTURE,
  },
] satisfies readonly OnboardingGate[];

const STEPS = [
  {
    step_id: "onboarding-step:clone-readiness",
    label: "Clone readiness",
    category: "clone",
    sequence: 1,
    readiness_goal:
      "A fresh user can identify the repository clone as the starting point for local-first setup.",
    required_gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    evidence_ids: ["phase-20b1:bootstrap-readiness-contract"],
    local_first: true,
    cloud_gated: false,
    disabled_by_default: false,
    requires_approval_before_real_action: false,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:dependency-readiness",
    label: "Dependency install readiness",
    category: "dependencies",
    sequence: 2,
    readiness_goal:
      "Dependency installation expectations are documented for future onboarding without executing installation here.",
    required_gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    evidence_ids: [
      "bootstrap-req:npm-pnpm",
      "bootstrap-validation:package-manager",
    ],
    local_first: true,
    cloud_gated: false,
    disabled_by_default: false,
    requires_approval_before_real_action: false,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:environment-configuration-readiness",
    label: "Environment configuration readiness",
    category: "environment",
    sequence: 3,
    readiness_goal:
      "Environment defaults preserve local-only, remote-dashboard-disabled, and provider-disabled posture.",
    required_gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    evidence_ids: [
      "bootstrap-req:required-env-files",
      "bootstrap-validation:env-safe-defaults",
    ],
    local_first: true,
    cloud_gated: true,
    disabled_by_default: true,
    requires_approval_before_real_action: false,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:doctor-check-readiness",
    label: "Doctor check readiness",
    category: "doctor",
    sequence: 4,
    readiness_goal:
      "The user can verify safe local prerequisites through the Phase 20B doctor path when they choose to run it.",
    required_gate_ids: [
      "onboarding-gate:phase-20b-bootstrap-ready",
      "onboarding-gate:doctor-cli-report-available",
    ],
    evidence_ids: [
      "phase-20b6:safe-local-doctor-runtime",
      "phase-20b7:doctor-cli-adapter",
    ],
    local_first: true,
    cloud_gated: false,
    disabled_by_default: false,
    requires_approval_before_real_action: false,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:demo-mode-readiness",
    label: "Demo mode readiness",
    category: "demo",
    sequence: 5,
    readiness_goal:
      "Demo mode can be explained as metadata and existing Command Center contracts without creating a route.",
    required_gate_ids: ["onboarding-gate:demo-mode-metadata-ready"],
    evidence_ids: [
      "phase-12:command-center-ui",
      "phase-20a2:final-readiness-report",
    ],
    local_first: true,
    cloud_gated: false,
    disabled_by_default: false,
    requires_approval_before_real_action: false,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:fake-room-readiness",
    label: "Fake room readiness",
    category: "fake_room",
    sequence: 6,
    readiness_goal:
      "Fake room onboarding remains simulation-first and cannot reach real devices from this contract.",
    required_gate_ids: ["onboarding-gate:first-safe-run-approval-governed"],
    evidence_ids: [
      "phase-10:room-os-foundation",
      "phase-16:room-adapter-runtime",
    ],
    local_first: true,
    cloud_gated: false,
    disabled_by_default: false,
    requires_approval_before_real_action: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:local-model-readiness",
    label: "Local model readiness",
    category: "local_model",
    sequence: 7,
    readiness_goal:
      "Local model readiness is documented as local-first while cloud fallback remains gated and disabled by default.",
    required_gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    evidence_ids: ["bootstrap-req:ollama", "bootstrap-req:local-model-runtime"],
    local_first: true,
    cloud_gated: true,
    disabled_by_default: false,
    requires_approval_before_real_action: false,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:voice-readiness",
    label: "Voice readiness",
    category: "voice",
    sequence: 8,
    readiness_goal:
      "Voice onboarding remains push-to-talk/local-prerequisite oriented; wake word and always-listening are not enabled.",
    required_gate_ids: ["onboarding-gate:no-new-capabilities"],
    evidence_ids: [
      "phase-14:voice-runtime",
      "bootstrap-req:voice-runtime-prerequisites",
    ],
    local_first: true,
    cloud_gated: true,
    disabled_by_default: true,
    requires_approval_before_real_action: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:vision-readiness",
    label: "Vision readiness",
    category: "vision",
    sequence: 9,
    readiness_goal:
      "Vision onboarding remains local-prerequisite and foreground-only; background camera and hidden capture stay disabled.",
    required_gate_ids: ["onboarding-gate:no-new-capabilities"],
    evidence_ids: [
      "phase-15:vision-runtime",
      "bootstrap-req:vision-runtime-prerequisites",
    ],
    local_first: true,
    cloud_gated: true,
    disabled_by_default: true,
    requires_approval_before_real_action: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:command-center-readiness",
    label: "Command Center readiness",
    category: "command_center",
    sequence: 10,
    readiness_goal:
      "Command Center onboarding remains observability-only and does not create run, retry, or mutation affordances.",
    required_gate_ids: [
      "onboarding-gate:phase-20a-governance-ready",
      "onboarding-gate:first-safe-run-approval-governed",
    ],
    evidence_ids: [
      "phase-12:command-center-ui",
      "phase-20a4:final-authority-surface-inventory",
    ],
    local_first: true,
    cloud_gated: false,
    disabled_by_default: false,
    requires_approval_before_real_action: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:packaging-readiness",
    label: "Packaging readiness",
    category: "packaging",
    sequence: 11,
    readiness_goal:
      "Packaging readiness is documented for later Phase 20 slices without building or signing artifacts here.",
    required_gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    evidence_ids: ["bootstrap-req:tauri", "phase-20b:phase-20c-ready"],
    local_first: true,
    cloud_gated: false,
    disabled_by_default: false,
    requires_approval_before_real_action: false,
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-step:first-safe-run-readiness",
    label: "First safe run readiness",
    category: "command_center",
    sequence: 12,
    readiness_goal:
      "First safe run is framed as approval-governed, local-first, and non-autonomous until a future approved runtime path exists.",
    required_gate_ids: [
      "onboarding-gate:phase-20a-governance-ready",
      "onboarding-gate:first-safe-run-approval-governed",
      "onboarding-gate:no-new-capabilities",
    ],
    evidence_ids: [
      "phase-18:approval-gated-execution-layer",
      "phase-20a6:final-readiness-layer-closeout",
    ],
    local_first: true,
    cloud_gated: false,
    disabled_by_default: true,
    requires_approval_before_real_action: true,
    safety_posture: SAFETY_POSTURE,
  },
] satisfies readonly OnboardingStep[];

const DEFERRED_ITEMS = [
  {
    deferred_item_id: "onboarding-deferred:real-device-onboarding",
    label: "Real device onboarding",
    category: "deferred",
    deferred_reason:
      "Real devices require future explicit adapter onboarding, approval posture, and closeout review.",
    future_phase_posture: "deferred_to_later_phase_with_approval_governance",
    architecture_amendment_required: false,
    remains_disabled: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    deferred_item_id: "onboarding-deferred:wake-word",
    label: "Wake word",
    category: "voice",
    deferred_reason:
      "Wake word remains disabled and is not part of Phase 20C.1 onboarding readiness.",
    future_phase_posture:
      "future_architecture_update_required_before_enablement",
    architecture_amendment_required: true,
    remains_disabled: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    deferred_item_id:
      "onboarding-deferred:conversation-mode-architecture-amendment",
    label: "Conversation-mode architecture amendment",
    category: "voice",
    deferred_reason:
      "Conversation mode requires a future architecture amendment and is noted here only as deferred scope.",
    future_phase_posture: "future_architecture_update_not_enabled_here",
    architecture_amendment_required: true,
    remains_disabled: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    deferred_item_id: "onboarding-deferred:cloud-provider-defaults",
    label: "Cloud provider defaults",
    category: "deferred",
    deferred_reason:
      "Cloud providers remain disabled by default and require explicit governed opt-in before use.",
    future_phase_posture: "cloud_gated_and_disabled_by_default",
    architecture_amendment_required: false,
    remains_disabled: true,
    safety_posture: SAFETY_POSTURE,
  },
  {
    deferred_item_id: "onboarding-deferred:whole-home-multi-room",
    label: "Whole-home and multi-room onboarding",
    category: "deferred",
    deferred_reason:
      "Whole-home control remains out of scope until device authority and approval boundaries are explicitly expanded.",
    future_phase_posture: "deferred_real_device_authority_scope",
    architecture_amendment_required: false,
    remains_disabled: true,
    safety_posture: SAFETY_POSTURE,
  },
] satisfies readonly OnboardingDeferredItem[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyContract(
  contract: OnboardingReadinessContract,
): OnboardingReadinessContract {
  return OnboardingReadinessContractSchema.parse(
    JSON.parse(JSON.stringify(contract)),
  );
}

function copyStep(step: OnboardingStep): OnboardingStep {
  return OnboardingStepSchema.parse(JSON.parse(JSON.stringify(step)));
}

function copyGate(gate: OnboardingGate): OnboardingGate {
  return OnboardingGateSchema.parse(JSON.parse(JSON.stringify(gate)));
}

function copyDeferredItem(
  item: OnboardingDeferredItem,
): OnboardingDeferredItem {
  return OnboardingDeferredItemSchema.parse(JSON.parse(JSON.stringify(item)));
}

export const ONBOARDING_READINESS_CONTRACT = deepFreeze(
  OnboardingReadinessContractSchema.parse({
    contract_version: ONBOARDING_READINESS_CONTRACT_VERSION,
    contract_id: "phase-20c1-onboarding-readiness-contract",
    phase: "20C.1",
    summary:
      "Metadata-only onboarding readiness contract describing clone to bootstrap to doctor to demo to first safe run without adding installer automation or runtime capability.",
    categories: [...ONBOARDING_READINESS_CATEGORIES],
    steps: STEPS,
    gates: GATES,
    deferred_items: DEFERRED_ITEMS,
    safety_posture: SAFETY_POSTURE,
  }),
);

export function getOnboardingReadinessContract(): OnboardingReadinessContract {
  const phase20a = buildPhase20ACloseoutReport();
  const phase20b = buildPhase20BCloseoutReport();

  if (
    phase20a.verdict !== "pass" ||
    phase20b.verdict !== "passed" ||
    !phase20b.phase_20c_ready
  ) {
    throw new Error("Phase 20A/20B readiness prerequisites are not satisfied");
  }

  return copyContract(ONBOARDING_READINESS_CONTRACT);
}

export function getOnboardingSteps(): readonly OnboardingStep[] {
  return ONBOARDING_READINESS_CONTRACT.steps.map(copyStep);
}

export function getOnboardingGates(): readonly OnboardingGate[] {
  return ONBOARDING_READINESS_CONTRACT.gates.map(copyGate);
}

export function getDeferredOnboardingItems(): readonly OnboardingDeferredItem[] {
  return ONBOARDING_READINESS_CONTRACT.deferred_items.map(copyDeferredItem);
}

export function summarizeOnboardingReadiness(): OnboardingReadinessSummary {
  const steps = ONBOARDING_READINESS_CONTRACT.steps;
  const deferredItems = ONBOARDING_READINESS_CONTRACT.deferred_items;
  const categoryCounts = Object.fromEntries(
    ONBOARDING_READINESS_CATEGORIES.map((category) => [
      category,
      steps.filter((step) => step.category === category).length +
        deferredItems.filter((item) => item.category === category).length,
    ]),
  ) as Record<OnboardingReadinessCategory, number>;

  return OnboardingReadinessSummarySchema.parse({
    contract_version: ONBOARDING_READINESS_CONTRACT_VERSION,
    step_count: steps.length,
    gate_count: ONBOARDING_READINESS_CONTRACT.gates.length,
    deferred_item_count: deferredItems.length,
    category_counts: categoryCounts,
    local_first_step_count: steps.filter((step) => step.local_first).length,
    cloud_gated_step_count: steps.filter((step) => step.cloud_gated).length,
    disabled_by_default_step_count: steps.filter(
      (step) => step.disabled_by_default,
    ).length,
    approval_guarded_step_count: steps.filter(
      (step) => step.requires_approval_before_real_action,
    ).length,
    architecture_amendment_deferred_count: deferredItems.filter(
      (item) => item.architecture_amendment_required,
    ).length,
    phase20c_contract_only: true,
    phase20c_capability_neutral: true,
    safety_posture: SAFETY_POSTURE,
  });
}
