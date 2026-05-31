import { describe, expect, it } from "vitest";

import * as finalSystemStatus from "./index";
import {
  FINAL_DISABLED_FEATURE_IDS,
  FINAL_DISABLED_FEATURE_MATRIX,
  FinalDisabledFeatureRecordSchema,
  getCriticalDisabledFeatures,
  getDisabledFeaturesByCategory,
  getFinalDisabledFeatureMatrix,
  summarizeDisabledFeaturePosture,
} from "./index";

const REQUIRED_DISABLED_FEATURE_IDS = [
  "disabled-feature:wake-word",
  "disabled-feature:always-listening",
  "disabled-feature:background-camera",
  "disabled-feature:hidden-capture",
  "disabled-feature:autonomous-device-execution",
  "disabled-feature:public-remote-dashboards",
  "disabled-feature:voice-only-approval",
  "disabled-feature:auto-approval",
  "disabled-feature:graph-driven-execution",
  "disabled-feature:raw-payload-telemetry-ui-exposure",
  "disabled-feature:remote-cloud-defaults",
  "disabled-feature:whole-home-multi-room",
  "disabled-feature:cai-non-whitelisted-targets",
  "disabled-feature:ui-run-retry-mutate-affordances",
  "disabled-feature:scheduler-side-effects",
  "disabled-feature:routine-chaining",
  "disabled-feature:unapproved-room-device-actions",
  "disabled-feature:ungoverned-provider-escalation",
] as const;

const CRITICAL_DISABLED_FEATURE_IDS = [
  "disabled-feature:wake-word",
  "disabled-feature:always-listening",
  "disabled-feature:background-camera",
  "disabled-feature:hidden-capture",
  "disabled-feature:autonomous-device-execution",
  "disabled-feature:public-remote-dashboards",
  "disabled-feature:voice-only-approval",
  "disabled-feature:auto-approval",
  "disabled-feature:graph-driven-execution",
  "disabled-feature:raw-payload-telemetry-ui-exposure",
  "disabled-feature:remote-cloud-defaults",
  "disabled-feature:whole-home-multi-room",
  "disabled-feature:cai-non-whitelisted-targets",
  "disabled-feature:ui-run-retry-mutate-affordances",
  "disabled-feature:scheduler-side-effects",
  "disabled-feature:unapproved-room-device-actions",
  "disabled-feature:ungoverned-provider-escalation",
] as const;

const FORBIDDEN_EXPORT_NAMES = [
  "approve",
  "retry",
  "run",
  "mutate",
  "dispatch",
  "execute",
  "callTool",
] as const;

const FORBIDDEN_MATRIX_KEYS = [
  "enabled",
  "action",
  "action_payload",
  "tool_arguments",
  "raw_payload",
  "raw_payloads",
  "raw_prompt",
  "raw_model_output",
  "raw_voice_transcript",
  "raw_ocr_text",
  "raw_frame",
  "mutation_enabled",
  "dispatch_enabled",
  "execution_enabled",
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

describe("Phase 20A.3 final disabled-feature matrix", () => {
  it("represents every required disabled feature", () => {
    const matrix = getFinalDisabledFeatureMatrix();
    const featureIds = matrix.map((feature) => feature.feature_id);

    expect(featureIds).toEqual([...FINAL_DISABLED_FEATURE_IDS]);

    for (const requiredFeatureId of REQUIRED_DISABLED_FEATURE_IDS) {
      expect(featureIds).toContain(requiredFeatureId);
    }

    for (const feature of matrix) {
      expect(FinalDisabledFeatureRecordSchema.safeParse(feature).success).toBe(
        true,
      );
      expect(feature.metadata_only).toBe(true);
      expect(feature.read_only).toBe(true);
      expect(feature.deterministic).toBe(true);
      expect(feature.originating_phases.length).toBeGreaterThan(0);
      expect(feature.closeout_relevance).toContain("disabled_feature_matrix");
    }
  });

  it("is deterministic, frozen, and defensive-copy safe", () => {
    expect(Object.isFrozen(FINAL_DISABLED_FEATURE_MATRIX)).toBe(true);
    expect(Object.isFrozen(FINAL_DISABLED_FEATURE_MATRIX[0])).toBe(true);
    expect(
      Object.isFrozen(FINAL_DISABLED_FEATURE_MATRIX[0].originating_phases),
    ).toBe(true);

    expect(JSON.stringify(getFinalDisabledFeatureMatrix())).toBe(
      JSON.stringify(getFinalDisabledFeatureMatrix()),
    );

    const firstFeature = getFinalDisabledFeatureMatrix()[0];
    firstFeature.label = "Mutated By Test";
    firstFeature.originating_phases.push("phase-20");

    expect(getFinalDisabledFeatureMatrix()[0]).toMatchObject({
      feature_id: "disabled-feature:wake-word",
      label: "Wake word",
      originating_phases: ["phase-14", "phase-20"],
    });
  });

  it("keeps every critical disabled feature represented and disabled", () => {
    const criticalFeatures = getCriticalDisabledFeatures();

    expect(criticalFeatures.map((feature) => feature.feature_id)).toEqual([
      ...CRITICAL_DISABLED_FEATURE_IDS,
    ]);

    for (const feature of criticalFeatures) {
      expect(feature.critical).toBe(true);
      expect(feature.final_phase20_posture).toMatch(/^remains_disabled/);
      expect(feature.creates_new_capability).toBe(false);
      expect(feature.creates_new_authority).toBe(false);
      expect(feature.adds_user_affordance).toBe(false);
      expect(feature.performs_side_effect).toBe(false);
      expect(feature.calls_provider).toBe(false);
      expect(feature.calls_network).toBe(false);
      expect(feature.includes_sensitive_material).toBe(false);
    }
  });

  it("returns category-specific defensive copies", () => {
    const voiceFeatures = getDisabledFeaturesByCategory("voice_capture");

    expect(voiceFeatures.map((feature) => feature.feature_id)).toEqual([
      "disabled-feature:wake-word",
      "disabled-feature:always-listening",
    ]);

    voiceFeatures[0].label = "Mutated Voice Feature";

    expect(getDisabledFeaturesByCategory("voice_capture")[0]).toMatchObject({
      feature_id: "disabled-feature:wake-word",
      label: "Wake word",
    });
  });

  it("ensures no feature has actionable or enabled posture", () => {
    for (const feature of getFinalDisabledFeatureMatrix()) {
      expect(feature.final_phase20_posture).toMatch(/^remains_disabled/);
      expect(feature.creates_new_capability).toBe(false);
      expect(feature.creates_new_authority).toBe(false);
      expect(feature.adds_user_affordance).toBe(false);
      expect(feature.performs_side_effect).toBe(false);
      expect(feature.calls_provider).toBe(false);
      expect(feature.calls_network).toBe(false);
      expect(feature.includes_sensitive_material).toBe(false);
      expect(feature.enforcement_posture).not.toContain("enabled");
    }
  });

  it("does not expose mutating, action, execution, or raw material field names", () => {
    const keys = collectKeys({
      matrix: getFinalDisabledFeatureMatrix(),
      summary: summarizeDisabledFeaturePosture(),
    });

    for (const forbiddenKey of FORBIDDEN_MATRIX_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }
  });

  it("proves Phase 20 introduces no new capability through the matrix", () => {
    const summary = summarizeDisabledFeaturePosture();

    expect(summary).toMatchObject({
      matrix_version: "20A.3",
      all_features_remain_disabled: true,
      no_phase20_capability_created: true,
      no_authority_created: true,
      metadata_only: true,
      read_only: true,
      deterministic: true,
    });

    for (const feature of getFinalDisabledFeatureMatrix()) {
      expect(feature.originating_phases).toContain("phase-20");
      expect(feature.creates_new_capability).toBe(false);
    }
  });

  it("summary counts match the matrix", () => {
    const matrix = getFinalDisabledFeatureMatrix();
    const summary = summarizeDisabledFeaturePosture();
    const criticalCount = matrix.filter((feature) => feature.critical).length;
    const summarizedFeatureCount = summary.category_summaries.reduce(
      (count, category) => count + category.feature_count,
      0,
    );
    const summarizedCriticalCount = summary.category_summaries.reduce(
      (count, category) => count + category.critical_count,
      0,
    );

    expect(summary.feature_count).toBe(matrix.length);
    expect(summary.critical_feature_count).toBe(criticalCount);
    expect(summarizedFeatureCount).toBe(matrix.length);
    expect(summarizedCriticalCount).toBe(criticalCount);
  });

  it("exports no execution hooks or active mutating affordance names", () => {
    const exportedFunctionNames = Object.entries(finalSystemStatus)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
