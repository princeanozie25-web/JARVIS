import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEMO_MODE_ISOLATION_POLICY,
  DEFAULT_PHASE_9I_DEMO_MODE_GUARD_STATE,
  Phase9IDemoModeCloseoutReportSchema,
  RecruiterPresentationViewModelSchema,
  createDefaultRecruiterPresentationViewModel,
  createDefaultSyntheticDemoDataset,
  createPhase9IDemoModeCloseoutReport,
  deriveRecruiterPresentationFromSyntheticDataset,
  validateRecruiterPresentationViewModel,
} from "./index";

describe("Phase 9I3 recruiter presentation contract", () => {
  it("creates a deterministic, safe, serializable, synthetic-only default presentation", () => {
    const first = createDefaultRecruiterPresentationViewModel();
    const second = createDefaultRecruiterPresentationViewModel();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(RecruiterPresentationViewModelSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.recruiter_presentation_view_model",
      phase: "9I3",
      presentation_id: "recruiter_presentation:safe_empty",
      profile: "safe_empty",
      source_kind: "synthetic_build_time_dataset",
      badge_required: true,
      demo_badge_label: "Synthetic demo",
      render_safe: true,
      replay_safe: true,
      non_executable: true,
      metadata_only: true,
      synthetic_only: true,
      curated_only: true,
      authority_surface: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      db_write_performed: false,
      network_called: false,
    });
    expect(validateRecruiterPresentationViewModel(first)).toMatchObject({
      passed: true,
      reasons: ["recruiter_presentation_valid"],
      synthetic_only: true,
      curated_only: true,
      mutated_input: false,
    });
  });

  it("requires and exposes the demo badge contract", () => {
    expect(createDefaultRecruiterPresentationViewModel()).toMatchObject({
      badge_required: true,
      demo_badge_label: "Synthetic demo",
    });
  });

  it("hides developer console from the recruiter view", () => {
    expect(createDefaultRecruiterPresentationViewModel()).toMatchObject({
      hide_developer_console: true,
      developer_console_allowed: false,
    });
  });

  it("hides raw metadata tables from the recruiter view", () => {
    expect(createDefaultRecruiterPresentationViewModel()).toMatchObject({
      hide_raw_metadata_tables: true,
      raw_metadata_tables_allowed: false,
      working_cockpit_raw_tables_included: false,
    });
  });

  it("derives a safe recruiter presentation from a safe synthetic dataset", () => {
    const presentation = deriveRecruiterPresentationFromSyntheticDataset(
      createDefaultSyntheticDemoDataset("governance_showcase"),
    );

    expect(presentation).toMatchObject({
      presentation_id: "recruiter_presentation:governance_showcase",
      profile: "governance_showcase",
      source_kind: "synthetic_build_time_dataset",
      badge_required: true,
      hide_developer_console: true,
      hide_raw_metadata_tables: true,
      show_boundary_graph_summary: expect.objectContaining({
        section_id: "boundary_graph_summary",
        visible: true,
      }),
    });
    expect(validateRecruiterPresentationViewModel(presentation).passed).toBe(
      true,
    );
  });

  it("falls back to safe_empty presentation for unsafe synthetic datasets", () => {
    const presentation = deriveRecruiterPresentationFromSyntheticDataset({
      ...createDefaultSyntheticDemoDataset("portfolio_default"),
      raw_prompt: "withheld",
    });

    expect(presentation).toEqual(
      createDefaultRecruiterPresentationViewModel("safe_empty"),
    );
  });

  it("fails validation for live or real source markers", () => {
    expect(
      validateRecruiterPresentationViewModel({
        ...createDefaultRecruiterPresentationViewModel(),
        live_audit_db_ref: "audit.sqlite",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "live_or_real_source_marker_present",
      ]),
      withheld_fields: ["live_audit_db_ref"],
    });
  });

  it("fails closed for raw payload fields", () => {
    expect(
      validateRecruiterPresentationViewModel({
        ...createDefaultRecruiterPresentationViewModel(),
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

  it("fails validation for real audit, telemetry, project, suggestion, trace, frame, and voice references", () => {
    expect(
      validateRecruiterPresentationViewModel({
        ...createDefaultRecruiterPresentationViewModel(),
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
      validateRecruiterPresentationViewModel({
        ...createDefaultRecruiterPresentationViewModel(),
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

  it("fails validation for unknown profiles", () => {
    expect(
      validateRecruiterPresentationViewModel({
        ...createDefaultRecruiterPresentationViewModel(),
        profile: "internal_debug_demo",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "unknown_profile"]),
    });
  });

  it("passes the default 9I closeout report", () => {
    const report = createPhase9IDemoModeCloseoutReport();

    expect(report).toMatchObject({
      verdict: "pass",
      failed_guards: [],
      generated_from: "phase_9i_demo_portfolio_mode_scaffold",
      metadata_only: true,
      synthetic_only: true,
      curated_only: true,
      render_safe: true,
      replay_safe: true,
      non_executable: true,
      badge_required: true,
      developer_console_hidden: true,
      raw_metadata_tables_hidden: true,
      live_data_access_allowed: false,
      writes_allowed: false,
      remote_dashboard_allowed: false,
    });
  });

  it("fails closeout if any demo isolation invariant is disabled", () => {
    const report = createPhase9IDemoModeCloseoutReport({
      isolationPolicy: {
        ...DEFAULT_DEMO_MODE_ISOLATION_POLICY,
        no_live_audit_db_access: false,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_live_audit_db_access"],
    });
  });

  it("fails closeout if recruiter view exposes developer console or raw metadata tables", () => {
    const report = createPhase9IDemoModeCloseoutReport({
      presentation: {
        ...createDefaultRecruiterPresentationViewModel(),
        hide_developer_console: false,
        hide_raw_metadata_tables: false,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_developer_console_in_recruiter_view",
        "no_raw_metadata_tables_in_recruiter_view",
      ]),
    });
  });

  it("fails closeout if badge is not required or visible", () => {
    const report = createPhase9IDemoModeCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9I_DEMO_MODE_GUARD_STATE,
        badge_always_visible: false,
      },
      presentation: {
        ...createDefaultRecruiterPresentationViewModel(),
        badge_required: false,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["badge_always_visible"],
    });
  });

  it("exports recruiter presentation helpers from command-center index", () => {
    expect(typeof createDefaultRecruiterPresentationViewModel).toBe("function");
    expect(typeof deriveRecruiterPresentationFromSyntheticDataset).toBe(
      "function",
    );
    expect(typeof validateRecruiterPresentationViewModel).toBe("function");
    expect(typeof createPhase9IDemoModeCloseoutReport).toBe("function");
    expect(
      Phase9IDemoModeCloseoutReportSchema.parse(
        createPhase9IDemoModeCloseoutReport(),
      ),
    ).toEqual(createPhase9IDemoModeCloseoutReport());
  });
});
