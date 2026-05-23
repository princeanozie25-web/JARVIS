import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_9D_WORKING_COCKPIT_AFFORDANCE_STATE,
  DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY,
  PHASE_9D_WORKING_COCKPIT_CLOSEOUT_GUARDS,
  Phase9DWorkingCockpitCloseoutReportSchema,
  WORKING_COCKPIT_PANEL_IDS,
  WorkingCockpitRefreshPolicySchema,
  createDefaultWorkingCockpitViewModel,
  createPhase9DWorkingCockpitCloseoutReport,
  findWorkingCockpitRefreshPolicy,
  listWorkingCockpitPanels,
  listWorkingCockpitRefreshPolicies,
  resolveWorkingCockpitRefreshDecision,
  validateWorkingCockpitRefreshPolicy,
  validateWorkingCockpitRefreshPolicyRegistry,
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

function registryWithPolicyPatch(patch: Record<string, unknown>) {
  return {
    ...DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY,
    policies: [
      {
        ...DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY.policies[0],
        ...patch,
      },
      ...DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY.policies.slice(1),
    ],
  };
}

describe("Phase 9D3 Working cockpit refresh policy and closeout guards", () => {
  it("has exactly one default refresh policy per panel", () => {
    const policies = listWorkingCockpitRefreshPolicies();

    expect(policies.map((policy) => policy.panel_id)).toEqual([
      ...WORKING_COCKPIT_PANEL_IDS,
    ]);
    expect(new Set(policies.map((policy) => policy.panel_id)).size).toBe(
      WORKING_COCKPIT_PANEL_IDS.length,
    );
    expect(validateWorkingCockpitRefreshPolicyRegistry()).toMatchObject({
      passed: true,
      reasons: ["refresh_policy_valid"],
      policy_count: WORKING_COCKPIT_PANEL_IDS.length,
      missing_panel_ids: [],
      duplicate_panel_ids: [],
      live_stream_allowed: false,
      remote_sync_allowed: false,
      network_fetch_allowed: false,
    });
  });

  it("rejects policies that poll faster than the producer rate", () => {
    const validation = validateWorkingCockpitRefreshPolicy(
      registryWithPolicyPatch({
        update_cadence_band: "medium",
        producer_rate_limit_band: "low",
      }).policies[0],
    );

    expect(validation).toMatchObject({
      passed: false,
      reasons: ["cadence_exceeds_producer_rate"],
      live_stream_allowed: false,
      remote_sync_allowed: false,
      network_fetch_allowed: false,
    });
  });

  it("rejects live streaming and remote sync", () => {
    const validation = validateWorkingCockpitRefreshPolicy(
      registryWithPolicyPatch({
        live_stream_allowed: true,
        remote_sync_allowed: true,
        remote_dashboard_allowed: true,
      }).policies[0],
    );

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "live_stream_enabled",
        "remote_sync_enabled",
      ]),
      live_stream_allowed: false,
      remote_sync_allowed: false,
      remote_dashboard_allowed: false,
    });
  });

  it("fails closed for unknown and duplicate panel policies", () => {
    const unknown = validateWorkingCockpitRefreshPolicy({
      ...DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY.policies[0],
      panel_id: "traces",
    });
    const duplicateRegistry = {
      ...DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY,
      policies: [
        DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY.policies[0],
        {
          ...DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY.policies[1],
          panel_id:
            DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY.policies[0]
              .panel_id,
        },
        ...DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY.policies.slice(2),
      ],
    };

    expect(unknown).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "unknown_panel"]),
      panel_id: null,
    });
    expect(
      validateWorkingCockpitRefreshPolicyRegistry(duplicateRegistry),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["duplicate_policy", "missing_policy"]),
      duplicate_panel_ids: ["router"],
      missing_panel_ids: ["tool_calls"],
    });
  });

  it("enforces max_items against the 9D1 descriptor cap", () => {
    const routerPanel = listWorkingCockpitPanels()[0];
    const validation = validateWorkingCockpitRefreshPolicy(
      registryWithPolicyPatch({ max_items: routerPanel.max_items + 1 })
        .policies[0],
    );

    expect(validation).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["max_items_exceeds_panel_cap"]),
    });
  });

  it("resolves deterministic refresh decisions without wiring timers or network", () => {
    const first = resolveWorkingCockpitRefreshDecision("router", "medium");
    const second = resolveWorkingCockpitRefreshDecision("router", "medium");
    const clamped = resolveWorkingCockpitRefreshDecision("costs", "medium");
    const unknown = resolveWorkingCockpitRefreshDecision("traces", "low");

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      panel_id: "router",
      requested_cadence_band: "medium",
      resolved_cadence_band: "medium",
      decision: "allowed",
      reason: "requested_cadence_allowed",
      starts_timer: false,
      polling_wired: false,
      network_called: false,
      authority_surface: false,
    });
    expect(clamped).toMatchObject({
      panel_id: "costs",
      requested_cadence_band: "medium",
      resolved_cadence_band: "low",
      decision: "clamped",
      reason: "requested_cadence_clamped_to_producer_rate",
    });
    expect(unknown).toMatchObject({
      panel_id: null,
      decision: "blocked",
      reason: "unknown_panel",
    });
  });

  it("passes the default closeout report", () => {
    const report = createPhase9DWorkingCockpitCloseoutReport();

    expect(report).toEqual({
      kind: "command_center.phase_9d_working_cockpit_closeout_report",
      verdict: "pass",
      checked_guards: [...PHASE_9D_WORKING_COCKPIT_CLOSEOUT_GUARDS],
      failed_guards: [],
      notes: ["phase_9d_working_cockpit_scaffold_is_display_only"],
      generated_from: "phase_9d_working_cockpit_scaffold",
      metadata_only: true,
      redaction_required: true,
      read_only: true,
      render_safe: true,
      display_only: true,
      authority_surface: false,
      live_stream_allowed: false,
      remote_dashboard_allowed: false,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("fails closeout if forbidden affordances are enabled", () => {
    const report = createPhase9DWorkingCockpitCloseoutReport({
      affordanceState: {
        ...DEFAULT_PHASE_9D_WORKING_COCKPIT_AFFORDANCE_STATE,
        approval_affordances_enabled: true,
        routine_mutation_affordances_enabled: true,
        tool_execution_affordances_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_approval_affordances",
        "no_routine_mutation_affordances",
        "no_tool_execution_affordances",
      ]),
      notes: expect.arrayContaining([
        "forbidden_working_cockpit_affordance_enabled:approval_affordances_enabled",
        "forbidden_working_cockpit_affordance_enabled:routine_mutation_affordances_enabled",
        "forbidden_working_cockpit_affordance_enabled:tool_execution_affordances_enabled",
      ]),
    });
  });

  it("fails closeout if raw payload rendering is allowed", () => {
    const report = createPhase9DWorkingCockpitCloseoutReport({
      viewModel: {
        ...createDefaultWorkingCockpitViewModel(),
        panels: {
          ...createDefaultWorkingCockpitViewModel().panels,
          router: {
            ...createDefaultWorkingCockpitViewModel().panels.router,
            raw_prompt: "unsafe",
          },
        },
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "all_panels_have_safe_view_models",
        "no_raw_payload_rendering",
      ]),
      notes: expect.arrayContaining([
        "working_cockpit_view_model_raw_payload_detected",
      ]),
    });
  });

  it("fails closeout if live stream or remote dashboard is enabled", () => {
    const report = createPhase9DWorkingCockpitCloseoutReport({
      refreshPolicyRegistry: registryWithPolicyPatch({
        live_stream_allowed: true,
        remote_dashboard_allowed: true,
      }),
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "all_panels_have_safe_refresh_policies",
        "no_live_stream_remote_dashboard_path",
      ]),
      notes: expect.arrayContaining([
        "working_cockpit_refresh_policy_validation_failed",
      ]),
    });
  });

  it("keeps report output deterministic and serializable", () => {
    const first = createPhase9DWorkingCockpitCloseoutReport();
    const second = createPhase9DWorkingCockpitCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9DWorkingCockpitCloseoutReportSchema.parse(first)).toEqual(
      first,
    );
  });

  it("exports refresh helpers from the command-center index", () => {
    expect(typeof listWorkingCockpitRefreshPolicies).toBe("function");
    expect(typeof findWorkingCockpitRefreshPolicy).toBe("function");
    expect(typeof validateWorkingCockpitRefreshPolicy).toBe("function");
    expect(typeof validateWorkingCockpitRefreshPolicyRegistry).toBe("function");
    expect(typeof resolveWorkingCockpitRefreshDecision).toBe("function");
    expect(typeof createPhase9DWorkingCockpitCloseoutReport).toBe("function");
    expect(
      WorkingCockpitRefreshPolicySchema.parse(
        findWorkingCockpitRefreshPolicy("router").policy,
      ),
    ).toMatchObject({
      panel_id: "router",
      live_stream_allowed: false,
      remote_sync_allowed: false,
    });
  });
});
