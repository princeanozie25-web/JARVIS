import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_9J_DEVELOPER_CONSOLE_GUARD_STATE,
  DEVELOPER_CONSOLE_SECTION_IDS,
  DeveloperConsoleViewModelSchema,
  Phase9JDeveloperConsoleCloseoutReportSchema,
  createDefaultDeveloperConsoleViewModel,
  createPhase9JDeveloperConsoleCloseoutReport,
  deriveDeveloperConsoleViewModelFromSafeMetadata,
  validateDeveloperConsoleViewModel,
} from "./index";

describe("Phase 9J2 developer console view model contract", () => {
  it("creates a deterministic, safe, serializable, dev-only default view model", () => {
    const first = createDefaultDeveloperConsoleViewModel();
    const second = createDefaultDeveloperConsoleViewModel();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(DeveloperConsoleViewModelSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.developer_console_view_model",
      phase: "9J2",
      console_id: "developer_console:metadata_only",
      generated_at: 0,
      metadata_only: true,
      redaction_required: true,
      render_safe: true,
      non_executable: true,
      dev_only: true,
      hidden_in_recruiter_view: true,
      hidden_in_demo_presentation: true,
      remote_access_allowed: false,
      writes_allowed: false,
      export_allowed: false,
      authority_surface: false,
      debug_actions_allowed: false,
      live_db_reads_allowed: false,
      telemetry_reads_allowed: false,
      source_code_rendering_allowed: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      db_write_performed: false,
      network_called: false,
    });
    expect(validateDeveloperConsoleViewModel(first)).toMatchObject({
      passed: true,
      reasons: ["developer_console_view_model_valid"],
      mutated_input: false,
      dev_only: true,
    });
  });

  it("includes exactly one section per allowed 9J1 section", () => {
    const viewModel = createDefaultDeveloperConsoleViewModel();

    expect(viewModel.sections.map((section) => section.section_id)).toEqual([
      ...DEVELOPER_CONSOLE_SECTION_IDS,
    ]);
    expect(validateDeveloperConsoleViewModel(viewModel)).toMatchObject({
      passed: true,
      missing_section_ids: [],
      duplicate_section_ids: [],
      invalid_section_ids: [],
    });
  });

  it("is hidden in recruiter and demo presentation surfaces", () => {
    expect(createDefaultDeveloperConsoleViewModel()).toMatchObject({
      hidden_in_recruiter_view: true,
      hidden_in_demo_presentation: true,
    });
  });

  it("fails validation for missing, duplicate, and unknown sections", () => {
    const viewModel = createDefaultDeveloperConsoleViewModel();

    expect(
      validateDeveloperConsoleViewModel({
        ...viewModel,
        sections: viewModel.sections.slice(1),
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "missing_section"]),
      missing_section_ids: ["observability_queries"],
    });
    expect(
      validateDeveloperConsoleViewModel({
        ...viewModel,
        sections: [
          viewModel.sections[0],
          { ...viewModel.sections[0] },
          ...viewModel.sections.slice(2),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["duplicate_section"]),
      duplicate_section_ids: ["observability_queries"],
    });
    expect(
      validateDeveloperConsoleViewModel({
        ...viewModel,
        sections: [
          { ...viewModel.sections[0], section_id: "debug_shell" },
          ...viewModel.sections.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "unknown_section"]),
    });
  });

  it("fails validation for interactive sections", () => {
    const viewModel = createDefaultDeveloperConsoleViewModel();

    expect(
      validateDeveloperConsoleViewModel({
        ...viewModel,
        sections: [
          { ...viewModel.sections[0], interactive: true },
          ...viewModel.sections.slice(1),
        ],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "interactive_section",
      ]),
    });
  });

  it("fails closed for raw payload fields", () => {
    expect(
      validateDeveloperConsoleViewModel({
        ...createDefaultDeveloperConsoleViewModel(),
        raw_prompt: "withheld",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
      ]),
      withheld_fields: ["raw_prompt"],
    });
  });

  it("fails closed for source code and stack trace fields", () => {
    expect(
      validateDeveloperConsoleViewModel({
        ...createDefaultDeveloperConsoleViewModel(),
        source_code: "const unsafe = true",
        code_body: "function unsafe() {}",
        file_body: "body",
        raw_stack_trace: "stack",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "source_code_field_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "source_code",
        "code_body",
        "file_body",
        "raw_stack_trace",
      ]),
    });
  });

  it("fails closed for executable, export, and debug-action keys", () => {
    expect(
      validateDeveloperConsoleViewModel({
        ...createDefaultDeveloperConsoleViewModel(),
        approve_button: true,
        run_button: true,
        retry_button: true,
        mutate_button: true,
        export_json: true,
        debug_action: true,
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
        "export_json",
        "debug_action",
      ]),
    });
  });

  it("fails closed for callback/function/non-serializable values", () => {
    expect(
      validateDeveloperConsoleViewModel({
        ...createDefaultDeveloperConsoleViewModel(),
        on_debug: () => undefined,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "executable_affordance_present",
        "non_serializable_value",
      ]),
      withheld_fields: ["on_debug"],
    });
  });

  it("derives safe section summaries from safe metadata", () => {
    const viewModel = deriveDeveloperConsoleViewModelFromSafeMetadata({
      generated_at: 55,
      sections: [
        {
          section_id: "projection_health",
          status_class: "nominal",
          primary_bin: "medium",
          secondary_bin: "low",
          withheld_fields: ["raw_prompt"],
        },
      ],
    });
    const section = viewModel.sections.find(
      (item) => item.section_id === "projection_health",
    );

    expect(viewModel.generated_at).toBe(55);
    expect(section).toMatchObject({
      status_class: "nominal",
      summary_bins: { primary: "medium", secondary: "low" },
      withheld_fields: ["raw_prompt"],
      render_safe: true,
      interactive: false,
    });
    expect(validateDeveloperConsoleViewModel(viewModel).passed).toBe(true);
  });

  it("falls back to default view model for unsafe metadata", () => {
    expect(
      deriveDeveloperConsoleViewModelFromSafeMetadata({
        raw_prompt: "withheld",
      }),
    ).toEqual(createDefaultDeveloperConsoleViewModel());
  });

  it("passes the default 9J closeout report", () => {
    const report = createPhase9JDeveloperConsoleCloseoutReport();

    expect(report).toMatchObject({
      verdict: "pass",
      failed_guards: [],
      generated_from: "phase_9j_developer_observability_console_scaffold",
      metadata_only: true,
      redaction_required: true,
      render_safe: true,
      non_executable: true,
      dev_only: true,
      hidden_in_recruiter_view: true,
      hidden_in_demo_presentation: true,
      remote_access_allowed: false,
      writes_allowed: false,
      export_allowed: false,
      debug_actions_allowed: false,
      live_db_reads_allowed: false,
      telemetry_reads_allowed: false,
      source_code_rendering_allowed: false,
    });
  });

  it("fails closeout when dev-only or hide flags are disabled", () => {
    const report = createPhase9JDeveloperConsoleCloseoutReport({
      viewModel: {
        ...createDefaultDeveloperConsoleViewModel(),
        dev_only: false,
        hidden_in_recruiter_view: false,
        hidden_in_demo_presentation: false,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_non_dev_exposure",
        "no_recruiter_view_exposure",
        "no_demo_presentation_exposure",
      ]),
    });
  });

  it("fails closeout when remote access, writes, exports, or debug actions are enabled", () => {
    const report = createPhase9JDeveloperConsoleCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9J_DEVELOPER_CONSOLE_GUARD_STATE,
        remote_access_enabled: true,
        writes_enabled: true,
        exports_enabled: true,
        debug_actions_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_remote_access",
        "no_writes",
        "no_exports",
        "no_debug_actions",
      ]),
    });
  });

  it("fails closeout when raw or source payload rendering is enabled", () => {
    const report = createPhase9JDeveloperConsoleCloseoutReport({
      viewModel: {
        ...createDefaultDeveloperConsoleViewModel(),
        raw_prompt: "withheld",
        source_code: "blocked",
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_raw_payload_rendering",
        "no_source_code_rendering",
      ]),
    });
  });

  it("exports developer console view model helpers from command-center index", () => {
    expect(typeof createDefaultDeveloperConsoleViewModel).toBe("function");
    expect(typeof validateDeveloperConsoleViewModel).toBe("function");
    expect(typeof deriveDeveloperConsoleViewModelFromSafeMetadata).toBe(
      "function",
    );
    expect(typeof createPhase9JDeveloperConsoleCloseoutReport).toBe("function");
    expect(
      Phase9JDeveloperConsoleCloseoutReportSchema.parse(
        createPhase9JDeveloperConsoleCloseoutReport(),
      ),
    ).toEqual(createPhase9JDeveloperConsoleCloseoutReport());
  });
});
