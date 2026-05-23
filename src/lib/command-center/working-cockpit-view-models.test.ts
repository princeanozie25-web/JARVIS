import { describe, expect, it } from "vitest";

import {
  WORKING_COCKPIT_PANEL_IDS,
  WorkingCockpitViewModelSchema,
  createCommandCenterObservabilityResponseEnvelope,
  createDefaultWorkingCockpitViewModel,
  deriveWorkingCockpitViewModelFromObservabilityResponses,
  listWorkingCockpitPanels,
  validateWorkingCockpitViewModel,
} from "./index";

const SIDE_EFFECT_FALSES = {
  tool_called: false,
  action_executed: false,
  approval_granted: false,
  routine_scheduled: false,
  routine_triggered: false,
  memory_written: false,
  project_written: false,
  device_action_triggered: false,
  cloud_fallback_triggered: false,
  db_write_performed: false,
  network_called: false,
  audio_capture_started: false,
  video_capture_started: false,
} as const;

function expectPanelSafe(panel: Record<string, unknown>) {
  expect(panel).toMatchObject({
    metadata_only: true,
    redaction_required: true,
    render_safe: true,
    interactive: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    network_fetch_allowed: false,
    approval_actions_allowed: false,
    routine_actions_allowed: false,
    tool_actions_allowed: false,
    replay_run_actions_allowed: false,
    capture_actions_allowed: false,
    can_execute: false,
    can_approve: false,
    can_schedule: false,
    can_retry: false,
    can_mutate: false,
    can_call_tools: false,
    can_capture: false,
    can_fetch: false,
    can_route: false,
    ...SIDE_EFFECT_FALSES,
  });
}

describe("Phase 9D2 Working cockpit panel view models", () => {
  it("includes all ten panels in the default cockpit view model", () => {
    const model = createDefaultWorkingCockpitViewModel();

    expect(model.panel_order).toEqual([...WORKING_COCKPIT_PANEL_IDS]);
    expect(Object.keys(model.panels)).toEqual([...WORKING_COCKPIT_PANEL_IDS]);
    for (const panelId of WORKING_COCKPIT_PANEL_IDS) {
      expect(model.panels[panelId].panel_id).toBe(panelId);
    }
  });

  it("keeps the default cockpit view model deterministic, serializable, metadata-only, and render-safe", () => {
    const first = createDefaultWorkingCockpitViewModel();
    const second = createDefaultWorkingCockpitViewModel();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(WorkingCockpitViewModelSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      metadata_only: true,
      redaction_required: true,
      render_safe: true,
      interactive: false,
      raw_payloads_included: false,
      exact_pii_included: false,
      authority_surface: false,
    });
    for (const panel of Object.values(first.panels)) {
      expectPanelSafe(panel);
    }
    expect(validateWorkingCockpitViewModel(first)).toMatchObject({
      passed: true,
      reasons: ["working_cockpit_view_model_valid"],
      missing_panels: [],
      mismatched_panels: [],
      withheld_fields: [],
      mutated_input: false,
    });
  });

  it("derives expected placeholder states from safe observability responses", () => {
    const router = createCommandCenterObservabilityResponseEnvelope({
      query_id: "working:router",
      category: "router",
      generated_at: 45,
      payload: [
        {
          item_id: "router:item",
          item_class: "router_summary",
          status: "active",
          count_band: "high",
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
      withheld_fields: ["raw_prompt"],
      truncated: true,
    });
    const approvals = createCommandCenterObservabilityResponseEnvelope({
      query_id: "working:approvals",
      category: "approvals",
      generated_at: 46,
      payload: [
        {
          item_id: "approvals:item",
          item_class: "approval_summary",
          status: "blocked",
          count_band: "medium",
          redaction_status: "metadata_only",
          metadata_only: true,
          raw_payload_included: false,
        },
      ],
    });

    const model = deriveWorkingCockpitViewModelFromObservabilityResponses([
      router,
      approvals,
    ]);

    expect(model.panels.router).toMatchObject({
      status_class: "active",
      count_bins: {
        high: "high",
      },
      generated_at: 45,
      truncated: true,
      withheld_fields: ["raw_prompt"],
    });
    expect(model.panels.approvals).toMatchObject({
      status_class: "blocked",
      count_bins: {
        medium: "medium",
      },
      state_class: "blocked",
      generated_at: 46,
    });
  });

  it("falls back to safe defaults for missing responses", () => {
    const model = deriveWorkingCockpitViewModelFromObservabilityResponses([]);
    const defaults = createDefaultWorkingCockpitViewModel();

    expect(model).toEqual(defaults);
  });

  it("falls back to safe defaults for unsafe responses", () => {
    const unsafeResponse = {
      ...createCommandCenterObservabilityResponseEnvelope({
        query_id: "working:router",
        category: "router",
        generated_at: 99,
      }),
      raw_prompt: "unsafe",
    };
    const model = deriveWorkingCockpitViewModelFromObservabilityResponses([
      unsafeResponse,
    ]);

    expect(model.panels.router).toEqual(
      createDefaultWorkingCockpitViewModel().panels.router,
    );
  });

  it("fails closed for raw payload fields", () => {
    const validation = validateWorkingCockpitViewModel({
      ...createDefaultWorkingCockpitViewModel(),
      panels: {
        ...createDefaultWorkingCockpitViewModel().panels,
        router: {
          ...createDefaultWorkingCockpitViewModel().panels.router,
          raw_prompt: "unsafe",
        },
      },
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "raw_payload_field_present",
        "schema_rejected",
      ]),
      withheld_fields: ["panels.router.raw_prompt"],
      render_safe: false,
      raw_payloads_included: false,
      mutated_input: false,
    });
  });

  it("fails closed for callback/function/non-serializable fields", () => {
    const validation = validateWorkingCockpitViewModel({
      ...createDefaultWorkingCockpitViewModel(),
      panels: {
        ...createDefaultWorkingCockpitViewModel().panels,
        router: {
          ...createDefaultWorkingCockpitViewModel().panels.router,
          onClick: () => undefined,
        },
      },
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "authority_key_present",
        "non_serializable_value",
        "schema_rejected",
      ]),
      withheld_fields: ["panels.router.onClick"],
      render_safe: false,
      mutated_input: false,
    });
  });

  it("fails closed for mutating and interactive authority-like keys", () => {
    const validation = validateWorkingCockpitViewModel({
      ...createDefaultWorkingCockpitViewModel(),
      panels: {
        ...createDefaultWorkingCockpitViewModel().panels,
        router: {
          ...createDefaultWorkingCockpitViewModel().panels.router,
          interactive: true,
          execute: "forbidden",
        },
      },
    });

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "authority_key_present",
        "schema_rejected",
      ]),
      withheld_fields: expect.arrayContaining([
        "panels.router.interactive",
        "panels.router.execute",
      ]),
      render_safe: false,
    });
  });

  it("aligns panel IDs with the 9D1 registry", () => {
    const model = createDefaultWorkingCockpitViewModel();
    const registryPanelIds = listWorkingCockpitPanels().map(
      (panel) => panel.panel_id,
    );

    expect(model.panel_order).toEqual(registryPanelIds);
    for (const panelId of registryPanelIds) {
      expect(model.panels[panelId].panel_id).toBe(panelId);
    }
  });

  it("exports view model helpers from the command-center index", () => {
    expect(typeof createDefaultWorkingCockpitViewModel).toBe("function");
    expect(typeof validateWorkingCockpitViewModel).toBe("function");
    expect(typeof deriveWorkingCockpitViewModelFromObservabilityResponses).toBe(
      "function",
    );
    expect(
      WorkingCockpitViewModelSchema.parse(
        createDefaultWorkingCockpitViewModel(),
      ),
    ).toEqual(createDefaultWorkingCockpitViewModel());
  });
});
