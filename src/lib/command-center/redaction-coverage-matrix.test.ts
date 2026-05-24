import { describe, expect, it } from "vitest";

import {
  REDACTION_COVERAGE_SURFACES,
  RedactionCoverageMatrixSchema,
  RedactionCoverageMatrixValidationSchema,
  RedactionCoverageSummarySchema,
  createDefaultRedactionCoverageMatrix,
  summarizeRedactionCoverageMatrix,
  validateRedactionCoverageEntry,
  validateRedactionCoverageMatrix,
} from "./index";

describe("Phase 9K2 redaction coverage matrix contract", () => {
  it("creates a deterministic and serializable default matrix", () => {
    const first = createDefaultRedactionCoverageMatrix();
    const second = createDefaultRedactionCoverageMatrix();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(RedactionCoverageMatrixSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.redaction_coverage_matrix",
      phase: "9K2",
      generated_at: 0,
    });
  });

  it("has exactly one entry per redaction coverage surface", () => {
    const matrix = createDefaultRedactionCoverageMatrix();

    expect(matrix.entries.map((entry) => entry.surface)).toEqual([
      ...REDACTION_COVERAGE_SURFACES,
    ]);
    expect(new Set(matrix.entries.map((entry) => entry.surface)).size).toBe(
      REDACTION_COVERAGE_SURFACES.length,
    );
  });

  it("validates the default matrix successfully", () => {
    expect(validateRedactionCoverageMatrix()).toMatchObject({
      passed: true,
      reasons: ["redaction_coverage_valid"],
      missing_surfaces: [],
      duplicate_surfaces: [],
      invalid_surfaces: [],
      unknown_surface_count: 0,
      mutated_input: false,
    });
  });

  it("summarizes complete coverage as pass", () => {
    const summary = summarizeRedactionCoverageMatrix();

    expect(summary).toMatchObject({
      total_surfaces: REDACTION_COVERAGE_SURFACES.length,
      covered_surfaces: [...REDACTION_COVERAGE_SURFACES],
      uncovered_surfaces: [],
      verdict: "pass",
    });
    expect(RedactionCoverageSummarySchema.parse(summary)).toEqual(summary);
  });

  it("fails validation when a surface is missing", () => {
    const matrix = createDefaultRedactionCoverageMatrix();
    const validation = validateRedactionCoverageMatrix({
      ...matrix,
      entries: matrix.entries.filter((entry) => entry.surface !== "rest_orb"),
    });

    expect(validation).toMatchObject({
      passed: false,
      missing_surfaces: ["rest_orb"],
    });
  });

  it("fails validation when a surface is duplicated", () => {
    const matrix = createDefaultRedactionCoverageMatrix();
    const validation = validateRedactionCoverageMatrix({
      ...matrix,
      entries: [matrix.entries[0], ...matrix.entries],
    });

    expect(validation).toMatchObject({
      passed: false,
      duplicate_surfaces: ["rest_orb"],
    });
  });

  it("fails validation for unknown surfaces", () => {
    const matrix = createDefaultRedactionCoverageMatrix();
    const validation = validateRedactionCoverageMatrix({
      ...matrix,
      entries: [
        ...matrix.entries,
        {
          ...matrix.entries[0],
          surface: "unlisted_surface",
        },
      ],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "unknown_surface"]),
      unknown_surface_count: 1,
    });
  });

  it("fails validation when any required enforcement boolean is false", () => {
    const entry = createDefaultRedactionCoverageMatrix().entries[0];

    for (const field of [
      "uses_command_center_privacy_policy",
      "metadata_only_required",
      "redaction_required",
      "render_safe_required",
      "non_executable_required",
      "raw_payload_guard",
      "source_code_guard",
    ] as const) {
      expect(
        validateRedactionCoverageEntry({
          ...entry,
          [field]: false,
        }),
      ).toMatchObject({
        passed: false,
        reasons: expect.arrayContaining(["enforcement_boolean_disabled"]),
      });
    }
  });

  it("fails closed for raw, executable, and callback fields", () => {
    expect(
      validateRedactionCoverageEntry({
        ...createDefaultRedactionCoverageMatrix().entries[0],
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

  it("enables surface-specific guards for demo, recruiter, developer, and source-related surfaces", () => {
    const matrix = createDefaultRedactionCoverageMatrix();
    const entryBySurface = new Map(
      matrix.entries.map((entry) => [entry.surface, entry]),
    );

    expect(entryBySurface.get("demo_dataset")).toMatchObject({
      demo_live_data_guard: true,
      source_code_guard: true,
    });
    expect(entryBySurface.get("recruiter_presentation")).toMatchObject({
      recruiter_exposure_guard: true,
      source_code_guard: true,
    });
    expect(entryBySurface.get("developer_console")).toMatchObject({
      dev_only_guard: true,
      source_code_guard: true,
    });
    expect(entryBySurface.get("runtime_dependency")).toMatchObject({
      source_code_guard: true,
    });
  });

  it("exports redaction coverage helpers from command-center index", () => {
    expect(typeof createDefaultRedactionCoverageMatrix).toBe("function");
    expect(typeof validateRedactionCoverageEntry).toBe("function");
    expect(typeof validateRedactionCoverageMatrix).toBe("function");
    expect(typeof summarizeRedactionCoverageMatrix).toBe("function");
    expect(
      RedactionCoverageMatrixValidationSchema.parse(
        validateRedactionCoverageMatrix(),
      ),
    ).toEqual(validateRedactionCoverageMatrix());
  });
});
