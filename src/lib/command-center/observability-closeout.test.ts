import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS,
  DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
  PHASE_9B_OBSERVABILITY_CLOSEOUT_GUARDS,
  Phase9BObservabilityCloseoutReportSchema,
  createPhase9BObservabilityCloseoutReport,
  validateCommandCenterObservabilityAction,
  type CommandCenterObservabilitySourceAdapterRegistry,
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

function registryWithAdapterPatch(
  patch: Record<string, unknown>,
): CommandCenterObservabilitySourceAdapterRegistry {
  return {
    ...DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
    adapters: [
      {
        ...DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY
          .adapters[0],
        ...patch,
      },
      ...DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY.adapters.slice(
        1,
      ),
    ],
  } as CommandCenterObservabilitySourceAdapterRegistry;
}

describe("Phase 9B4 observability API closeout guards", () => {
  it("passes the default Phase 9B closeout report", () => {
    const report = createPhase9BObservabilityCloseoutReport();

    expect(report).toEqual({
      kind: "command_center.phase_9b_observability_closeout_report",
      verdict: "pass",
      checked_guards: [...PHASE_9B_OBSERVABILITY_CLOSEOUT_GUARDS],
      failed_guards: [],
      notes: ["phase_9b_observability_scaffold_is_read_only_metadata_only"],
      generated_from: "phase_9b_read_only_observability_scaffold",
      metadata_only: true,
      read_only: true,
      redaction_required: true,
      descriptor_only: true,
      authority_surface: false,
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("fails if any mutating action is treated as allowed", () => {
    const actionValidations =
      COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS.map((action) =>
        action === "mutate"
          ? {
              ...validateCommandCenterObservabilityAction(action),
              allowed: true,
              read_only_query_action: true,
            }
          : validateCommandCenterObservabilityAction(action),
      );
    const report = createPhase9BObservabilityCloseoutReport({
      actionValidations,
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_mutating_endpoints_or_actions"],
      notes: ["forbidden_action_allowed:mutate"],
      ...SIDE_EFFECT_FALSES,
    });
  });

  it("fails if an adapter is not read-only", () => {
    const report = createPhase9BObservabilityCloseoutReport({
      adapterRegistry: registryWithAdapterPatch({ read_only: false }),
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "all_query_categories_have_descriptor_only_adapters",
        "all_adapters_read_only_metadata_only_redaction_required",
      ]),
    });
  });

  it("fails if an adapter is not metadata-only", () => {
    const report = createPhase9BObservabilityCloseoutReport({
      adapterRegistry: registryWithAdapterPatch({ metadata_only: false }),
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "all_query_categories_have_descriptor_only_adapters",
        "all_adapters_read_only_metadata_only_redaction_required",
      ]),
    });
  });

  it("fails if an adapter does not require redaction", () => {
    const report = createPhase9BObservabilityCloseoutReport({
      adapterRegistry: registryWithAdapterPatch({ redaction_required: false }),
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "all_query_categories_have_descriptor_only_adapters",
        "all_adapters_read_only_metadata_only_redaction_required",
      ]),
    });
  });

  it("fails if raw payload support appears", () => {
    const report = createPhase9BObservabilityCloseoutReport({
      unsafePayload: [{ item_id: "safe:item", item_class: "metadata" }],
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "response_wrapper_fails_closed_on_unsafe_payloads",
        "no_raw_payload_render_support",
      ]),
      notes: expect.arrayContaining([
        "unsafe_payload_not_withheld",
        "raw_payload_render_support_detected",
      ]),
    });
  });

  it("fails if replay_safe is enabled on non-compatible categories", () => {
    const report = createPhase9BObservabilityCloseoutReport({
      adapterRegistry: registryWithAdapterPatch({ supports_replay_safe: true }),
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "replay_safe_only_for_trace_governance_runtime_dependencies",
      ]),
      notes: expect.arrayContaining([
        "adapter_replay_safe_category_guard_failed",
      ]),
    });
  });

  it("confirms unsafe payloads are withheld and fail closed", () => {
    const report = createPhase9BObservabilityCloseoutReport({
      unsafePayload: { raw_prompt: "withhold me" },
    });

    expect(report).toMatchObject({
      verdict: "pass",
      failed_guards: [],
    });
  });

  it("keeps report output deterministic and serializable", () => {
    const first = createPhase9BObservabilityCloseoutReport();
    const second = createPhase9BObservabilityCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9BObservabilityCloseoutReportSchema.parse(first)).toEqual(
      first,
    );
  });

  it("exports closeout helpers from the command-center index", () => {
    expect(typeof createPhase9BObservabilityCloseoutReport).toBe("function");
    expect(
      Phase9BObservabilityCloseoutReportSchema.parse(
        createPhase9BObservabilityCloseoutReport(),
      ),
    ).toMatchObject({
      verdict: "pass",
      generated_from: "phase_9b_read_only_observability_scaffold",
    });
  });
});
