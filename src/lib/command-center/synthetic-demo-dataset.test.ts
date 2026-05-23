import { describe, expect, it } from "vitest";

import {
  SyntheticDemoDatasetSchema,
  createDefaultDemoModeDataSource,
  createDefaultSyntheticDemoDataset,
  deriveSyntheticDemoDatasetFromDemoModeDataSource,
  validateSyntheticDemoDataset,
} from "./index";

describe("Phase 9I2 synthetic demo dataset contract", () => {
  it("creates a deterministic, safe, serializable, synthetic-only default dataset", () => {
    const first = createDefaultSyntheticDemoDataset();
    const second = createDefaultSyntheticDemoDataset();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(SyntheticDemoDatasetSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.synthetic_demo_dataset",
      phase: "9I2",
      dataset_id: "synthetic_demo:safe_empty",
      profile: "safe_empty",
      source_kind: "synthetic_build_time_dataset",
      render_safe: true,
      replay_safe: true,
      non_executable: true,
      badge_required: true,
      metadata_only: true,
      synthetic_only: true,
      live_data_access_allowed: false,
      writes_allowed: false,
      remote_sync_allowed: false,
      raw_payloads_included: false,
      exact_pii_included: false,
      authority_surface: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      db_write_performed: false,
      network_called: false,
    });
    expect(validateSyntheticDemoDataset(first)).toMatchObject({
      passed: true,
      reasons: ["synthetic_demo_dataset_valid"],
      synthetic_only: true,
      mutated_input: false,
    });
  });

  it("includes Rest, Working, Audit replay, governance, and dependency sections", () => {
    const dataset = createDefaultSyntheticDemoDataset("portfolio_default");

    expect(dataset.rest_state).toMatchObject({
      kind: "command_center.synthetic_demo_rest_state",
      render_safe: true,
      non_executable: true,
    });
    expect(dataset.working_cockpit.kind).toBe(
      "command_center.working_cockpit_view_model",
    );
    expect(dataset.audit_timeline.kind).toBe(
      "command_center.audit_trace_timeline_view_model",
    );
    expect(dataset.audit_replay.kind).toBe(
      "command_center.audit_replay_viewer_view_model",
    );
    expect(dataset.governance_boundary.kind).toBe(
      "command_center.governance_boundary_viewer_view_model",
    );
    expect(dataset.runtime_dependency.kind).toBe(
      "command_center.runtime_dependency_viewer_view_model",
    );
  });

  it("fails validation for unknown profiles", () => {
    expect(
      validateSyntheticDemoDataset({
        ...createDefaultSyntheticDemoDataset(),
        profile: "real_customer_demo",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "unknown_profile"]),
    });
  });

  it("fails validation for live or real source markers", () => {
    expect(
      validateSyntheticDemoDataset({
        ...createDefaultSyntheticDemoDataset(),
        live_audit_db_ref: "audit.sqlite",
        telemetry_ref: "live-stream",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "live_or_real_source_marker_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "live_audit_db_ref",
        "telemetry_ref",
      ]),
    });
  });

  it("fails closed for raw payload fields", () => {
    expect(
      validateSyntheticDemoDataset({
        ...createDefaultSyntheticDemoDataset(),
        raw_prompt: "withheld",
        raw_tool_args: "withheld",
        exact_pii: "withheld",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "raw_prompt",
        "raw_tool_args",
        "exact_pii",
      ]),
    });
  });

  it("fails validation for real audit DB, telemetry, project, suggestion, trace, frame, and voice references", () => {
    expect(
      validateSyntheticDemoDataset({
        ...createDefaultSyntheticDemoDataset(),
        audit_db_ref: "live-audit",
        live_telemetry: true,
        user_project_id: "project-real",
        real_suggestion_id: "suggestion-real",
        real_trace_id: "trace-real",
        frame_ref: "frame-real",
        voice_ref: "voice-real",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "live_or_real_source_marker_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "audit_db_ref",
        "live_telemetry",
        "user_project_id",
        "real_suggestion_id",
        "real_trace_id",
        "frame_ref",
        "voice_ref",
      ]),
    });
  });

  it("fails closed for executable approve/run/retry/mutate keys", () => {
    expect(
      validateSyntheticDemoDataset({
        ...createDefaultSyntheticDemoDataset(),
        approve_button: true,
        run_button: true,
        retry_button: true,
        mutate_button: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "executable_affordance_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "approve_button",
        "run_button",
        "retry_button",
        "mutate_button",
      ]),
    });
  });

  it("fails closed for callback/function/non-serializable values", () => {
    expect(
      validateSyntheticDemoDataset({
        ...createDefaultSyntheticDemoDataset(),
        on_execute: () => undefined,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "executable_affordance_present",
        "non_serializable_value",
      ]),
      withheld_fields: ["on_execute"],
    });
  });

  it("fails validation when badge_required is false", () => {
    expect(
      validateSyntheticDemoDataset({
        ...createDefaultSyntheticDemoDataset(),
        badge_required: false,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "badge_missing"]),
      badge_required: false,
    });
  });

  it("fails validation when render/replay/non-executable guarantees are disabled", () => {
    expect(
      validateSyntheticDemoDataset({
        ...createDefaultSyntheticDemoDataset(),
        render_safe: false,
        replay_safe: false,
        non_executable: false,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "render_not_safe",
        "replay_not_safe",
        "not_non_executable",
      ]),
      render_safe: false,
      replay_safe: false,
      non_executable: false,
    });
  });

  it("fails closed when a nested section is unsafe", () => {
    const dataset = createDefaultSyntheticDemoDataset();

    expect(
      validateSyntheticDemoDataset({
        ...dataset,
        working_cockpit: {
          ...dataset.working_cockpit,
          raw_prompt: "withheld",
        },
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
        "nested_section_unsafe",
      ]),
      withheld_fields: ["working_cockpit.raw_prompt"],
    });
  });

  it("derives a safe dataset from a safe DemoModeDataSource", () => {
    const dataset = deriveSyntheticDemoDatasetFromDemoModeDataSource({
      ...createDefaultDemoModeDataSource(),
      dataset_profile: "governance_showcase",
    });

    expect(dataset).toMatchObject({
      dataset_id: "synthetic_demo:governance_showcase",
      profile: "governance_showcase",
      source_kind: "synthetic_build_time_dataset",
      render_safe: true,
      replay_safe: true,
      non_executable: true,
      badge_required: true,
    });
    expect(validateSyntheticDemoDataset(dataset).passed).toBe(true);
  });

  it("falls back to safe_empty for unsafe DemoModeDataSource input", () => {
    const dataset = deriveSyntheticDemoDatasetFromDemoModeDataSource({
      ...createDefaultDemoModeDataSource(),
      source_kind: "live_audit_db",
    });

    expect(dataset).toEqual(createDefaultSyntheticDemoDataset("safe_empty"));
  });

  it("exports synthetic demo dataset helpers from command-center index", () => {
    expect(typeof createDefaultSyntheticDemoDataset).toBe("function");
    expect(typeof validateSyntheticDemoDataset).toBe("function");
    expect(typeof deriveSyntheticDemoDatasetFromDemoModeDataSource).toBe(
      "function",
    );
    expect(
      SyntheticDemoDatasetSchema.parse(createDefaultSyntheticDemoDataset()),
    ).toEqual(createDefaultSyntheticDemoDataset());
  });
});
