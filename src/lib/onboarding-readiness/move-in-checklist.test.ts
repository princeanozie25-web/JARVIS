import { describe, expect, it } from "vitest";

import * as onboardingReadiness from "./index";
import {
  MOVE_IN_CHECKLIST_CATEGORIES,
  MOVE_IN_CHECKLIST_ITEM_IDS,
  MOVE_IN_READINESS_CHECKLIST,
  MoveInChecklistItemSchema,
  getDeferredMoveInChecklistItems,
  getMoveInChecklistByCategory,
  getMoveInReadinessChecklist,
  getRequiredMoveInChecklistItems,
  summarizeMoveInChecklist,
} from "./index";

const REQUIRED_ITEM_IDS = [
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

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
] as const;

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

describe("Phase 20C.5 move-in readiness checklist", () => {
  it("exposes a deterministic typed metadata-only checklist", () => {
    const checklist = getMoveInReadinessChecklist();

    expect(checklist.map((item) => item.item_id)).toEqual([
      ...REQUIRED_ITEM_IDS,
    ]);
    expect(checklist.map((item) => item.item_id)).toEqual([
      ...MOVE_IN_CHECKLIST_ITEM_IDS,
    ]);
    expect(JSON.stringify(checklist)).toBe(
      JSON.stringify(getMoveInReadinessChecklist()),
    );

    for (const item of checklist) {
      expect(MoveInChecklistItemSchema.safeParse(item).success).toBe(true);
      expect(item.safety_posture).toMatchObject({
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
      });
    }
  });

  it("is frozen and returns defensive copies", () => {
    expect(Object.isFrozen(MOVE_IN_READINESS_CHECKLIST)).toBe(true);
    expect(Object.isFrozen(MOVE_IN_READINESS_CHECKLIST[0])).toBe(true);
    expect(Object.isFrozen(MOVE_IN_READINESS_CHECKLIST[0].safety_notes)).toBe(
      true,
    );

    const checklist = getMoveInReadinessChecklist();
    checklist[0].label = "Mutated";
    checklist[0].safety_notes.push("mutation");

    expect(getMoveInReadinessChecklist()[0]).toMatchObject({
      item_id: "move-in:fresh-clone-complete",
      label: "Fresh clone complete",
      safety_notes: [
        "This checklist does not clone, pull, or modify repository content.",
      ],
    });
  });

  it("represents deferred real-device, wake-word/conversation, and voice-authorisation posture", () => {
    const deferred = getDeferredMoveInChecklistItems();

    expect(deferred.map((item) => item.item_id)).toEqual([
      "move-in:real-hue-device-onboarding-deferred",
      "move-in:wake-word-conversation-mode-amendment-deferred",
      "move-in:voice-authorisation-tiers-deferred",
    ]);
    expect(deferred.every((item) => item.status === "deferred")).toBe(true);
    expect(
      deferred.every((item) => item.required_before_move_in === false),
    ).toBe(true);
    expect(
      deferred.find(
        (item) =>
          item.item_id === "move-in:real-hue-device-onboarding-deferred",
      ),
    ).toMatchObject({
      readiness_expectation:
        "Real Hue or device onboarding stays deferred until configuration and hardware are present and explicitly governed.",
    });
    expect(
      deferred.find(
        (item) => item.item_id === "move-in:voice-authorisation-tiers-deferred",
      ),
    ).toMatchObject({
      safety_notes: [
        "No voice-only approval, auto-approval, or new authorisation tier is created.",
      ],
    });
  });

  it("represents the final approval safety reminder", () => {
    const safetyItems = getMoveInChecklistByCategory("safety");

    expect(safetyItems).toEqual([
      expect.objectContaining({
        item_id: "move-in:final-safety-approval-reminder",
        status: "safety_reminder",
        required_before_move_in: true,
        readiness_expectation:
          "No destructive or real-world action is allowed without explicit approval posture.",
      }),
    ]);
  });

  it("filters checklist items by category and required/deferred posture", () => {
    expect(
      getMoveInChecklistByCategory("validation").map((item) => item.item_id),
    ).toEqual(["move-in:doctor-report-reviewed", "move-in:tests-passed"]);
    expect(
      getMoveInChecklistByCategory("voice").map((item) => item.item_id),
    ).toEqual(["move-in:voice-readiness-checked"]);
    expect(
      getRequiredMoveInChecklistItems().map((item) => item.item_id),
    ).toEqual([
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
      "move-in:final-safety-approval-reminder",
    ]);
  });

  it("summarizes checklist counts from the static checklist", () => {
    const checklist = getMoveInReadinessChecklist();
    const summary = summarizeMoveInChecklist();

    expect(summary).toMatchObject({
      checklist_version: "20C.5",
      item_count: 16,
      required_item_count: 13,
      deferred_item_count: 3,
      safety_reminder_count: 1,
      category_counts: {
        workspace: 1,
        dependencies: 1,
        environment: 1,
        validation: 2,
        demo: 1,
        room: 1,
        command_center: 1,
        local_model: 1,
        voice: 1,
        vision: 1,
        first_safe_run: 1,
        deferred: 3,
        safety: 1,
      },
      phase20c_checklist_only: true,
      phase20c_capability_neutral: true,
    });
    expect(summary.item_count).toBe(checklist.length);

    for (const category of MOVE_IN_CHECKLIST_CATEGORIES) {
      expect(summary.category_counts[category]).toBe(
        checklist.filter((item) => item.category === category).length,
      );
    }
  });

  it("declares no setup, shell, mutation, network, provider, runtime, UI, authority, source material, or capability affordances", () => {
    const checklist = getMoveInReadinessChecklist();
    const summary = summarizeMoveInChecklist();

    for (const posture of [
      summary.safety_posture,
      ...checklist.map((item) => item.safety_posture),
    ]) {
      expect(posture.installer_automation_enabled).toBe(false);
      expect(posture.shell_execution_enabled).toBe(false);
      expect(posture.process_spawn_enabled).toBe(false);
      expect(posture.filesystem_mutation_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.ui_route_created).toBe(false);
      expect(posture.approval_bypass_created).toBe(false);
      expect(posture.authority_surface_created).toBe(false);
      expect(posture.capability_created).toBe(false);
      expect(posture.source_material_exposure_enabled).toBe(false);
    }

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys({ checklist, summary })).not.toContain(
        forbiddenFieldName,
      );
    }
  });

  it("exports no setup, runtime execution, UI route, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(onboardingReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "getMoveInReadinessChecklist",
        "getMoveInChecklistByCategory",
        "getRequiredMoveInChecklistItems",
        "getDeferredMoveInChecklistItems",
        "summarizeMoveInChecklist",
      ]),
    );
  });
});
