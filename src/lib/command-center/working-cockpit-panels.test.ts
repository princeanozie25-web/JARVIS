import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
  WORKING_COCKPIT_PANEL_IDS,
  WorkingCockpitPanelDescriptorSchema,
  findWorkingCockpitPanel,
  listWorkingCockpitPanels,
  validateWorkingCockpitPanelDescriptor,
  validateWorkingCockpitPanelRegistry,
  type WorkingCockpitPanelRegistry,
} from "./index";

function registryWithPanelPatch(
  patch: Record<string, unknown>,
): WorkingCockpitPanelRegistry {
  return {
    ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
    panels: [
      {
        ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0],
        ...patch,
      },
      ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels.slice(1),
    ],
  } as WorkingCockpitPanelRegistry;
}

describe("Phase 9D1 Working cockpit panel registry contract", () => {
  it("has exactly one default descriptor per Working panel", () => {
    const panels = listWorkingCockpitPanels();

    expect(panels.map((panel) => panel.panel_id)).toEqual([
      ...WORKING_COCKPIT_PANEL_IDS,
    ]);
    expect(new Set(panels.map((panel) => panel.panel_id)).size).toBe(
      WORKING_COCKPIT_PANEL_IDS.length,
    );
    expect(validateWorkingCockpitPanelRegistry()).toMatchObject({
      passed: true,
      reasons: ["panel_descriptor_valid"],
      panel_count: WORKING_COCKPIT_PANEL_IDS.length,
      missing_panel_ids: [],
      duplicate_panel_ids: [],
    });
  });

  it("keeps every panel metadata-only, redaction-required, render-safe, and non-interactive", () => {
    for (const panel of listWorkingCockpitPanels()) {
      expect(panel).toMatchObject({
        metadata_only: true,
        redaction_required: true,
        render_safe: true,
        interactive: false,
        raw_payload_fields_allowed: false,
        source_reads_wired: false,
        observability_api_reads_wired: false,
        db_access_wired: false,
        telemetry_access_wired: false,
        live_stream_wired: false,
        network_fetch_allowed: false,
        can_execute: false,
        can_approve: false,
        can_schedule: false,
        can_retry: false,
        can_mutate: false,
        can_call_tools: false,
        can_capture: false,
        can_route: false,
      });
      expect(validateWorkingCockpitPanelDescriptor(panel)).toMatchObject({
        passed: true,
        reasons: ["panel_descriptor_valid"],
      });
    }
  });

  it("rejects duplicate panel IDs", () => {
    const registry = {
      ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
      panels: [
        DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0],
        {
          ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[1],
          panel_id: DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0].panel_id,
        },
        ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels.slice(2),
      ],
    };

    expect(validateWorkingCockpitPanelRegistry(registry)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "duplicate_panel_id",
        "missing_panel_id",
        "priority_order_not_deterministic",
      ]),
      duplicate_panel_ids: ["router"],
      missing_panel_ids: ["tool_calls"],
    });
  });

  it("rejects unknown source categories", () => {
    const validation = validateWorkingCockpitPanelDescriptor({
      ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0],
      source_category: "traces",
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "unknown_source_category",
        "schema_rejected",
      ]),
      source_category: "traces",
    });
  });

  it("rejects interactive panels", () => {
    const validation = validateWorkingCockpitPanelDescriptor({
      ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0],
      interactive: true,
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["interactive_panel", "schema_rejected"]),
      interactive: true,
    });
  });

  it("rejects mutating affordances", () => {
    const validation = validateWorkingCockpitPanelDescriptor({
      ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0],
      allowed_affordances: ["execute_tool"],
    });
    const missingForbiddenValidation = validateWorkingCockpitPanelDescriptor({
      ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0],
      forbidden_affordances: ["execute_tool"],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "mutating_affordance_declared",
        "schema_rejected",
      ]),
    });
    expect(missingForbiddenValidation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["mutating_affordance_declared"]),
    });
  });

  it("rejects raw payload field classes", () => {
    const validation = validateWorkingCockpitPanelDescriptor({
      ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0],
      allowed_field_classes: [
        ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0]
          .allowed_field_classes,
        COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES[0],
      ],
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "raw_payload_field_declared",
        "schema_rejected",
      ]),
    });
  });

  it("enforces deterministic display priority ordering", () => {
    const registry = {
      ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
      panels: [
        DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[1],
        DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels[0],
        ...DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY.panels.slice(2),
      ],
    };

    expect(validateWorkingCockpitPanelRegistry(registry)).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["priority_order_not_deterministic"]),
    });
    expect(
      listWorkingCockpitPanels().map((panel) => panel.display_priority),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("keeps all descriptors serializable", () => {
    for (const panel of listWorkingCockpitPanels()) {
      expect(JSON.parse(JSON.stringify(panel))).toEqual(panel);
      expect(WorkingCockpitPanelDescriptorSchema.parse(panel)).toEqual(panel);
    }
  });

  it("rejects unsafe cadence and hard-cap violations", () => {
    expect(
      validateWorkingCockpitPanelDescriptor(
        registryWithPanelPatch({ update_cadence_band: "realtime" }).panels[0],
      ),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["unsafe_cadence", "schema_rejected"]),
    });
    expect(
      validateWorkingCockpitPanelDescriptor(
        registryWithPanelPatch({ max_items: 500 }).panels[0],
      ),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["hard_cap_exceeded", "schema_rejected"]),
    });
  });

  it("exports registry helpers from the command-center index", () => {
    expect(typeof listWorkingCockpitPanels).toBe("function");
    expect(typeof findWorkingCockpitPanel).toBe("function");
    expect(typeof validateWorkingCockpitPanelDescriptor).toBe("function");
    expect(typeof validateWorkingCockpitPanelRegistry).toBe("function");
    expect(findWorkingCockpitPanel("router")).toMatchObject({
      found: true,
      panel_id: "router",
      reason: "panel_descriptor_valid",
    });
    expect(findWorkingCockpitPanel("traces")).toMatchObject({
      found: false,
      panel_id: null,
      reason: "unknown_panel_id",
    });
  });
});
