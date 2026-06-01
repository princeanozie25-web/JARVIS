import { z } from "zod";

import {
  OnboardingSafetyPostureSchema,
  type OnboardingSafetyPosture,
} from "./contracts";
import {
  OnboardingStepRecordIdSchema,
  getOnboardingStepRegistry,
  type OnboardingStepRecordId,
} from "./steps";

export const MOVE_IN_CHECKLIST_VERSION = "20C.5" as const;

export const MOVE_IN_CHECKLIST_CATEGORIES = [
  "workspace",
  "dependencies",
  "environment",
  "validation",
  "demo",
  "room",
  "command_center",
  "local_model",
  "voice",
  "vision",
  "first_safe_run",
  "deferred",
  "safety",
] as const;

export const MOVE_IN_CHECKLIST_STATUSES = [
  "required",
  "recommended",
  "deferred",
  "safety_reminder",
] as const;

export const MOVE_IN_CHECKLIST_ITEM_IDS = [
  "move-in:fresh-clone-complete",
  "move-in:dependencies-installed",
  "move-in:doctor-report-reviewed",
  "move-in:tests-passed",
  "move-in:env-configured",
  "move-in:demo-mode-verified",
  "move-in:fake-room-verified",
  "move-in:command-center-opens",
  "move-in:local-model-readiness-checked",
  "move-in:voice-readiness-checked",
  "move-in:vision-readiness-checked",
  "move-in:first-safe-run-rehearsed",
  "move-in:real-hue-device-onboarding-deferred",
  "move-in:wake-word-conversation-mode-amendment-deferred",
  "move-in:voice-authorisation-tiers-deferred",
  "move-in:final-safety-approval-reminder",
] as const;

export type MoveInChecklistCategory =
  (typeof MOVE_IN_CHECKLIST_CATEGORIES)[number];
export type MoveInChecklistStatus = (typeof MOVE_IN_CHECKLIST_STATUSES)[number];
export type MoveInChecklistItemId = (typeof MOVE_IN_CHECKLIST_ITEM_IDS)[number];

export const MoveInChecklistCategorySchema = z.enum(
  MOVE_IN_CHECKLIST_CATEGORIES,
);
export const MoveInChecklistStatusSchema = z.enum(MOVE_IN_CHECKLIST_STATUSES);
export const MoveInChecklistItemIdSchema = z.enum(MOVE_IN_CHECKLIST_ITEM_IDS);

export const MoveInChecklistItemSchema = z.strictObject({
  item_id: MoveInChecklistItemIdSchema,
  label: z.string().trim().min(1).max(180),
  category: MoveInChecklistCategorySchema,
  status: MoveInChecklistStatusSchema,
  required_before_move_in: z.boolean(),
  deferred: z.boolean(),
  source_step_ids: z.array(OnboardingStepRecordIdSchema),
  evidence_ids: z.array(z.string().trim().min(1).max(180)).min(1),
  readiness_expectation: z.string().trim().min(1).max(420),
  safety_notes: z.array(z.string().trim().min(1).max(320)).min(1),
  safety_posture: OnboardingSafetyPostureSchema,
});

export const MoveInChecklistSummarySchema = z.strictObject({
  checklist_version: z.literal(MOVE_IN_CHECKLIST_VERSION),
  item_count: z.number().int().positive(),
  required_item_count: z.number().int().nonnegative(),
  deferred_item_count: z.number().int().nonnegative(),
  safety_reminder_count: z.number().int().nonnegative(),
  category_counts: z.record(
    MoveInChecklistCategorySchema,
    z.number().int().nonnegative(),
  ),
  phase20c_checklist_only: z.literal(true),
  phase20c_capability_neutral: z.literal(true),
  safety_posture: OnboardingSafetyPostureSchema,
});

export type MoveInChecklistItem = z.infer<typeof MoveInChecklistItemSchema>;
export type MoveInChecklistSummary = z.infer<
  typeof MoveInChecklistSummarySchema
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

const CHECKLIST = [
  {
    item_id: "move-in:fresh-clone-complete",
    label: "Fresh clone complete",
    category: "workspace",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:clone-repository"],
    evidence_ids: ["phase-20c2:onboarding-sequence:clone-repository"],
    readiness_expectation:
      "The local repository clone is present before bedroom or room move-in review.",
    safety_notes: [
      "This checklist does not clone, pull, or modify repository content.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:dependencies-installed",
    label: "Dependencies installed",
    category: "dependencies",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:install-dependencies"],
    evidence_ids: ["phase-20c2:onboarding-sequence:install-dependencies"],
    readiness_expectation:
      "Dependency installation has been completed manually by the user before move-in validation.",
    safety_notes: [
      "No package manager, installer, or process invocation is exposed by this checklist.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:doctor-report-reviewed",
    label: "Doctor report reviewed",
    category: "validation",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:run-doctor"],
    evidence_ids: ["phase-20c4:onboarding-report:gate-dependency-readiness"],
    readiness_expectation:
      "The safe local doctor report has been reviewed for blockers before move-in.",
    safety_notes: [
      "The checklist references the report path but does not run doctor checks.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:tests-passed",
    label: "Tests passed",
    category: "validation",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:run-tests"],
    evidence_ids: ["phase-20c2:onboarding-sequence:run-tests"],
    readiness_expectation:
      "Project tests have passed before room-ready use is treated as validated.",
    safety_notes: [
      "No test runner hook or shell execution is provided by this checklist.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:env-configured",
    label: "Env configured",
    category: "environment",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:prepare-env-file"],
    evidence_ids: ["phase-20c2:onboarding-sequence:prepare-env-file"],
    readiness_expectation:
      "Environment configuration preserves local-first, cloud-gated, disabled-provider defaults.",
    safety_notes: [
      "This checklist does not read, copy, write, or populate env files.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:demo-mode-verified",
    label: "Demo mode verified",
    category: "demo",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:enable-demo-mode"],
    evidence_ids: ["phase-20c4:onboarding-report:demo-fake-room-readiness"],
    readiness_expectation:
      "Demo mode has been verified as metadata-only and safe for presentation or rehearsal.",
    safety_notes: [
      "No demo toggle, route, or runtime mutation is created by this checklist.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:fake-room-verified",
    label: "Fake room verified",
    category: "room",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:verify-fake-room"],
    evidence_ids: ["phase-20c4:onboarding-report:demo-fake-room-readiness"],
    readiness_expectation:
      "Fake room simulation is verified before any real room or hardware onboarding is considered.",
    safety_notes: [
      "Real room, Hue, and device actions remain deferred and approval-governed.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:command-center-opens",
    label: "Command Center opens",
    category: "command_center",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:open-command-center"],
    evidence_ids: ["phase-20c2:onboarding-sequence:open-command-center"],
    readiness_expectation:
      "Command Center can be opened for observation without adding run, retry, or mutation affordances.",
    safety_notes: [
      "This checklist adds no UI route, browser action, or command surface.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:local-model-readiness-checked",
    label: "Local model readiness checked",
    category: "local_model",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:verify-local-model-readiness"],
    evidence_ids: [
      "phase-20c2:onboarding-sequence:verify-local-model-readiness",
    ],
    readiness_expectation:
      "Local model readiness has been checked while cloud fallback remains gated and disabled by default.",
    safety_notes: [
      "No Ollama, model runtime, provider, or network call is made by this checklist.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:voice-readiness-checked",
    label: "Voice readiness checked",
    category: "voice",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:verify-voice-readiness"],
    evidence_ids: ["phase-20c2:onboarding-sequence:verify-voice-readiness"],
    readiness_expectation:
      "Voice readiness has been checked while wake-word, always-listening, and voice-only approval remain disabled.",
    safety_notes: [
      "No microphone, STT/TTS runtime, wake-word, or conversation-mode capability is enabled.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:vision-readiness-checked",
    label: "Vision readiness checked",
    category: "vision",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:verify-vision-readiness"],
    evidence_ids: ["phase-20c2:onboarding-sequence:verify-vision-readiness"],
    readiness_expectation:
      "Vision readiness has been checked while hidden capture and background camera remain disabled.",
    safety_notes: [
      "No camera, capture runtime, provider call, or hidden capture path is enabled.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:first-safe-run-rehearsed",
    label: "First safe run rehearsed",
    category: "first_safe_run",
    status: "required",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:verify-first-safe-run"],
    evidence_ids: ["phase-20c4:onboarding-report:first-safe-run-readiness"],
    readiness_expectation:
      "First safe run has been rehearsed as approval-governed, local-first, and non-autonomous.",
    safety_notes: [
      "This checklist does not execute tools, routines, schedules, rooms, or devices.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:real-hue-device-onboarding-deferred",
    label: "Real Hue/device onboarding deferred",
    category: "deferred",
    status: "deferred",
    required_before_move_in: false,
    deferred: true,
    source_step_ids: ["onboarding-sequence:defer-real-device-onboarding"],
    evidence_ids: ["phase-20c4:onboarding-report:deferred-real-device"],
    readiness_expectation:
      "Real Hue or device onboarding stays deferred until configuration and hardware are present and explicitly governed.",
    safety_notes: [
      "No Hue bridge, room adapter, device discovery, or real-world control surface is added.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:wake-word-conversation-mode-amendment-deferred",
    label: "Wake-word/conversation-mode amendment deferred",
    category: "deferred",
    status: "deferred",
    required_before_move_in: false,
    deferred: true,
    source_step_ids: [
      "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
    ],
    evidence_ids: [
      "phase-20c4:onboarding-report:deferred-wake-word-conversation-mode",
    ],
    readiness_expectation:
      "Wake-word and conversation-mode remain deferred until a future architecture update.",
    safety_notes: [
      "No wake-word, always-listening, or continuous conversation affordance is enabled.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:voice-authorisation-tiers-deferred",
    label: "Voice-authorisation tiers deferred",
    category: "deferred",
    status: "deferred",
    required_before_move_in: false,
    deferred: true,
    source_step_ids: [
      "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
    ],
    evidence_ids: ["phase-20c5:voice-authorisation-tiers-deferred"],
    readiness_expectation:
      "Voice-authorisation tiers remain deferred until architecture explicitly defines them.",
    safety_notes: [
      "No voice-only approval, auto-approval, or new authorisation tier is created.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
  {
    item_id: "move-in:final-safety-approval-reminder",
    label: "Final safety reminder",
    category: "safety",
    status: "safety_reminder",
    required_before_move_in: true,
    deferred: false,
    source_step_ids: ["onboarding-sequence:verify-first-safe-run"],
    evidence_ids: ["phase-18:approval-gated-execution-layer"],
    readiness_expectation:
      "No destructive or real-world action is allowed without explicit approval posture.",
    safety_notes: [
      "Approval governance remains mandatory for room, device, routine, schedule, tool, and provider action.",
    ],
    safety_posture: SAFETY_POSTURE,
  },
] satisfies readonly MoveInChecklistItem[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyChecklistItem(item: MoveInChecklistItem): MoveInChecklistItem {
  return MoveInChecklistItemSchema.parse(JSON.parse(JSON.stringify(item)));
}

function assertAlignedWithStepRegistry(): void {
  const knownStepIds = new Set<OnboardingStepRecordId>(
    getOnboardingStepRegistry().steps.map((step) => step.step_id),
  );

  for (const item of MOVE_IN_READINESS_CHECKLIST) {
    for (const sourceStepId of item.source_step_ids) {
      if (!knownStepIds.has(sourceStepId)) {
        throw new Error(
          `Unknown onboarding step for move-in item: ${sourceStepId}`,
        );
      }
    }
  }
}

export const MOVE_IN_READINESS_CHECKLIST = deepFreeze(
  CHECKLIST.map((item) => MoveInChecklistItemSchema.parse(item)),
);

export function getMoveInReadinessChecklist(): readonly MoveInChecklistItem[] {
  assertAlignedWithStepRegistry();
  return MOVE_IN_READINESS_CHECKLIST.map(copyChecklistItem);
}

export function getMoveInChecklistByCategory(
  category: MoveInChecklistCategory,
): readonly MoveInChecklistItem[] {
  return MOVE_IN_READINESS_CHECKLIST.filter(
    (item) => item.category === category,
  ).map(copyChecklistItem);
}

export function getRequiredMoveInChecklistItems(): readonly MoveInChecklistItem[] {
  return MOVE_IN_READINESS_CHECKLIST.filter(
    (item) => item.required_before_move_in,
  ).map(copyChecklistItem);
}

export function getDeferredMoveInChecklistItems(): readonly MoveInChecklistItem[] {
  return MOVE_IN_READINESS_CHECKLIST.filter((item) => item.deferred).map(
    copyChecklistItem,
  );
}

export function summarizeMoveInChecklist(): MoveInChecklistSummary {
  const categoryCounts = Object.fromEntries(
    MOVE_IN_CHECKLIST_CATEGORIES.map((category) => [
      category,
      MOVE_IN_READINESS_CHECKLIST.filter((item) => item.category === category)
        .length,
    ]),
  ) as Record<MoveInChecklistCategory, number>;

  return MoveInChecklistSummarySchema.parse({
    checklist_version: MOVE_IN_CHECKLIST_VERSION,
    item_count: MOVE_IN_READINESS_CHECKLIST.length,
    required_item_count: MOVE_IN_READINESS_CHECKLIST.filter(
      (item) => item.required_before_move_in,
    ).length,
    deferred_item_count: MOVE_IN_READINESS_CHECKLIST.filter(
      (item) => item.deferred,
    ).length,
    safety_reminder_count: MOVE_IN_READINESS_CHECKLIST.filter(
      (item) => item.status === "safety_reminder",
    ).length,
    category_counts: categoryCounts,
    phase20c_checklist_only: true,
    phase20c_capability_neutral: true,
    safety_posture: SAFETY_POSTURE,
  });
}
