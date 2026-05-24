import { describe, expect, it } from "vitest";

import {
  PHASE_9_DISABLED_FEATURE_IDS,
  Phase9DisabledFeatureMatrixSchema,
  Phase9DisabledFeatureMatrixValidationSchema,
  createDefaultPhase9DisabledFeatureMatrix,
  summarizePhase9DisabledFeatureMatrix,
  validatePhase9DisabledFeatureMatrix,
} from "./index";

describe("Phase 9L2 final disabled-feature guard matrix", () => {
  it("creates a deterministic and serializable default matrix", () => {
    const first = createDefaultPhase9DisabledFeatureMatrix();
    const second = createDefaultPhase9DisabledFeatureMatrix();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9DisabledFeatureMatrixSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.phase_9_disabled_feature_matrix",
      phase: "9L2",
      generated_at: 0,
    });
  });

  it("contains exactly one guard per forbidden Phase 9 feature", () => {
    const matrix = createDefaultPhase9DisabledFeatureMatrix();

    expect(matrix.guards.map((guard) => guard.feature_id)).toEqual([
      ...PHASE_9_DISABLED_FEATURE_IDS,
    ]);
    expect(new Set(matrix.guards.map((guard) => guard.feature_id)).size).toBe(
      PHASE_9_DISABLED_FEATURE_IDS.length,
    );
    expect(matrix.guards.every((guard) => guard.disabled === true)).toBe(true);
  });

  it("summarizes as pass when all features are disabled", () => {
    expect(summarizePhase9DisabledFeatureMatrix()).toMatchObject({
      total_features: PHASE_9_DISABLED_FEATURE_IDS.length,
      disabled_features: [...PHASE_9_DISABLED_FEATURE_IDS],
      enabled_forbidden_features: [],
      verdict: "pass",
    });
  });

  it("fails validation when a feature is missing", () => {
    const matrix = createDefaultPhase9DisabledFeatureMatrix();

    expect(
      validatePhase9DisabledFeatureMatrix({
        ...matrix,
        guards: matrix.guards.filter(
          (guard) => guard.feature_id !== "remote_networked_dashboard_access",
        ),
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["missing_feature"]),
      missing_features: ["remote_networked_dashboard_access"],
    });
  });

  it("fails validation when a feature is duplicated", () => {
    const matrix = createDefaultPhase9DisabledFeatureMatrix();

    expect(
      validatePhase9DisabledFeatureMatrix({
        ...matrix,
        guards: [matrix.guards[0], ...matrix.guards],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["duplicate_feature"]),
      duplicate_features: ["remote_networked_dashboard_access"],
    });
  });

  it("fails validation when a feature is unknown", () => {
    const matrix = createDefaultPhase9DisabledFeatureMatrix();

    expect(
      validatePhase9DisabledFeatureMatrix({
        ...matrix,
        guards: [
          ...matrix.guards,
          {
            ...matrix.guards[0],
            feature_id: "ai_agent_self_upgrade",
          },
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "unknown_feature"]),
      unknown_feature_count: 1,
    });
  });

  it("fails validation and summary when any forbidden feature is enabled", () => {
    const matrix = createDefaultPhase9DisabledFeatureMatrix();
    const unsafeMatrix = {
      ...matrix,
      guards: [
        { ...matrix.guards[0], disabled: false },
        ...matrix.guards.slice(1),
      ],
    };

    expect(validatePhase9DisabledFeatureMatrix(unsafeMatrix)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "forbidden_feature_enabled",
      ]),
      enabled_forbidden_features: ["remote_networked_dashboard_access"],
    });
    expect(summarizePhase9DisabledFeatureMatrix(unsafeMatrix)).toMatchObject({
      verdict: "fail",
      enabled_forbidden_features: ["remote_networked_dashboard_access"],
    });
  });

  it("fails closed for raw, executable, and callback fields", () => {
    expect(
      validatePhase9DisabledFeatureMatrix({
        ...createDefaultPhase9DisabledFeatureMatrix(),
        raw_prompts: "withheld",
        run_button: true,
        onClick: () => undefined,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
        "executable_affordance_present",
        "non_serializable_value",
      ]),
      withheld_fields: expect.arrayContaining(["raw_prompts", "run_button"]),
      notes: expect.arrayContaining(["non_serializable:onClick"]),
    });
  });

  it("exports disabled-feature matrix helpers from command-center index", () => {
    expect(typeof createDefaultPhase9DisabledFeatureMatrix).toBe("function");
    expect(typeof validatePhase9DisabledFeatureMatrix).toBe("function");
    expect(typeof summarizePhase9DisabledFeatureMatrix).toBe("function");
    expect(
      Phase9DisabledFeatureMatrixValidationSchema.parse(
        validatePhase9DisabledFeatureMatrix(),
      ),
    ).toEqual(validatePhase9DisabledFeatureMatrix());
  });
});
