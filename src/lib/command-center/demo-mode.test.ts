import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEMO_MODE_ISOLATION_POLICY,
  DemoModeDataSourceSchema,
  DemoModeIsolationPolicySchema,
  createDefaultDemoModeDataSource,
  validateDemoModeDataSource,
  validateDemoModeIsolationPolicy,
} from "./index";

describe("Phase 9I1 demo mode data source contract", () => {
  it("creates a deterministic, safe, synthetic, serializable default data source", () => {
    const first = createDefaultDemoModeDataSource();
    const second = createDefaultDemoModeDataSource();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(DemoModeDataSourceSchema.parse(first)).toEqual(first);
    expect(first).toMatchObject({
      kind: "command_center.demo_mode_data_source",
      phase: "9I1",
      source_id: "demo_mode:synthetic:safe_empty",
      source_kind: "synthetic_build_time_dataset",
      dataset_profile: "safe_empty",
      generated_at: 0,
      redaction_status: "metadata_only",
      render_safe: true,
      replay_safe: true,
      non_executable: true,
      metadata_only: true,
      raw_payloads_included: false,
      exact_pii_included: false,
      authority_surface: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      db_write_performed: false,
      network_called: false,
    });
    expect(validateDemoModeDataSource(first)).toMatchObject({
      passed: true,
      reasons: ["demo_mode_data_source_valid"],
      synthetic_only: true,
      mutated_input: false,
    });
  });

  it("disables live access, writes, remote sync, and requires a badge by default", () => {
    expect(createDefaultDemoModeDataSource()).toMatchObject({
      live_data_access_allowed: false,
      writes_allowed: false,
      remote_sync_allowed: false,
      badge_required: true,
      live_audit_db_access_allowed: false,
      live_telemetry_access_allowed: false,
      user_project_data_allowed: false,
      real_suggestions_allowed: false,
      real_traces_allowed: false,
      real_frames_or_voice_allowed: false,
      secrets_or_exact_pii_allowed: false,
    });
  });

  it("fails validation for unknown dataset profiles", () => {
    const source = createDefaultDemoModeDataSource();

    expect(
      validateDemoModeDataSource({
        ...source,
        dataset_profile: "real_customer_walkthrough",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "unknown_dataset_profile",
      ]),
    });
  });

  it("fails validation for real or live source kinds", () => {
    const source = createDefaultDemoModeDataSource();

    expect(
      validateDemoModeDataSource({
        ...source,
        source_kind: "live_audit_db",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "real_or_live_source_kind",
      ]),
      synthetic_only: false,
    });
  });

  it("fails validation when live data access is enabled", () => {
    expect(
      validateDemoModeDataSource({
        ...createDefaultDemoModeDataSource(),
        live_data_access_allowed: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "live_data_access_enabled",
      ]),
      live_data_access_allowed: true,
    });
  });

  it("fails validation when writes are enabled", () => {
    expect(
      validateDemoModeDataSource({
        ...createDefaultDemoModeDataSource(),
        writes_allowed: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "writes_enabled"]),
      writes_allowed: true,
    });
  });

  it("fails validation when remote sync is enabled", () => {
    expect(
      validateDemoModeDataSource({
        ...createDefaultDemoModeDataSource(),
        remote_sync_allowed: true,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "remote_sync_enabled",
      ]),
      remote_sync_allowed: true,
    });
  });

  it("fails validation when the demo badge is not required", () => {
    expect(
      validateDemoModeDataSource({
        ...createDefaultDemoModeDataSource(),
        badge_required: false,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining(["schema_rejected", "badge_missing"]),
      badge_required: false,
    });
  });

  it("fails closed for raw payload fields", () => {
    expect(
      validateDemoModeDataSource({
        ...createDefaultDemoModeDataSource(),
        raw_tool_args: "withheld",
        raw_prompt: "withheld",
        exact_pii: "withheld",
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "raw_payload_field_present",
      ]),
      withheld_fields: expect.arrayContaining([
        "raw_tool_args",
        "raw_prompt",
        "exact_pii",
      ]),
    });
  });

  it("fails closed for executable approve/run/retry/mutate keys", () => {
    expect(
      validateDemoModeDataSource({
        ...createDefaultDemoModeDataSource(),
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

  it("passes the default isolation policy and is serializable", () => {
    const validation = validateDemoModeIsolationPolicy(
      DEFAULT_DEMO_MODE_ISOLATION_POLICY,
    );

    expect(
      JSON.parse(JSON.stringify(DEFAULT_DEMO_MODE_ISOLATION_POLICY)),
    ).toEqual(DEFAULT_DEMO_MODE_ISOLATION_POLICY);
    expect(
      DemoModeIsolationPolicySchema.parse(DEFAULT_DEMO_MODE_ISOLATION_POLICY),
    ).toEqual(DEFAULT_DEMO_MODE_ISOLATION_POLICY);
    expect(validation).toMatchObject({
      passed: true,
      reasons: ["demo_mode_isolation_policy_valid"],
      failed_invariants: [],
      render_safe: true,
      non_executable: true,
    });
  });

  it("fails the isolation policy if any invariant is false", () => {
    expect(
      validateDemoModeIsolationPolicy({
        ...DEFAULT_DEMO_MODE_ISOLATION_POLICY,
        no_live_audit_db_access: false,
      }),
    ).toMatchObject({
      passed: false,
      reasons: expect.arrayContaining([
        "schema_rejected",
        "isolation_invariant_failed",
      ]),
      failed_invariants: ["no_live_audit_db_access"],
    });
  });

  it("exports demo mode helpers from command-center index", () => {
    expect(typeof createDefaultDemoModeDataSource).toBe("function");
    expect(typeof validateDemoModeDataSource).toBe("function");
    expect(typeof validateDemoModeIsolationPolicy).toBe("function");
    expect(
      DemoModeDataSourceSchema.parse(createDefaultDemoModeDataSource()),
    ).toEqual(createDefaultDemoModeDataSource());
  });
});
