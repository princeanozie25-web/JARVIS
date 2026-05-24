import { describe, expect, it } from "vitest";

import {
  DEVELOPER_CONSOLE_SECTION_IDS,
  DeveloperConsoleDescriptorSchema,
  DeveloperConsoleSectionRegistrySchema,
  createDefaultDeveloperConsoleDescriptor,
  createDefaultDeveloperConsoleSections,
  validateDeveloperConsoleDescriptor,
  validateDeveloperConsoleSectionDescriptor,
  validateDeveloperConsoleSectionRegistry,
} from "./index";

describe("Phase 9J1 developer observability console contract", () => {
  it("creates a deterministic, safe, serializable, dev-only console descriptor", () => {
    const first = createDefaultDeveloperConsoleDescriptor();
    const second = createDefaultDeveloperConsoleDescriptor();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(DeveloperConsoleDescriptorSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.developer_console_descriptor",
      phase: "9J1",
      console_id: "developer_console:metadata_only",
      enabled_in_dev_only: true,
      metadata_only: true,
      redaction_required: true,
      render_safe: true,
      non_executable: true,
      remote_access_allowed: false,
      writes_allowed: false,
      export_allowed: false,
      authority_surface: false,
      interactive: false,
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
    expect(validateDeveloperConsoleDescriptor(first)).toMatchObject({
      passed: true,
      reasons: ["developer_console_descriptor_valid"],
      enabled_in_dev_only: true,
      mutated_input: false,
    });
  });

  it("is hidden in recruiter view and demo presentation", () => {
    expect(createDefaultDeveloperConsoleDescriptor()).toMatchObject({
      hidden_in_recruiter_view: true,
      hidden_in_demo_presentation: true,
    });
  });

  it("rejects remote access, writes, and export", () => {
    expect(
      validateDeveloperConsoleDescriptor({
        ...createDefaultDeveloperConsoleDescriptor(),
        remote_access_allowed: true,
        writes_allowed: true,
        export_allowed: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "remote_access_enabled",
        "writes_enabled",
        "export_enabled",
        "executable_affordance_present",
      ]),
      remote_access_allowed: true,
      writes_allowed: true,
      export_allowed: true,
    });
  });

  it("creates exactly one section descriptor per allowed console section", () => {
    const sections = createDefaultDeveloperConsoleSections();

    expect(sections.map((section) => section.section_id)).toEqual([
      ...DEVELOPER_CONSOLE_SECTION_IDS,
    ]);
    expect(validateDeveloperConsoleSectionRegistry(sections)).toMatchObject({
      passed: true,
      reasons: ["developer_console_section_valid"],
      section_count: DEVELOPER_CONSOLE_SECTION_IDS.length,
      missing_section_ids: [],
      duplicate_section_ids: [],
    });
    expect(
      DeveloperConsoleSectionRegistrySchema.parse({
        kind: "command_center.developer_console_section_registry",
        phase: "9J1",
        sections,
        metadata_only: true,
        redaction_required: true,
        render_safe: true,
        interactive: false,
        descriptor_only: true,
      }).sections,
    ).toEqual(sections);
  });

  it("marks all sections as non-interactive, metadata-only, and redaction-required", () => {
    for (const section of createDefaultDeveloperConsoleSections()) {
      expect(section).toMatchObject({
        metadata_only: true,
        redaction_required: true,
        render_safe: true,
        interactive: false,
        raw_payload_fields_allowed: false,
        mutating_affordances_allowed: false,
        export_allowed: false,
        debug_actions_allowed: false,
      });
      expect(validateDeveloperConsoleSectionDescriptor(section)).toMatchObject({
        passed: true,
        reasons: ["developer_console_section_valid"],
      });
    }
  });

  it("fails registry validation for duplicate and unknown sections", () => {
    const sections = createDefaultDeveloperConsoleSections();

    expect(
      validateDeveloperConsoleSectionRegistry([
        sections[0],
        { ...sections[0], display_priority: 2 },
        ...sections.slice(2),
      ]),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "duplicate_section",
        "missing_section",
        "priority_order_not_deterministic",
      ]),
      duplicate_section_ids: ["observability_queries"],
    });
    expect(
      validateDeveloperConsoleSectionRegistry([
        { ...sections[0], section_id: "debug_shell" },
        ...sections.slice(1),
      ]),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "unknown_section"]),
    });
  });

  it("fails closed for raw payload fields", () => {
    expect(
      validateDeveloperConsoleDescriptor({
        ...createDefaultDeveloperConsoleDescriptor(),
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

  it("fails closed for executable, export, and debug-action keys", () => {
    expect(
      validateDeveloperConsoleDescriptor({
        ...createDefaultDeveloperConsoleDescriptor(),
        approve_button: true,
        run_button: true,
        retry_button: true,
        mutate_button: true,
        debug_action: true,
        export_json: true,
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
        "debug_action",
        "export_json",
      ]),
    });

    expect(
      validateDeveloperConsoleSectionDescriptor({
        ...createDefaultDeveloperConsoleSections()[0],
        forbidden_affordances: ["mutate"],
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["mutating_affordance_declared"]),
    });
  });

  it("fails closed for callback/function/non-serializable values", () => {
    expect(
      validateDeveloperConsoleDescriptor({
        ...createDefaultDeveloperConsoleDescriptor(),
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

  it("exports developer console helpers from command-center index", () => {
    expect(typeof createDefaultDeveloperConsoleDescriptor).toBe("function");
    expect(typeof createDefaultDeveloperConsoleSections).toBe("function");
    expect(typeof validateDeveloperConsoleDescriptor).toBe("function");
    expect(typeof validateDeveloperConsoleSectionDescriptor).toBe("function");
    expect(typeof validateDeveloperConsoleSectionRegistry).toBe("function");
  });
});
