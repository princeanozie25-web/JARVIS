import { z } from "zod";

import {
  ONBOARDING_READINESS_CATEGORIES,
  ONBOARDING_READINESS_CONTRACT_VERSION,
  OnboardingDeferredItemIdSchema,
  OnboardingGateIdSchema,
  OnboardingReadinessCategorySchema,
  OnboardingSafetyPostureSchema,
  OnboardingStepIdSchema,
  type OnboardingDeferredItemId,
  type OnboardingGateId,
  type OnboardingReadinessCategory,
  type OnboardingSafetyPosture,
  type OnboardingStepId,
} from "./contracts";
import { getOnboardingReadinessContract } from "./registry";

export const ONBOARDING_STEP_REGISTRY_VERSION = "20C.2" as const;

export const ONBOARDING_STEP_RECORD_IDS = [
  "onboarding-sequence:clone-repository",
  "onboarding-sequence:install-dependencies",
  "onboarding-sequence:prepare-env-file",
  "onboarding-sequence:run-doctor",
  "onboarding-sequence:run-tests",
  "onboarding-sequence:start-dev-runtime",
  "onboarding-sequence:open-command-center",
  "onboarding-sequence:enable-demo-mode",
  "onboarding-sequence:verify-fake-room",
  "onboarding-sequence:verify-local-model-readiness",
  "onboarding-sequence:verify-voice-readiness",
  "onboarding-sequence:verify-vision-readiness",
  "onboarding-sequence:verify-first-safe-run",
  "onboarding-sequence:defer-real-device-onboarding",
  "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
] as const;

export const ONBOARDING_STEP_STATUS_EXPECTATIONS = [
  "documented_ready",
  "manual_user_action_expected",
  "safe_local_check_expected",
  "metadata_demo_expected",
  "deferred_until_future_architecture",
] as const;

export const ONBOARDING_STEP_BLOCKING_POSTURES = [
  "blocking",
  "non_blocking",
  "deferred",
] as const;

export type OnboardingStepRecordId =
  (typeof ONBOARDING_STEP_RECORD_IDS)[number];
export type OnboardingStepStatusExpectation =
  (typeof ONBOARDING_STEP_STATUS_EXPECTATIONS)[number];
export type OnboardingStepBlockingPosture =
  (typeof ONBOARDING_STEP_BLOCKING_POSTURES)[number];

export const OnboardingStepRecordIdSchema = z.enum(ONBOARDING_STEP_RECORD_IDS);
export const OnboardingStepStatusExpectationSchema = z.enum(
  ONBOARDING_STEP_STATUS_EXPECTATIONS,
);
export const OnboardingStepBlockingPostureSchema = z.enum(
  ONBOARDING_STEP_BLOCKING_POSTURES,
);

export const OnboardingStepRecordSchema = z.strictObject({
  step_id: OnboardingStepRecordIdSchema,
  title: z.string().trim().min(1).max(160),
  category: OnboardingReadinessCategorySchema,
  sequence_order: z.number().int().positive(),
  gate_ids: z.array(OnboardingGateIdSchema),
  dependency_step_ids: z.array(OnboardingStepRecordIdSchema),
  source_contract_step_ids: z.array(OnboardingStepIdSchema),
  deferred_item_ids: z.array(OnboardingDeferredItemIdSchema),
  expected_reference: z.string().trim().min(1).max(240),
  readiness_expectation: z.string().trim().min(1).max(420),
  status_expectation: OnboardingStepStatusExpectationSchema,
  blocking_posture: OnboardingStepBlockingPostureSchema,
  deferred: z.boolean(),
  safety_notes: z.array(z.string().trim().min(1).max(260)).min(1),
  safety_posture: OnboardingSafetyPostureSchema,
});

export const OnboardingStepRegistrySchema = z.strictObject({
  registry_version: z.literal(ONBOARDING_STEP_REGISTRY_VERSION),
  source_contract_version: z.literal(ONBOARDING_READINESS_CONTRACT_VERSION),
  registry_id: z.literal("phase-20c2-onboarding-step-registry"),
  phase: z.literal("20C.2"),
  steps: z.array(OnboardingStepRecordSchema),
  safety_posture: OnboardingSafetyPostureSchema,
});

export const OnboardingStepRegistrySummarySchema = z.strictObject({
  registry_version: z.literal(ONBOARDING_STEP_REGISTRY_VERSION),
  step_count: z.number().int().positive(),
  blocking_step_count: z.number().int().nonnegative(),
  non_blocking_step_count: z.number().int().nonnegative(),
  deferred_step_count: z.number().int().nonnegative(),
  category_counts: z.record(
    OnboardingReadinessCategorySchema,
    z.number().int().nonnegative(),
  ),
  gate_reference_count: z.number().int().nonnegative(),
  dependency_reference_count: z.number().int().nonnegative(),
  source_contract_step_reference_count: z.number().int().nonnegative(),
  deferred_item_reference_count: z.number().int().nonnegative(),
  phase20c_step_registry_only: z.literal(true),
  phase20c_capability_neutral: z.literal(true),
  safety_posture: OnboardingSafetyPostureSchema,
});

export type OnboardingStepRecord = z.infer<typeof OnboardingStepRecordSchema>;
export type OnboardingStepRegistry = z.infer<
  typeof OnboardingStepRegistrySchema
>;
export type OnboardingStepRegistrySummary = z.infer<
  typeof OnboardingStepRegistrySummarySchema
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

const STEPS = [
  {
    step_id: "onboarding-sequence:clone-repository",
    title: "Clone repository",
    category: "clone",
    sequence_order: 1,
    gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    dependency_step_ids: [],
    source_contract_step_ids: ["onboarding-step:clone-readiness"],
    deferred_item_ids: [],
    expected_reference: "README clone and local workspace reference",
    readiness_expectation:
      "A fresh user can identify the repository clone as the local-first starting point.",
    status_expectation: "documented_ready",
    blocking_posture: "blocking",
    deferred: false,
    safety_notes: [
      "This record documents clone readiness only and does not create clone automation.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:install-dependencies",
    title: "Install dependencies",
    category: "dependencies",
    sequence_order: 2,
    gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    dependency_step_ids: ["onboarding-sequence:clone-repository"],
    source_contract_step_ids: ["onboarding-step:dependency-readiness"],
    deferred_item_ids: [],
    expected_reference: "README dependency installation reference",
    readiness_expectation:
      "Dependency installation expectations are documented for the user to perform manually.",
    status_expectation: "manual_user_action_expected",
    blocking_posture: "blocking",
    deferred: false,
    safety_notes: [
      "No installer, package-manager invocation, or environment mutation is exposed.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:prepare-env-file",
    title: "Prepare env file",
    category: "environment",
    sequence_order: 3,
    gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    dependency_step_ids: ["onboarding-sequence:install-dependencies"],
    source_contract_step_ids: [
      "onboarding-step:environment-configuration-readiness",
    ],
    deferred_item_ids: [],
    expected_reference: "Environment defaults and env example reference",
    readiness_expectation:
      "Environment setup preserves local-first, cloud-gated, disabled-provider defaults.",
    status_expectation: "manual_user_action_expected",
    blocking_posture: "blocking",
    deferred: false,
    safety_notes: [
      "This registry does not write, copy, or populate environment files.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:run-doctor",
    title: "Run doctor",
    category: "doctor",
    sequence_order: 4,
    gate_ids: [
      "onboarding-gate:phase-20b-bootstrap-ready",
      "onboarding-gate:doctor-cli-report-available",
    ],
    dependency_step_ids: ["onboarding-sequence:prepare-env-file"],
    source_contract_step_ids: ["onboarding-step:doctor-check-readiness"],
    deferred_item_ids: [],
    expected_reference: "Doctor CLI documentation reference",
    readiness_expectation:
      "The safe local doctor path can be invoked by the user outside this metadata registry.",
    status_expectation: "safe_local_check_expected",
    blocking_posture: "blocking",
    deferred: false,
    safety_notes: [
      "No doctor runtime, shell, process, or filesystem inspection is invoked by this record.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:run-tests",
    title: "Run tests",
    category: "doctor",
    sequence_order: 5,
    gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    dependency_step_ids: ["onboarding-sequence:run-doctor"],
    source_contract_step_ids: ["onboarding-step:doctor-check-readiness"],
    deferred_item_ids: [],
    expected_reference: "Project validation test documentation reference",
    readiness_expectation:
      "Test execution is an expected user validation step, not an automated action from Phase 20C.2.",
    status_expectation: "manual_user_action_expected",
    blocking_posture: "blocking",
    deferred: false,
    safety_notes: [
      "This registry contains no test runner hook or process-spawn affordance.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:start-dev-runtime",
    title: "Start dev runtime",
    category: "packaging",
    sequence_order: 6,
    gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    dependency_step_ids: ["onboarding-sequence:run-tests"],
    source_contract_step_ids: ["onboarding-step:packaging-readiness"],
    deferred_item_ids: [],
    expected_reference: "Development runtime documentation reference",
    readiness_expectation:
      "Development runtime startup is documented for the user and remains outside this registry.",
    status_expectation: "manual_user_action_expected",
    blocking_posture: "blocking",
    deferred: false,
    safety_notes: [
      "No dev server, Tauri runtime, or background process is started here.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:open-command-center",
    title: "Open Command Center",
    category: "command_center",
    sequence_order: 7,
    gate_ids: [
      "onboarding-gate:phase-20a-governance-ready",
      "onboarding-gate:first-safe-run-approval-governed",
    ],
    dependency_step_ids: ["onboarding-sequence:start-dev-runtime"],
    source_contract_step_ids: ["onboarding-step:command-center-readiness"],
    deferred_item_ids: [],
    expected_reference: "Command Center local app documentation reference",
    readiness_expectation:
      "Command Center onboarding remains observational and does not add run, retry, or mutation controls.",
    status_expectation: "manual_user_action_expected",
    blocking_posture: "blocking",
    deferred: false,
    safety_notes: [
      "This record does not create a route, browser automation, or UI action affordance.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:enable-demo-mode",
    title: "Enable demo mode",
    category: "demo",
    sequence_order: 8,
    gate_ids: ["onboarding-gate:demo-mode-metadata-ready"],
    dependency_step_ids: ["onboarding-sequence:open-command-center"],
    source_contract_step_ids: ["onboarding-step:demo-mode-readiness"],
    deferred_item_ids: [],
    expected_reference: "Demo mode documentation reference",
    readiness_expectation:
      "Demo readiness stays metadata-only and uses existing safe demo posture.",
    status_expectation: "metadata_demo_expected",
    blocking_posture: "non_blocking",
    deferred: false,
    safety_notes: [
      "No demo runtime toggle, device action, or command center mutation is introduced.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:verify-fake-room",
    title: "Verify fake room",
    category: "fake_room",
    sequence_order: 9,
    gate_ids: ["onboarding-gate:first-safe-run-approval-governed"],
    dependency_step_ids: ["onboarding-sequence:enable-demo-mode"],
    source_contract_step_ids: ["onboarding-step:fake-room-readiness"],
    deferred_item_ids: [],
    expected_reference: "Fake room verification documentation reference",
    readiness_expectation:
      "Fake room readiness remains simulation-first and cannot reach real devices.",
    status_expectation: "metadata_demo_expected",
    blocking_posture: "non_blocking",
    deferred: false,
    safety_notes: [
      "Real room and device actions remain deferred and approval-governed.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:verify-local-model-readiness",
    title: "Verify local model readiness",
    category: "local_model",
    sequence_order: 10,
    gate_ids: ["onboarding-gate:phase-20b-bootstrap-ready"],
    dependency_step_ids: ["onboarding-sequence:verify-fake-room"],
    source_contract_step_ids: ["onboarding-step:local-model-readiness"],
    deferred_item_ids: [],
    expected_reference: "Local model readiness documentation reference",
    readiness_expectation:
      "Local model readiness remains local-first; cloud provider fallback remains gated.",
    status_expectation: "safe_local_check_expected",
    blocking_posture: "non_blocking",
    deferred: false,
    safety_notes: [
      "No Ollama, provider, model, or network call is made by this registry.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:verify-voice-readiness",
    title: "Verify voice readiness",
    category: "voice",
    sequence_order: 11,
    gate_ids: ["onboarding-gate:no-new-capabilities"],
    dependency_step_ids: ["onboarding-sequence:verify-local-model-readiness"],
    source_contract_step_ids: ["onboarding-step:voice-readiness"],
    deferred_item_ids: [],
    expected_reference: "Voice readiness documentation reference",
    readiness_expectation:
      "Voice readiness preserves push-to-talk, local-first, and disabled wake-word posture.",
    status_expectation: "safe_local_check_expected",
    blocking_posture: "non_blocking",
    deferred: false,
    safety_notes: [
      "No microphone, wake-word, always-listening, or voice runtime execution is enabled.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:verify-vision-readiness",
    title: "Verify vision readiness",
    category: "vision",
    sequence_order: 12,
    gate_ids: ["onboarding-gate:no-new-capabilities"],
    dependency_step_ids: ["onboarding-sequence:verify-voice-readiness"],
    source_contract_step_ids: ["onboarding-step:vision-readiness"],
    deferred_item_ids: [],
    expected_reference: "Vision readiness documentation reference",
    readiness_expectation:
      "Vision readiness preserves foreground-only posture and disabled hidden/background capture.",
    status_expectation: "safe_local_check_expected",
    blocking_posture: "non_blocking",
    deferred: false,
    safety_notes: [
      "No camera, capture runtime, provider call, or hidden capture path is enabled.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:verify-first-safe-run",
    title: "Verify first safe run",
    category: "command_center",
    sequence_order: 13,
    gate_ids: [
      "onboarding-gate:phase-20a-governance-ready",
      "onboarding-gate:first-safe-run-approval-governed",
      "onboarding-gate:no-new-capabilities",
    ],
    dependency_step_ids: ["onboarding-sequence:verify-vision-readiness"],
    source_contract_step_ids: ["onboarding-step:first-safe-run-readiness"],
    deferred_item_ids: [],
    expected_reference: "First safe run governance documentation reference",
    readiness_expectation:
      "First safe run remains approval-governed, local-first, and non-autonomous.",
    status_expectation: "documented_ready",
    blocking_posture: "blocking",
    deferred: false,
    safety_notes: [
      "This registry does not execute tools, devices, routines, schedules, or approval flows.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:defer-real-device-onboarding",
    title: "Defer real device onboarding",
    category: "deferred",
    sequence_order: 14,
    gate_ids: ["onboarding-gate:first-safe-run-approval-governed"],
    dependency_step_ids: ["onboarding-sequence:verify-first-safe-run"],
    source_contract_step_ids: ["onboarding-step:fake-room-readiness"],
    deferred_item_ids: ["onboarding-deferred:real-device-onboarding"],
    expected_reference: "Real device onboarding deferred scope reference",
    readiness_expectation:
      "Real device onboarding remains deferred until a future approved authority expansion.",
    status_expectation: "deferred_until_future_architecture",
    blocking_posture: "deferred",
    deferred: true,
    safety_notes: [
      "No real room, adapter, device, or whole-home action surface is added.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    step_id: "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
    title: "Defer wake-word and conversation-mode amendment",
    category: "voice",
    sequence_order: 15,
    gate_ids: ["onboarding-gate:no-new-capabilities"],
    dependency_step_ids: ["onboarding-sequence:defer-real-device-onboarding"],
    source_contract_step_ids: ["onboarding-step:voice-readiness"],
    deferred_item_ids: [
      "onboarding-deferred:wake-word",
      "onboarding-deferred:conversation-mode-architecture-amendment",
    ],
    expected_reference:
      "Wake-word and conversation-mode future architecture amendment reference",
    readiness_expectation:
      "Wake-word and conversation-mode remain disabled until architecture is updated.",
    status_expectation: "deferred_until_future_architecture",
    blocking_posture: "deferred",
    deferred: true,
    safety_notes: [
      "No wake-word, always-listening, or continuous conversation capability is enabled.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
] satisfies readonly OnboardingStepRecord[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyStepRecord(step: OnboardingStepRecord): OnboardingStepRecord {
  return OnboardingStepRecordSchema.parse(JSON.parse(JSON.stringify(step)));
}

function copyRegistry(
  registry: OnboardingStepRegistry,
): OnboardingStepRegistry {
  return OnboardingStepRegistrySchema.parse(
    JSON.parse(JSON.stringify(registry)),
  );
}

function assertAlignedWithContract(): void {
  const contract = getOnboardingReadinessContract();
  const contractStepIds = new Set<OnboardingStepId>(
    contract.steps.map((step) => step.step_id),
  );
  const gateIds = new Set<OnboardingGateId>(
    contract.gates.map((gate) => gate.gate_id),
  );
  const deferredItemIds = new Set<OnboardingDeferredItemId>(
    contract.deferred_items.map((item) => item.deferred_item_id),
  );

  for (const step of ONBOARDING_STEP_REGISTRY.steps) {
    for (const contractStepId of step.source_contract_step_ids) {
      if (!contractStepIds.has(contractStepId)) {
        throw new Error(`Unknown onboarding contract step: ${contractStepId}`);
      }
    }

    for (const gateId of step.gate_ids) {
      if (!gateIds.has(gateId)) {
        throw new Error(`Unknown onboarding gate: ${gateId}`);
      }
    }

    for (const deferredItemId of step.deferred_item_ids) {
      if (!deferredItemIds.has(deferredItemId)) {
        throw new Error(`Unknown deferred onboarding item: ${deferredItemId}`);
      }
    }
  }
}

export const ONBOARDING_STEP_REGISTRY = deepFreeze(
  OnboardingStepRegistrySchema.parse({
    registry_version: ONBOARDING_STEP_REGISTRY_VERSION,
    source_contract_version: ONBOARDING_READINESS_CONTRACT_VERSION,
    registry_id: "phase-20c2-onboarding-step-registry",
    phase: "20C.2",
    steps: STEPS,
    safety_posture: SAFETY_POSTURE,
  }),
);

export function getOnboardingStepRegistry(): OnboardingStepRegistry {
  assertAlignedWithContract();
  return copyRegistry(ONBOARDING_STEP_REGISTRY);
}

export function getOnboardingStepsByCategory(
  category: OnboardingReadinessCategory,
): readonly OnboardingStepRecord[] {
  return ONBOARDING_STEP_REGISTRY.steps
    .filter((step) => step.category === category)
    .map(copyStepRecord);
}

export function getBlockingOnboardingSteps(): readonly OnboardingStepRecord[] {
  return ONBOARDING_STEP_REGISTRY.steps
    .filter((step) => step.blocking_posture === "blocking")
    .map(copyStepRecord);
}

export function getDeferredOnboardingSteps(): readonly OnboardingStepRecord[] {
  return ONBOARDING_STEP_REGISTRY.steps
    .filter((step) => step.deferred)
    .map(copyStepRecord);
}

export function summarizeOnboardingStepRegistry(): OnboardingStepRegistrySummary {
  const steps = ONBOARDING_STEP_REGISTRY.steps;
  const categoryCounts = Object.fromEntries(
    ONBOARDING_READINESS_CATEGORIES.map((category) => [
      category,
      steps.filter((step) => step.category === category).length,
    ]),
  ) as Record<OnboardingReadinessCategory, number>;

  return OnboardingStepRegistrySummarySchema.parse({
    registry_version: ONBOARDING_STEP_REGISTRY_VERSION,
    step_count: steps.length,
    blocking_step_count: steps.filter(
      (step) => step.blocking_posture === "blocking",
    ).length,
    non_blocking_step_count: steps.filter(
      (step) => step.blocking_posture === "non_blocking",
    ).length,
    deferred_step_count: steps.filter((step) => step.deferred).length,
    category_counts: categoryCounts,
    gate_reference_count: steps.reduce(
      (count, step) => count + step.gate_ids.length,
      0,
    ),
    dependency_reference_count: steps.reduce(
      (count, step) => count + step.dependency_step_ids.length,
      0,
    ),
    source_contract_step_reference_count: steps.reduce(
      (count, step) => count + step.source_contract_step_ids.length,
      0,
    ),
    deferred_item_reference_count: steps.reduce(
      (count, step) => count + step.deferred_item_ids.length,
      0,
    ),
    phase20c_step_registry_only: true,
    phase20c_capability_neutral: true,
    safety_posture: SAFETY_POSTURE,
  });
}
