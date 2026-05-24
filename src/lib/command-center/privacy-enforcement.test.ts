import { describe, expect, it } from "vitest";

import {
  COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES,
  COMMAND_CENTER_SURFACES,
  CommandCenterPayloadPrivacyValidationSchema,
  CommandCenterPayloadRenderAssertionSchema,
  CommandCenterPrivacyPolicySchema,
  CommandCenterPrivacyPolicyValidationSchema,
  assertCommandCenterPayloadCanRender,
  createDefaultCommandCenterPrivacyPolicy,
  validateCommandCenterPayloadPrivacy,
  validateCommandCenterPrivacyPolicy,
} from "./index";

describe("Phase 9K1 command center privacy enforcement contract", () => {
  it("creates a deterministic, serializable default policy for every surface", () => {
    const first = createDefaultCommandCenterPrivacyPolicy();
    const second = createDefaultCommandCenterPrivacyPolicy();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(CommandCenterPrivacyPolicySchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.privacy_policy",
      phase: "9K1",
      policy_id: "command_center:privacy:metadata_only:v1",
      applies_to_surfaces: [...COMMAND_CENTER_SURFACES],
      metadata_only_required: true,
      redaction_required: true,
      render_safe_required: true,
      non_executable_required: true,
      raw_payloads_forbidden: true,
      source_code_forbidden: true,
      live_user_data_forbidden_in_demo: true,
      remote_dashboard_forbidden: true,
      export_unredacted_forbidden: true,
      generated_at: 0,
    });
    expect(validateCommandCenterPrivacyPolicy(first)).toMatchObject({
      passed: true,
      reasons: ["privacy_policy_valid"],
      applies_to_surfaces: [...COMMAND_CENTER_SURFACES],
      mutated_input: false,
    });
  });

  it("fails policy validation if any enforcement boolean is false", () => {
    for (const field of [
      "metadata_only_required",
      "redaction_required",
      "render_safe_required",
      "non_executable_required",
      "raw_payloads_forbidden",
      "source_code_forbidden",
      "live_user_data_forbidden_in_demo",
      "remote_dashboard_forbidden",
      "export_unredacted_forbidden",
    ] as const) {
      expect(
        validateCommandCenterPrivacyPolicy({
          ...createDefaultCommandCenterPrivacyPolicy(),
          [field]: false,
        }),
      ).toMatchObject({
        passed: false,
        reasons: expect.arrayContaining([
          "schema_rejected",
          "enforcement_boolean_disabled",
        ]),
      });
    }
  });

  it("fails closed for unknown surfaces", () => {
    expect(
      validateCommandCenterPayloadPrivacy("ops_console", {
        metadata_only: true,
        render_safe: true,
        non_executable: true,
      }),
    ).toMatchObject({
      passed: false,
      surface: "unknown",
      reasons: expect.arrayContaining(["unknown_surface"]),
    });
  });

  it("passes safe metadata-only payloads", () => {
    const validation = validateCommandCenterPayloadPrivacy("working", {
      metadata_only: true,
      redaction_required: true,
      render_safe: true,
      non_executable: true,
      status_class: "nominal",
      count_bin: "low",
      generated_at: 0,
    });

    expect(validation).toMatchObject({
      passed: true,
      reasons: ["payload_privacy_valid"],
      surface: "working",
      metadata_only: true,
      render_safe: true,
      non_executable: true,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      db_write_performed: false,
      network_called: false,
      mutated_input: false,
    });
    expect(
      CommandCenterPayloadPrivacyValidationSchema.parse(validation),
    ).toEqual(validation);
  });

  it("fails closed for every forbidden UI payload class", () => {
    for (const field of COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES) {
      expect(
        validateCommandCenterPayloadPrivacy("audit", {
          metadata_only: true,
          [field]: "withheld",
        }),
      ).toMatchObject({
        passed: false,
        reasons: expect.arrayContaining(["forbidden_payload_class_present"]),
        withheld_fields: expect.arrayContaining([field]),
      });
    }
  });

  it("fails closed for nested forbidden fields", () => {
    expect(
      validateCommandCenterPayloadPrivacy("rest", {
        metadata_only: true,
        nested: {
          viewer: {
            raw_prompts: "withheld",
          },
        },
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["forbidden_payload_class_present"]),
      withheld_fields: ["nested.viewer.raw_prompts"],
    });
  });

  it("fails closed for executable, approve, run, retry, mutate, export, and debug-action keys", () => {
    expect(
      validateCommandCenterPayloadPrivacy("developer", {
        metadata_only: true,
        approve_button: true,
        run_button: true,
        retry_button: true,
        mutate_button: true,
        export_unredacted: true,
        debug_action: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["executable_affordance_present"]),
      withheld_fields: expect.arrayContaining([
        "approve_button",
        "run_button",
        "retry_button",
        "mutate_button",
        "export_unredacted",
        "debug_action",
      ]),
    });
  });

  it("fails closed for callback/function/non-serializable values", () => {
    expect(
      validateCommandCenterPayloadPrivacy("developer", {
        metadata_only: true,
        onClick: () => undefined,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["callback_or_non_serializable_value"]),
      notes: expect.arrayContaining(["non_serializable:onClick"]),
    });
  });

  it("rejects live user data in demo surfaces", () => {
    expect(
      validateCommandCenterPayloadPrivacy("demo", {
        metadata_only: true,
        render_safe: true,
        non_executable: true,
        live_user_data_in_demo: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "forbidden_payload_class_present",
        "demo_live_user_data_present",
      ]),
      withheld_fields: expect.arrayContaining(["live_user_data_in_demo"]),
    });
  });

  it("rejects developer-console and raw-table exposure markers in recruiter surfaces", () => {
    expect(
      validateCommandCenterPayloadPrivacy("recruiter", {
        metadata_only: true,
        render_safe: true,
        non_executable: true,
        hide_developer_console: false,
        hide_raw_metadata_tables: false,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["recruiter_exposure_marker_present"]),
      withheld_fields: expect.arrayContaining([
        "hide_developer_console",
        "hide_raw_metadata_tables",
      ]),
    });
  });

  it("does not mutate the input payload", () => {
    const payload = {
      metadata_only: true,
      nested: {
        status_class: "nominal",
      },
    };
    const before = JSON.stringify(payload);

    validateCommandCenterPayloadPrivacy("working", payload);

    expect(JSON.stringify(payload)).toBe(before);
  });

  it("returns false rather than throwing for unsafe render assertions", () => {
    const assertion = assertCommandCenterPayloadCanRender("audit", {
      raw_model_outputs: "withheld",
    });

    expect(assertion).toMatchObject({
      surface: "audit",
      render_safe: false,
      withheld_fields: ["raw_model_outputs"],
    });
    expect(CommandCenterPayloadRenderAssertionSchema.parse(assertion)).toEqual(
      assertion,
    );
  });

  it("exports privacy enforcement helpers from command-center index", () => {
    expect(typeof createDefaultCommandCenterPrivacyPolicy).toBe("function");
    expect(typeof validateCommandCenterPrivacyPolicy).toBe("function");
    expect(typeof validateCommandCenterPayloadPrivacy).toBe("function");
    expect(typeof assertCommandCenterPayloadCanRender).toBe("function");
    expect(
      CommandCenterPrivacyPolicyValidationSchema.parse(
        validateCommandCenterPrivacyPolicy(),
      ),
    ).toEqual(validateCommandCenterPrivacyPolicy());
  });
});
